#!/usr/bin/env python3
"""Seed a separate local database, run the actual REST API, and report measured p95.
Uses only Python's standard library. No external service. Stops its server on exit.
"""
import concurrent.futures, json, os, pathlib, statistics, subprocess, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
env = dict(os.environ, SQLITE_PATH='backend/data/load-test.sqlite', DATABASE_URL='', JWT_SECRET='load-test-only-secret-at-least-thirty-two-characters', PORT='4099', SCHEDULER='off', QUIET='1', NODE_ENV='test')
subprocess.run(['node', 'scripts/load_seed.mjs', '10000'], env=env, check=True)
base = 'http://127.0.0.1:4099/api'
server = subprocess.Popen(['node', 'backend/server.mjs'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
def call(path, token=None, payload=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base + path, headers=headers, data=json.dumps(payload).encode() if payload is not None else None)
    with urllib.request.urlopen(request, timeout=10) as response: return json.load(response)
try:
    for _ in range(100):
        try: call('/health'); break
        except Exception: time.sleep(.1)
    else: raise RuntimeError('Local API did not start')
    token = call('/auth/login', payload={'email':'admin@brightloop.local', 'password':'Brightloop@2026'})['access_token']
    endpoints = ['/subscriptions', '/subscriptions?page=100', '/subscriptions?status=Active', '/invoices', '/invoices/outstanding', '/payments', '/dashboard/summary', '/reports/revenue', '/reports/aging', '/reports/subscriptions', '/reports/invoices', '/reports/payments', '/audit']
    results = []
    print('\n10,000 subscriptions | 50-row pages | 50 requests/endpoint | concurrency 5')
    print(f'{"ENDPOINT":43} {"p50 ms":>9} {"p95 ms":>9} {"max ms":>9}  RESULT')
    for endpoint in endpoints:
        for _ in range(3): call(endpoint, token)
        def timed(_):
            start = time.perf_counter(); call(endpoint, token); return (time.perf_counter() - start) * 1000
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: timings = sorted(pool.map(timed, range(50)))
        row = {'endpoint':endpoint, 'p50_ms':round(statistics.median(timings),2), 'p95_ms':round(timings[int(.95 * (len(timings)-1))],2), 'max_ms':round(max(timings),2)}
        results.append(row)
        print(f'{endpoint:43} {row["p50_ms"]:9.2f} {row["p95_ms"]:9.2f} {row["max_ms"]:9.2f}  {"PASS" if row["p95_ms"] < 2000 else "FAIL"}')
    output = {'subscriptions':10000, 'concurrency':5, 'requests_per_endpoint':50, 'page_size':50, 'database':'SQLite WAL', 'measured_at':time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'results':results}
    pathlib.Path('scripts/load-results.json').write_text(json.dumps(output, indent=2))
    assert all(r['p95_ms'] < 2000 for r in results), 'At least one endpoint exceeded p95 < 2 seconds'
finally:
    server.terminate()
    try: server.wait(timeout=5)
    except subprocess.TimeoutExpired: server.kill(); server.wait()
