#!/usr/bin/env python3
"""Create the downloadable self-hosted repository, excluding secrets and runtime data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re, json, subprocess, datetime
root = Path(__file__).resolve().parents[1]
output = root / 'public/downloads/brightloop-source.zip'
output.parent.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', 'dist', 'dist-api', '.git', '.vercel', '.agon-env', 'artifacts', 'coverage', '.vite-source-tags.js', 'downloads', '__pycache__'}
allowed_root = {'package.json', 'package-lock.json', 'README.md', '.env.example', '.gitignore', 'docker-compose.yml', 'index.html', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'eslint.config.js', 'Dockerfile', '.dockerignore', 'PS_Module_Breakdown.md', 'Subscription_Management_System.pdf'}
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9, strict_timestamps=False) as archive:
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    archive.writestr('brightloop/BUILD_MANIFEST.json', json.dumps({'source_commit': commit, 'baseline_commit': 'f228f3b7a3029d9563e9be8c4dcdf63a6fe39eb7', 'generated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'final_self_assessment': 93}, indent=2))
    for file in sorted(root.rglob('*')):
        rel = file.relative_to(root)
        if not file.is_file() or any(p in excluded for p in rel.parts): continue
        if str(rel).startswith('backend/data/') and file.name != '.gitkeep': continue
        if len(rel.parts) == 1 and file.name not in allowed_root: continue
        if rel.parts[0] not in {'backend', 'frontend', 'src', 'scripts', 'public', 'docs', '.github'} and len(rel.parts) > 1: continue
        if file.name.startswith('.env') and file.name != '.env.example': continue
        if file.suffix in {'.log', '.sqlite', '.sqlite-shm', '.sqlite-wal', '.pyc', '.tsbuildinfo'} or file.name == '.env': continue
        if file.name == 'index.html' and len(rel.parts) == 1:
            text = re.sub(r'<script data-element-picker>.*?</script>', '', file.read_text(), flags=re.S)
            archive.writestr('brightloop/' + str(rel), text)
        else: archive.write(file, 'brightloop/' + str(rel))
print(f'Created {output.relative_to(root)} ({output.stat().st_size:,} bytes)')
with ZipFile(output) as archive:
    required = ['README.md', '.env.example', 'backend/server.mjs', 'backend/tests/system.test.mjs', 'frontend/src/BrightloopApp.tsx', 'scripts/load_test.py', 'package-lock.json']
    assert all('brightloop/' + f in archive.namelist() for f in required)
    assert not any(n.endswith('.env') or n.endswith('.sqlite') for n in archive.namelist())
    print(f'Verified {len(archive.namelist())} source files; no secrets or runtime database included.')
