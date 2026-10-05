"""Check the PDF downloaded by the genuine synthetic browser path; no model I/O."""
import json
import pathlib
import sys
from pypdf import PdfReader
import pdfplumber
import pypdfium2 as pdfium

root = pathlib.Path(sys.argv[1])
data = json.loads((root / 'delivered-synthetic-story.json').read_text())['data']
reader = PdfReader(root / 'delivered-synthetic-story.pdf')
with pdfplumber.open(root / 'delivered-synthetic-story.pdf') as document:
    # Exclude our footer region; page numbers must not interrupt a paragraph spanning two pages.
    text = ''.join(p.crop((0, 0, p.width, p.height - 45)).extract_text() or '' for p in document.pages)
compact = lambda value: ''.join(str(value).split())
m = data['myth']
values = list(data['answers'].values()) + [data['question'], m['title'], m['story']]
values += list(m['mirror'].values()) + m['meaning']
values += [m['one_step'], m['journal_question'], m['disclaimer'], data['note']]
values += [message['content'] for message in data['messages']]
missing = [index for index, value in enumerate(values) if compact(value) not in compact(text)]
assert not missing, f'Saved content missing from PDF: {missing}'
assert '\ufffd' not in text, 'Replacement glyph found'
with pdfplumber.open(root / 'delivered-synthetic-story.pdf') as document:
    overflow = [(index + 1, word['text']) for index, page in enumerate(document.pages)
                for word in page.extract_words()
                if word['x0'] < 0 or word['x1'] > page.width or word['top'] < 0 or word['bottom'] > page.height]
assert not overflow, f'Text outside page: {overflow[:3]}'
render = pdfium.PdfDocument(str(root / 'delivered-synthetic-story.pdf'))
render[0].render(scale=1.4).to_pil().save(root / 'pdf-first-page.png')
result = {'status': 'PASS', 'scope': 'saved_synthetic_content_only', 'pages': len(reader.pages),
          'saved_text_fields_checked': len(values), 'missing_fields': [], 'out_of_page_words': 0,
          'replacement_glyphs': 0}
(root / 'pdf-proof.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
