from pathlib import Path
import re,html
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parents[1]/'docs';text=(ROOT/'FINAL_EVALUATION.md').read_text()
for name,file in [('DV','DejaVuSans.ttf'),('DV-Bold','DejaVuSans-Bold.ttf'),('DV-Oblique','DejaVuSans-Oblique.ttf'),('DVMono','DejaVuSansMono.ttf')]:
 fontpath=Path('/usr/share/fonts/truetype/dejavu')/file
 if not fontpath.exists(): fontpath=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
 pdfmetrics.registerFont(TTFont(name,str(fontpath)))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DV-Bold',italic='DV-Oblique',boldItalic='DV-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyDV',fontName='DV',fontSize=8.4,leading=12.6,spaceAfter=7,textColor=colors.HexColor('#263640'),splitLongWords=True))
styles.add(ParagraphStyle(name='H1DV',fontName='DV-Bold',fontSize=21,leading=27,spaceAfter=15,textColor=colors.HexColor('#0c574d')))
styles.add(ParagraphStyle(name='H2DV',fontName='DV-Bold',fontSize=14,leading=19,spaceBefore=15,spaceAfter=9,textColor=colors.HexColor('#0c574d'),keepWithNext=True))
styles.add(ParagraphStyle(name='H3DV',fontName='DV-Bold',fontSize=10.5,leading=15,spaceBefore=10,spaceAfter=7,textColor=colors.HexColor('#183e45'),keepWithNext=True))
styles.add(ParagraphStyle(name='CellDV',fontName='DV',fontSize=7.2,leading=10.4,spaceAfter=1,splitLongWords=True))
styles.add(ParagraphStyle(name='CodeDV',fontName='DVMono',fontSize=7,leading=10,spaceAfter=3,splitLongWords=True,backColor=colors.HexColor('#eef3f5')))
def fmt(s):
 s=html.escape(s.strip())
 s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
 s=re.sub(r'`([^`]+)`',r'<font name="DVMono">\1</font>',s)
 s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<i>\1</i>',s)
 return s
story=[]
doc=Document(); sec=doc.sections[0];sec.top_margin=Inches(.7);sec.bottom_margin=Inches(.65);sec.left_margin=Inches(.65);sec.right_margin=Inches(.65)
normal=doc.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(10);normal.paragraph_format.space_after=Pt(6)
for sty in ['Title','Heading 1','Heading 2','Heading 3']:
 doc.styles[sty].font.color.rgb=RGBColor.from_string('0C574D')
header=sec.header.paragraphs[0];header.text='BRIGHTLOOP  /  INDEPENDENT ENGINEERING REVIEW';header.style='Caption'
f=sec.footer.paragraphs[0];f.text='31 October 2026  •  Final self-assessment 93 / 100  |  Page '
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');f._p.append(fld)
def clean(s): return re.sub(r'\*\*|`','',s).strip('*')
def add_runs(p,s):
 parts=re.split(r'(\*\*.*?\*\*|`[^`]+`)',s)
 for part in parts:
  r=p.add_run(part[2:-2] if part.startswith('**') else part[1:-1] if part.startswith('`') else part)
  if part.startswith('**'):r.bold=True
  if part.startswith('`'):r.font.name='Consolas';r.font.size=Pt(8)
lines=text.splitlines();i=0;code=False
while i<len(lines):
 line=lines[i]
 if line.startswith('```'):code=not code;i+=1;continue
 if not line.strip():i+=1;continue
 if code:
  story.append(Paragraph(html.escape(line),styles['CodeDV']));p=doc.add_paragraph();r=p.add_run(line);r.font.name='Consolas';r.font.size=Pt(8);i+=1;continue
 if line.startswith('|'):
  rows=[]
  while i<len(lines) and lines[i].startswith('|'):
   cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
   if not all(re.match(r'^:?-+:?$',c) for c in cells):rows.append(cells)
   i+=1
  n=len(rows[0]);width=481
  if n==4: widths=([105,40,40,296] if rows[0][0]=='Category' else [78,129,48,226])
  elif n==3:widths=[133,131,217]
  elif n==2:widths=[370,111]
  elif n==5:widths=[105,35,40,40,261]
  else:widths=[width/n]*n
  data=[[Paragraph(fmt(c),styles['CellDV']) for c in row] for row in rows]
  t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
  t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e0efea')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#cbd6d8')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f6f8f9')])]))
  story.extend([t,Spacer(1,8)])
  wt=doc.add_table(rows=1,cols=n);wt.style='Light Shading Accent 1'
  for j,c in enumerate(rows[0]):add_runs(wt.rows[0].cells[j].paragraphs[0],c)
  for row in rows[1:]:
   cells=wt.add_row().cells
   for j,c in enumerate(row):add_runs(cells[j].paragraphs[0],c)
  for row in wt.rows:
   for cell in row.cells:
    for p in cell.paragraphs:
     for r in p.runs:r.font.size=Pt(8)
  continue
 if line.startswith('# '):
  story.append(Paragraph(fmt(line[2:]),styles['H1DV']));doc.add_heading(clean(line[2:]),0)
 elif line.startswith('## '):
  story.append(Paragraph(fmt(line[3:]),styles['H2DV']));doc.add_heading(clean(line[3:]),1)
 elif line.startswith('### '):
  story.append(Paragraph(fmt(line[4:]),styles['H3DV']));doc.add_heading(clean(line[4:]),2)
 else:
  para=line.strip();i+=1
  while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','- ','```')) and not re.match(r'^\d+\. ',lines[i]):
   para+=' '+lines[i].strip();i+=1
  bullet=para.startswith('- ')
  if bullet:para=para[2:]
  story.append(Paragraph(('• ' if bullet else '')+fmt(para),styles['BodyDV']))
  p=doc.add_paragraph(style='List Bullet' if bullet else None);add_runs(p,para)
  continue
 i+=1
pdf=SimpleDocTemplate(str(ROOT/'Brightloop_Final_Evaluation.pdf'),pagesize=(595.28,841.89),rightMargin=57,leftMargin=57,topMargin=54,bottomMargin=47,title='Brightloop — Final Engineering Evaluation',author='Independent Engineering Evaluation')
def page(canvas,document):
 canvas.saveState();canvas.setStrokeColor(colors.HexColor('#cbd6d8'));canvas.line(57,807,538,807);canvas.setFont('DV',7);canvas.setFillColor(colors.HexColor('#627078'));canvas.drawString(57,817,'BRIGHTLOOP  /  ENGINEERING JURY REVIEW');canvas.drawRightString(538,817,'31 OCTOBER 2026');canvas.drawString(57,29,'Baseline 76 → Final 93 / 100 • Engineering self-assessment');canvas.drawRightString(538,29,str(document.page));canvas.restoreState()
pdf.build(story,onFirstPage=page,onLaterPages=page);doc.save(ROOT/'Brightloop_Final_Evaluation.docx')
print('Created PDF and DOCX')
