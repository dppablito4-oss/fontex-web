"""Build the reading pages from the same catalog used by the app and tutor.

Install scripts/requirements-pdf.txt. DejaVu Sans must be installed; override its
directory with FONTEX_FONT_DIR when it is not in the usual Linux font directory.
Run from any directory: python scripts/generate-practice-pdfs.py [lesson-id ...]
"""
import json
import os
from pathlib import Path
import sys
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'supabase/functions/_shared/practice/lessons.json'
FONT_DIR = Path(os.environ.get('FONTEX_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
for name, filename in [('FontexSans', 'DejaVuSans.ttf'), ('FontexBold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))

BODY = ParagraphStyle('Body', fontName='FontexSans', fontSize=11, leading=17,
                      textColor=colors.HexColor('#24272b'), alignment=TA_LEFT, spaceAfter=12)
TITLE = ParagraphStyle('Title', parent=BODY, fontName='FontexBold', fontSize=21,
                       leading=28, spaceAfter=20)
KICKER = ParagraphStyle('Kicker', parent=BODY, fontSize=9, textColor=colors.HexColor('#565b61'))
LEVELS = {'inicial':'Inicial', 'primaria':'Primaria', 'secundaria':'Secundaria',
          'universidad':'Universidad introductoria'}

def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#1800ad'))
    canvas.setFont('FontexBold', 19)
    canvas.drawString(20 * mm, 280 * mm, 'fontex')
    canvas.setStrokeColor(colors.HexColor('#d2d5d7'))
    canvas.line(20 * mm, 274 * mm, 190 * mm, 274 * mm)
    canvas.setFillColor(colors.HexColor('#565b61'))
    canvas.setFont('FontexSans', 8)
    canvas.drawString(20 * mm, 16 * mm, 'Matemática · Guía introductoria de Fontex')
    canvas.drawRightString(190 * mm, 16 * mm, f'Página {doc.page}')
    canvas.restoreState()

def build(lesson):
    story = []
    for index, page in enumerate(lesson['pages']):
        if index:
            story.append(PageBreak())
        story.extend([
            Paragraph(escape(f"{LEVELS[lesson['level']]} · {lesson['grade']}"), KICKER),
            Paragraph(escape(page['heading']), TITLE),
        ])
        for paragraph in page['text'].split('\n\n'):
            story.append(Paragraph(escape(paragraph).replace('\n', '<br/>'), BODY))
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph('Practica', KICKER))
        for number, question in enumerate(lesson['questions'], 1):
            if question['page'] != page['pageNumber']:
                continue
            story.append(Paragraph(escape(f"{number}. {question['text']}"), BODY))
            options = '   ·   '.join(f"{chr(65+i)}) {option}" for i, option in enumerate(question['options']))
            story.append(Paragraph(escape(options), BODY))
    target = ROOT / 'public/demo' / lesson['pdf']
    doc = SimpleDocTemplate(str(target), pagesize=A4, leftMargin=20 * mm,
        rightMargin=20 * mm, topMargin=34 * mm, bottomMargin=25 * mm,
        title=lesson['source'], author='Fontex', pageCompression=1)
    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame,
              canvasmaker=lambda *args, **kwargs: Canvas(*args, **(kwargs | {'invariant': 1})))
    return target

if __name__ == '__main__':
    selected = set(sys.argv[1:])
    lessons = json.loads(CATALOG.read_text(encoding='utf-8'))
    unknown = selected - {lesson['id'] for lesson in lessons}
    if unknown:
        raise SystemExit('Unknown lesson IDs: ' + ', '.join(sorted(unknown)))
    for lesson in lessons:
        if not selected or lesson['id'] in selected:
            print(build(lesson).relative_to(ROOT))
