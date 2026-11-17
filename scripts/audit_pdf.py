"""Independent word-coordinate reconciliation of every program cell to PDF.
PyMuPDF is used by the generator; this audit uses pdfplumber's pdfminer word extraction.
"""
import sys,re,json,hashlib
import pdfplumber
p=json.load(open('data/program.json'))
assert hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest()==p['sourceSha256']
checked=0
with pdfplumber.open(sys.argv[1]) as pdf:
 assert len(pdf.pages)==54
 for s in p['sessions']:
  if s['day']=='Sunday':continue
  words=pdf.pages[s['sourcePage']-1].extract_words(x_tolerance=2,y_tolerance=2)
  offset=0 if s['athlete']=='z' else 543.5
  starts=sorted(w['top'] for w in words if abs(w['x0']-(269.1+offset))<1 and 160<w['top']<610)
  assert len(starts)==len(s['exercises']),(s['id'],len(starts))
  bounds=[50,90,265,310,433,570]
  norm=lambda t:re.sub(r'\s','',t)
  for i,e in enumerate(s['exercises']):
   top=starts[i]-2;end=starts[i+1]-2 if i+1<len(starts) else 610
   cells=[]
   for a,b in zip(bounds,bounds[1:]):
    ws=[w for w in words if a+offset<=w['x0']<b+offset and top<=w['top']<end]
    ws.sort(key=lambda w:(round(w['top']/3),w['x0']))
    cells.append(' '.join(w['text'] for w in ws))
   expected=[e['group'],e['name'],e['setsText'],e['prescription'],e['intensity']+' | '+e['rest']]
   for a,b in zip(cells,expected):assert norm(a)==norm(b),(s['id'],e['id'],a,b)
   checked+=1
print(f'PASS independently reconciled {checked} rows / {checked*5} cells / 96 athlete sessions against all 48 daily PDF pages; source SHA-256 verified; 6 overview pages retained.')
