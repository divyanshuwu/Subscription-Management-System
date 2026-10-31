from pathlib import Path
import json, re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image

BASE = Path('/home/user/audit')
MD = (BASE / 'REPORT.md').read_text()
FIGDIR = BASE / 'report_figures'
OUT = Path('/home/user/deliverables/Brightloop_Fresh_Audit_2026-10-31.docx')
GREEN = RGBColor(0x0C, 0x57, 0x4D)

browser = json.loads((BASE / 'logs/browser-audit.json').read_text())
matrix = json.loads((BASE / 'logs/api-matrix.json').read_text())
register = json.loads((BASE / 'logs/check-register.json').read_text())
accept = json.loads((BASE / 'logs/acceptance.json').read_text())

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(0.72); sec.bottom_margin = Inches(0.7)
sec.left_margin = Inches(0.72); sec.right_margin = Inches(0.72)

normal = doc.styles['Normal']
normal.font.name = 'Calibri'; normal.font.size = Pt(9.8)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.08
for sty in ['Title', 'Heading 1', 'Heading 2', 'Heading 3']:
    doc.styles[sty].font.color.rgb = GREEN
    doc.styles[sty].font.name = 'Calibri'

def shade(cell, color):
    el = OxmlElement('w:shd'); el.set(qn('w:fill'), color)
    cell._tc.get_or_add_tcPr().append(el)

def font(cell, size=8, bold=False, mono=False, color=None):
    for p in cell.paragraphs:
        p.paragraph_format.space_after = Pt(1)
        for r in p.runs:
            r.font.size = Pt(size); r.bold = bold or r.bold
            if mono: r.font.name = 'Consolas'
            if color: r.font.color.rgb = color

def add_table(rows, widths, header=True, size=8.2, mono_cols=()):
    cols = len(widths)
    table = doc.add_table(rows=0, cols=cols)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for ci, val in enumerate(row[:cols]):
            cells[ci].text = '' if val is None else str(val)
            cells[ci].width = Inches(widths[ci])
            for p in cells[ci].paragraphs:
                p.paragraph_format.space_after = Pt(1)
            font(cells[ci], size=size, bold=(ri == 0 and header), mono=(ci in mono_cols))
            if ri == 0 and header:
                shade(cells[ci], 'E3F0EA')
            elif ri % 2 == 0:
                shade(cells[ci], 'F7FAF8')
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

def inline(p, text):
    for part in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not part: continue
        if part.startswith('**') and part.endswith('**'):
            r = p.add_run(part[2:-2]); r.bold = True
        elif part.startswith('`') and part.endswith('`'):
            r = p.add_run(part[1:-1]); r.font.name = 'Consolas'; r.font.size = Pt(8.6)
        else:
            p.add_run(part)

def figure(path, caption):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(path), width=Inches(6.25))
    c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(10)
    r = c.add_run(caption); r.italic = True; r.font.size = Pt(8.3); r.font.color.rgb = RGBColor(0x55, 0x66, 0x60)

# ---------- cover ----------
for _ in range(4): doc.add_paragraph()
p = doc.add_paragraph(); r = p.add_run('BRIGHTLOOP'); r.font.size = Pt(11); r.font.bold = True; r.font.color.rgb = GREEN
p = doc.add_paragraph(); r = p.add_run('Functional, Integration\n& Security Test Report'); r.font.size = Pt(30); r.font.bold = True; r.font.color.rgb = GREEN
p = doc.add_paragraph(); r = p.add_run('Fresh audit of the updated Subscription Management System'); r.font.size = Pt(13); r.font.color.rgb = RGBColor(0x44, 0x55, 0x4F)
doc.add_paragraph()
add_table([['Audited snapshot', 'df4ee28a0ec4fe1808d751c803da3452f9869283'],
           ['Audit date', '31 October 2026'],
           ['Test stack', 'Playwright / Chromium, Express HTTP, SQLite, PostgreSQL 17, controlled SMTP'],
           ['Fresh checks', '65 new named checks: 60 pass, 5 fail'],
           ['Revised assessment', '85 / 100'],
           ['Release recommendation', 'HOLD — critical reset-token exposure']],
          [1.9, 4.9], header=False, size=9.2)
p = doc.add_paragraph(); r = p.add_run('Covers the billable month, customer portal, roles, validation, database parity, mail delivery, local performance, mobile layout and accessibility. Evidence files and limits are listed in Appendix C.')
r.font.size = Pt(8.8); r.italic = True
doc.add_page_break()

def add_toc():
    h = doc.add_heading('Contents', level=1)
    for t in ['1. The short version', '2. Scope, version and method', '3. A complete billing month, exercised through the UI',
              '4. Roles, portal and day-to-day operations', '5. Integration and resilience findings', '6. Performance and original-layout checks',
              '7. Confirmed defect register', '8. Requirement-by-requirement evaluation', '9. Revised score and release judgement',
              '10. What remains untested or intentionally outside scope', 'Appendix A. New test register', 'Appendix B. Existing regression inventory', 'Appendix C. Evidence and reproducibility']:
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(3)
        r = p.add_run(t); r.font.size = Pt(10); r.font.color.rgb = RGBColor(0x20, 0x35, 0x30)
    doc.add_page_break()
add_toc()

# ---------- performance table (consumed by marker) ----------
api_rows = [['Endpoint', 'Requests', 'Concurrency', 'p95 (ms)', 'Max (ms)']] + [[e['endpoint'], e['requests'], e['concurrency'], e['p95_ms'], e['max_ms']] for e in accept['api']]
page_rows = [['Page / transition', 'Samples', 'p95 (ms)', 'Max (ms)']] + [[e['page'], e.get('samples', ''), e.get('p95_ms', ''), e.get('max_ms', '')] for e in accept['pages'] if 'samples' in e]
overview_samples = [e['elapsed_ms'] for e in accept['pages'] if 'cold navigation' in e['page']]

def perf_block():
    doc.add_heading('6.1 What was measured (tables)', level=2)
    add_table(api_rows, [2.3, 0.85, 0.95, 0.8, 0.8], mono_cols=(0,))
    doc.add_paragraph(f"Overview cold navigation/reload samples: {', '.join(str(x) for x in overview_samples)} ms. Billing run: {accept['billing']['created']} invoices created from {accept['billing']['due_subscriptions']} due contracts, {accept['billing']['failed']} failed, {accept['billing']['elapsed_ms']} ms with two overlapping workers; errors: {len(accept['errors'])}.")
    add_table(page_rows, [2.3, 0.8, 0.9, 0.9])

trace_rows = [
 ['Requirement area', 'What the fresh work shows', 'Status / limit'],
 ['Accounts, roles, recovery', 'Real admin, staff and customer sessions; wrong password rejected; direct staff product/team writes 403; refresh replay rejected; logout revokes token; isolated recovery flow succeeds.', 'Implemented; confidentiality fails through the notifications path (F-01).'],
 ['Products, variants, plans, rules', 'UI creation and DB read-back for product/cost/variant/plan/tax/discount/template; 100% validation checks passed; daily/weekly/monthly/yearly accepted; scoped rules applied.', 'Broadly covered; advanced selector stops at 100 products (F-02).'],
 ['Quotations', 'Reusable template, quotation creation, one conversion, repeat conversion 409; existing expired/frozen-price/atomicity tests pass.', 'Covered for exercised states.'],
 ['Lifecycle and amendments', 'Draft to Active, pause/resume, renew, illegal transition 409, plan flags, stale revision 409, future-dated customer amendment, issued invoice unchanged.', 'Covered; policies are intentional and need commercial explanation.'],
 ['Recurring billing and money', '2 seats, brand delta, two taxes, two discounts; $1,306 exact total; duplicate billing rerun no extra invoice; 500 due x 2 workers exactly 500; 39 SQLite and 38 PostgreSQL cases.', 'Strong in these scenarios; scheduler endurance and production PG load not tested.'],
 ['Invoices, payments, PDF', 'Confirmed invoice, MIME PDF via SMTP, downloaded %PDF, partial $100 remains open, remaining $1,206 pays in full, invalid payments rejected, idempotency conflict 409.', 'Receipts only; no gateway, refund or chargeback processing.'],
 ['Customer portal', 'Real customer ownership scoping; foreign record/PDF/edit/filter 403; safe catalog omits cost/notes; customer edits seats/add-on only; mobile has no horizontal overflow.', 'Covered; physical device and full assistive review not performed.'],
 ['Search, filters, exports, audit', 'Server search finds a new contract and a customer beyond row 100; bounded/paginated reports; CSV/PDF captured; mutation audit rows exist.', 'Export breadth is paginated; spreadsheet file behavior not executed.'],
 ['Operations and resilience', 'Native production smoke, SQLite backup integrity, SMTP failure and one retry under competing workers, notification dedupe, PostgreSQL schema migrations.', 'No Docker daemon run, hosted CI run or live provider verification.'],
 ['Security', 'Auth, validation, concurrency and ownership checks pass; package audit shows zero known findings.', 'Critical first-party reset-token exposure remains; no full penetration test.'],
 ['Performance and visual', '10k/60k/30k mixed ledger; every recorded page sample under 2 s; CSS hashes and 8 regions match at 1440 and 390.', 'Local in-memory HTTP, 5-sample browser timings, no WAN or multi-user soak.'],
 ['Accessibility and UX', 'Keyboard-driven creation/edit path, responsive 390px journey, sensible empty states and inline errors.', 'Contrast violation on 136 nodes, modal focus escape, misleading mail status label.'],
 ['Documentation and packaging', 'README, policies, migrations, CI/Docker files and prior reports are present and consistent with tested behavior.', 'No hosted-CI status, production TLS review or independent code audit.'],
]

score_rows = [
 ['Category', 'Max', 'Earlier', 'Fresh', 'Evidence behind the fresh number'],
 ['Accounts, roles and access', '12', '12', '7', 'Direct boundaries pass; staff-to-admin reset path and secret projection fail.'],
 ['Catalog, variants, plans, rules', '13', '13', '12', 'Creation, validation and rule application pass; admin selection truncates at 100.'],
 ['Subscription lifecycle and quotations', '13', '12', '12', 'Lifecycle, conversion and prospective amendments hold in tested scenarios.'],
 ['Billing, invoices and money', '20', '18', '18', 'Exact arithmetic, duplicates, retry and payment state pass; no gateway processing exists.'],
 ['Payments, PDF and delivery', '9', '9', '9', 'Receipt state, PDF, MIME attachment and retry passed; provider/TLS not claimed.'],
 ['Customer self-service', '6', '6', '6', 'Ownership scoping, owned-field editing and mobile layout passed.'],
 ['Finance, scale and performance', '7', '6', '6', 'Sub-two-second local samples and bounded reads; no multi-user or WAN soak.'],
 ['Architecture and maintainability', '5', '3', '3', 'Real REST/data model and docs; monolithic frontend and deployment limitations remain.'],
 ['Testing and correctness', '6', '6', '5', 'Many suites pass, but the key cross-role reset regression was absent.'],
 ['Security and operations', '5', '4', '4', 'Hardening and backup pass; localStorage tokens and deployment proof remain.'],
 ['UX, accessibility and docs', '4', '4', '3', 'Strong visual preservation, but contrast, focus and transport-label defects remain.'],
 ['Total', '100', '93', '85', 'Security finding wins over an otherwise improved product.'],
]

def trace_block():
    add_table(trace_rows, [1.45, 3.5, 1.85], size=8)

def score_block():
    add_table(score_rows, [1.75, 0.5, 0.6, 0.55, 3.4], size=8)

def register_block():
    rows = [['ID', 'Check', 'Expected', 'Observed / status']]
    for c in register:
        observed = c['actual'] if c['status'] != 'PASS' else 'Expected result observed'
        observed = str(observed).replace('\n', ' ')
        rows.append([c['id'], c['title'], c['expected'], f"{observed[:520]}" + ('…' if len(observed) > 520 else '')])
    add_table_safe(rows, [0.62, 1.35, 1.75, 3.0])

def add_table_safe(rows, widths):
    table = doc.add_table(rows=0, cols=len(widths)); table.style = 'Table Grid'; table.autofit = False
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for ci, val in enumerate(row):
            cells[ci].width = Inches(widths[ci]); cells[ci].text = ''
            para = cells[ci].paragraphs[0]; para.paragraph_format.space_after = Pt(1)
            rr = para.add_run(str(val)); rr.font.size = Pt(7.2)
            if ri == 0: rr.bold = True
            if ri == 0: shade(cells[ci], 'E3F0EA')
            elif ri % 2 == 0: shade(cells[ci], 'F7FAF8')

reg = re.findall(r'✔ (.*?) \(\d', (BASE / 'logs/quality-gate.txt').read_text())
def regression_block():
    rows = [['#', 'Case executed in the fresh quality gate']]
    for i, x in enumerate(reg, 1):
        rows.append([i, x])
    add_table(rows, [0.4, 6.4], size=7.6)

fig_used = set()
lines = MD.splitlines(); i = 0; in_code = False
skip_title = True
while i < len(lines):
    line = lines[i]
    if line.startswith('```'):
        in_code = not in_code; i += 1; continue
    if in_code:
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(0)
        r = p.add_run(line); r.font.name = 'Consolas'; r.font.size = Pt(8.2)
        i += 1; continue
    if line.startswith('[['):
        marker = line.strip()
        m = re.match(r'\[\[FIG:([^|]+)\|(.*)\]\]', marker)
        if m:
            name, cap = m.groups()
            path = FIGDIR / name
            if path.exists():
                figure(path, cap)
            else:
                raise SystemExit(f'missing figure {path}')
        elif 'PERFORMANCE_TABLES' in marker:
            perf_block()
        elif 'TRACEABILITY' in marker:
            trace_block()
        elif 'SCORECARD' in marker:
            score_block()
        elif 'CHECK_REGISTER' in marker:
            register_block()
        elif 'REGRESSION_REGISTER' in marker:
            regression_block()
        i += 1; continue
    if line.startswith('# ') and skip_title:
        skip_title = False; i += 1; continue
    if line.startswith('# '):
        if line[2:].strip() != 'Brightloop':
            doc.add_page_break()
        doc.add_heading(line[2:].strip(), level=1)
    elif line.startswith('## '):
        doc.add_heading(line[3:].strip(), level=2)
    elif line.startswith('### '):
        doc.add_heading(line[4:].strip(), level=3)
    elif line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            row = [x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', x or '') for x in row):
                rows.append(row)
            i += 1
        if not rows: continue
        n = len(rows[0])
        if n == 2: widths = [2.0, 4.8]
        elif n == 3: widths = [1.5, 3.4, 1.9]
        elif n == 4: widths = [1.35, 2.05, 1.0, 2.4]
        elif n == 5: widths = [1.6, 0.6, 0.65, 0.6, 3.35]
        else: widths = [6.8 / n] * n
        add_table(rows, widths, size=8)
        continue
    elif re.match(r'^- ', line):
        items = []
        while i < len(lines) and re.match(r'^- ', lines[i]):
            items.append(lines[i][2:]); i += 1
        for t in items:
            p = doc.add_paragraph(style='List Bullet'); p.paragraph_format.space_after = Pt(2)
            inline(p, t)
        continue
    elif line.strip() == '---':
        i += 1; continue
    elif line.strip():
        p = doc.add_paragraph(); inline(p, line)
        if line.startswith('**') and line.endswith('**'):
            p.paragraph_format.space_before = Pt(8)
    i += 1

# Header / footer
hp = sec.header.paragraphs[0]; hp.text = 'BRIGHTLOOP  /  FRESH FUNCTIONAL, INTEGRATION & SECURITY AUDIT'
hp.style = 'Caption'
fp = sec.footer.paragraphs[0]; fp.text = '31 October 2026   •   Snapshot df4ee28   |   Page '
fld = OxmlElement('w:fldSimple'); fld.set(qn('w:instr'), 'PAGE'); fp._p.append(fld)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print('saved', OUT, OUT.stat().st_size)
