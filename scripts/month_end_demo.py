#!/usr/bin/env python3
"""A reproducible full billing lifecycle against the running local API.
Run npm run local, then python3 scripts/month_end_demo.py.
"""
import json, os, urllib.request, datetime
BASE = os.environ.get('BRIGHTLOOP_API', 'http://127.0.0.1:4000/api')
token = None
def call(method, path, body=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req) as response:
        result = json.load(response)
    print(method, path, '→', result.get('number', result.get('message', result.get('status', 'OK'))))
    return result
login = call('POST', '/auth/login', {'email': 'admin@brightloop.local', 'password': 'Brightloop@2026'})
token = login['access_token']
customer = call('GET', '/customers')['data'][0]
template = call('GET', '/templates')['data'][0]
quote = call('POST', '/quotations', {'customer_id': customer['id'], 'template_id': template['id']})
sub = call('POST', '/quotations/' + quote['id'] + '/convert')
for action in ['confirm', 'activate']:
    call('POST', '/subscriptions/' + sub['id'] + '/' + action)
first = call('POST', '/billing/run')
second = call('POST', '/billing/run')
assert second['created'] == 0, 'Repeated billing created a duplicate!'
rows = call('GET', '/invoices?customer_id=' + customer['id'])['data']
invoice = next(i for i in rows if i['subscription_id'] == sub['id'])
invoice = call('POST', '/invoices/' + invoice['id'] + '/confirm')
call('POST', '/invoices/' + invoice['id'] + '/send')
first_payment = round(float(invoice['total']) / 2, 2)
for amount in [first_payment, round(float(invoice['total']) - first_payment, 2)]:
    call('POST', '/payments', {'invoice_id': invoice['id'], 'method': 'bank', 'amount': amount, 'payment_date': datetime.date.today().isoformat(), 'note': 'Month-end walkthrough'})
paid = call('GET', '/invoices/' + invoice['id'])
assert paid['status'] == 'Paid'
for action in ['pause', 'resume', 'renew']:
    call('POST', '/subscriptions/' + sub['id'] + '/' + action)
call('POST', '/notifications/run')
summary = call('GET', '/dashboard/summary')
print('\nFull month-end lifecycle completed. The next billing date has advanced by one period.')
print('Invoice PDF: backend/data/invoices/' + invoice['number'] + '.pdf')
print('Email log: backend/data/outbox.log')
print('Collected revenue:', summary['revenue_collected'], '| Outstanding:', summary['outstanding'])
