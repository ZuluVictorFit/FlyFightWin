"""Rebuild public program data from the approved PDF (PyMuPDF required).
Usage: python3 scripts/extract_program.py /private/path/program.pdf
Only program prescriptions are extracted. Never pass athlete backups here.
"""
import sys,re,json,hashlib
from pathlib import Path
import fitz
pdf=Path(sys.argv[1]); doc=fitz.open(pdf)
assert len(doc)==54
program={'id':'athletic-strength-8-v1','blockId':'athletic-strength-8','version':1,'weeks':8,'changeHistory':[],'paceDefaults':{'z':{'value':47.2,'source':'Approved PDF · VDOT 47.2; choose a historical test explicitly.','autoNewTests':False},'h':{'value':None,'source':'Awaiting the approved block two-mile test. No result has been invented.','autoNewTests':True}},'sourceSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'overview':[], 'sessions':[]}
for i,p in enumerate(doc):
 lines=[(l['bbox'], ''.join(s['text'] for s in l['spans'])) for b in p.get_text('dict')['blocks'] for l in b.get('lines',[])]
 if i<6:
  program['overview'].append({'page':i+1,'text':p.get_text()});continue
 header=next(t for b,t in lines if 'WEEK ' in t)
 week=int(re.search(r'WEEK (\d)',header)[1]);day=header.split('|')[1].strip().title()
 title=next(t for b,t in lines if b[0]<50 and 40<b[1]<45)
 note=' '.join(t for b,t in lines if 270<b[0]<1000 and b[1]>620)
 for athlete,offset in [('z',0),('h',543.5)]:
  ls=[(b,t) for b,t in lines if 50+offset<=b[0]<570+offset and 165<b[1]<610]
  # Each SETS column starts a row, including wrapped WORK labels.
  starts=sorted(b[1] for b,t in ls if abs(b[0]-(269.1+offset))<1)
  rows=[]
  for order,y in enumerate(starts):
   cells=['']*5
   end=starts[order+1]-.5 if order+1<len(starts) else 610
   for b,t in ls:
    if y-.5<=b[1]<end:
     x=b[0]-offset
     col=0 if x<90 else 1 if x<265 else 2 if x<310 else 3 if x<433 else 4
     cells[col]+=(' ' if cells[col] else '')+t
   group,name,sets,dose,intensity=cells;group=group.replace('WOR K','WORK')
   assert all(cells),(i,cells)
   n=sum(map(int,sets.split('+')))
   parts=intensity.rsplit('|',1);effort=parts[0].strip();rest=parts[1].strip() if len(parts)>1 else ''
   slug=re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
   warm=group in ['PREP','WU','CD']
   top=re.search(r'Top (\d+) \+ (\d+)x(\d+)',dose)
   back=re.search(r'back (\d+)(?:-(\d+))?%',effort)
   rir=re.search(r'(\d+)(?:-(\d+))? RIR',effort)
   rpe=re.search(r'RPE (\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?',effort)
   reps=re.match(r'(\d+)(?:-(\d+))?\s*(?:reps|/|jumps)',dose)
   device='VOLTRA' in name
   bodyweight=name in ['Ab wheel rollout','Regular push-up','Hanging knee raise','Reverse crunch / hanging knee raise','Regular sit-up cadence','Lateral bound + stick','Lateral step + stick','Low box jump','Sliding hamstring curl (optional)','Sorinex glute ham roller curl (optional)']
   loadUnit='bodyweight' if bodyweight else 'device setting' if device else 'lb per hand' if re.search('dumbbell|DB ',name,re.I) else 'lb added / assistance' if name=='Pull-up' else 'lb total'
   rows.append({'id':f'{group.lower()}-{slug}', 'exerciseId':slug,'name':name,'group':group,'order':order,'sets':n,'setsText':sets,'prescription':dose,'intensity':effort,'rest':rest,'warmup':warm,'optional':'*' in group,'unilateral':bool(re.search(r'/\s*(side|leg)',dose)), 'loadUnit':loadUnit,'device':device,'kind':'run' if day in ['Tuesday','Thursday','Saturday'] else 'strength','repRange':[int(reps[1]),int(reps[2] or reps[1])] if reps else None,'rir':int(rir[1]) if rir else None,'rpeCap':float(rpe[2] or rpe[1]) if rpe else None,'top':{'reps':int(top[1]),'backSets':int(top[2]),'backReps':int(top[3]),'backPercent':[int(back[1]),int(back[2] or back[1])]} if top else None})
  program['sessions'].append({'id':f'athletic-strength-8:w{week}-{day.lower()}-{athlete}','week':week,'day':day,'athlete':athlete,'title':title,'restDay':False,'note':note,'sourcePage':i+1,'reduced':week in [4,8],'exercises':rows})
for w in range(1,9):
 for a in ['z','h']:program['sessions'].append({'id':f'athletic-strength-8:w{w}-sunday-{a}','week':w,'day':'Sunday','athlete':a,'title':'Rest','restDay':True,'note':'Off. No makeup sessions.','sourcePage':1,'reduced':w in [4,8],'exercises':[]})
Path('data/program.json').write_text(json.dumps(program,indent=2)+'\n')
print(f'{len(program["sessions"])} sessions; {sum(len(s["exercises"]) for s in program["sessions"])} prescription rows')
# Compact full review: unique rows and all week-specific doses.
for day in ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:
 print('\n'+day)
 for a in ['z','h']:
  ss=[s for s in program['sessions'] if s['day']==day and s['athlete']==a]
  for index,e in enumerate(ss[0]['exercises']):
   print(a,e['group'],e['name'],e['rest'])
   for s in ss:
    r=s['exercises'][index] if index<len(s['exercises']) else None
    print(s['week'],r and [r['name'],r['setsText'],r['prescription'],r['intensity']])
