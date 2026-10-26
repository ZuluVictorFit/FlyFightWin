/* Fly Fight Win | Athletic lifting, weeks 7-28.
   Do not replace the original running, VDOT, PT, or log functions.
   Existing storage: blueline.log.v2 / blueline3.  */
(function(){
'use strict';
const PRESS={
7:[3,5,72],8:[2,5,62],9:[3,5,75],10:[3,4,77],11:[3,4,80],12:[2,4,65],
13:'test',14:[3,5,70],15:[3,5,73],16:[2,4,65],
17:[3,4,75],18:[3,4,77],19:[3,3,80],20:[2,3,65],
21:[3,3,80],22:[3,3,82],23:[2,3,77],24:[2,3,62],
25:[3,3,75],26:[3,3,78],27:[3,3,80],28:[2,3,65]};
const LOWER={
7:['sq',3,4,72],8:['sq',2,3,62],9:['sq',3,4,75],10:['hi',3,4,70],
11:['sq',3,3,78],12:['hi',2,3,62],
13:['sq','test'],14:['hi','test'],15:['sq',3,4,72],16:['hi',2,4,60],
17:['sq',3,4,75],18:['hi',3,3,75],19:['sq',3,3,78],20:['hi',2,3,62],
21:['sq',3,3,80],22:['hi',3,3,80],23:['sq',3,2,82],24:['sq',2,3,62],
25:['hi',3,3,75],26:['sq',3,3,78],27:['hi',3,3,78],28:['sq',2,3,65]};
const REDUCED=new Set([8,12,16,20,24,28]);
const PHASES=[[7,8,'Transition'],[9,12,'Strength and power'],[13,16,'New lift cycle'],[17,20,'Strength-speed'],[21,24,'Test preparation'],[25,28,'Maintenance']];
const phase=w=>(PHASES.find(p=>w>=p[0]&&w<=p[1])||PHASES[PHASES.length-1])[2];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;','"':'&quot;'}[c]));
const round5=x=>Math.round(x/5)*5;
function athlete(w){return LOG[w];}
function sel(w,key,fallback){return (athlete(w).athleticChoice||{})[key]||fallback;}
function pressName(w,week){return week<13?'Incline barbell bench press':sel(w,'press','flat')==='close'?'Close-grip bench press':'Flat barbell bench press';}
function squatName(w,week){if(week<13)return w==='z'?'Back squat':'High-bar back squat';return sel(w,'squat',w==='z'?'ssb':'front')==='ssb'?'Reverse SSB squat':'Front squat';}
function hingeName(w,week){return week<13?(w==='z'?'Trap-bar deadlift':'Barbell Romanian deadlift'):'Conventional barbell deadlift';}
function liftName(w,p,week){return p==='pr'?pressName(w,week):p==='sq'?squatName(w,week):hingeName(w,week);}
function trainingMax(w,p,week){
 if(week<13){
   if(w==='h'&&p==='hi')return null;
   return latestWM(w,week,p);
 }
 return latestWM(w,week,p);
}
function store3RM(w,p,v){
 const a=athlete(w);a.rm3=a.rm3||{};a.rm3[3]=a.rm3[3]||{};
 a.mx=a.mx||{};a.mx[3]=a.mx[3]||{};
 a.rm3[3][p]=v;a.mx[3][p]=Math.round(v*1.08);
 if(a.ro&&a.ro[17])delete a.ro[17][p];
 if(a.mx[4])delete a.mx[4][p];
 saveLog();drawAll();render();updateReference();
}
function block(key,name,dose,note){
 return '<div class="blk"><div class="blk-k">'+esc(key)+'</div><p class="mv">'+esc(name)+'</p><div class="dose">'+dose+'</div>'
 +(note?'<div class="cue">'+esc(note)+'</div>':'')+'</div>';
}
function warm(day){
 if(day==='MON')return block('PREP','5 min easy cardio','Scapular push-up 1×10 · band pull-apart 1×15 · press ramp-up sets');
 if(day==='WED')return block('PREP','5 min easy cardio','Leg swings 10/side · ankle rocks 10/side · squat/hinge ramp-up sets');
 return block('PREP','5 min easy movement','Lateral shuffle 2×10 yd · arm circles 10/side · 2 light power-movement practice sets');
}
function main(w,p,week,rx){
 const name=liftName(w,p,week);
 if(rx==='test'){
   const got=athlete(w).rm3&&athlete(w).rm3[3]&&athlete(w).rm3[3][p];
   return block('B · MAIN · 3RM',name,'Work to a technical 3RM · 3-4 min between attempts. '+(got?'Saved: '+got+' lb, TM '+Math.round(got*1.08)+' lb.':'Enter result under Log > Athletic strength.'));
 }
 const [sets,reps,pct]=rx,tm=trainingMax(w,p,week);
 let dose=sets+' × '+reps+' @ '+pct+'% training max · 2-3 min rest · 2-3 RIR';
 if(tm) dose+=' · <strong>'+round5(tm*pct/100)+' lb</strong> (TM '+tm+' lb)';
 else dose+=' · use 2-3 RIR until this exact lift has a tested max';
 return block('B · MAIN',name,dose);
}
function monday(w,week){
 const red=REDUCED.has(week),v=red?2:3;
 let h=warm('MON');
 h+=block('A · POWER',w==='h'?'VOLTRA standing explosive chest press, Damper Mode':week>=13?'Explosive push-up or med-ball chest pass':'Med-ball chest pass or explosive push-up',
    (red?2:3)+' × '+(w==='h'?'4/side':'3')+' · fast concentric, controlled reset · 75-90s rest',
    w==='h'?'Start Damper level 2/10, adjust for speed. Cable return under control.':'Full reset between throws or plyometric reps.');
 h+=main(w,'pr',week,PRESS[week]);
 h+=block('C1 · VERTICAL PULL',w==='z'?'Pull-up or lat pulldown':'Lat pulldown or assisted pull-up',v+' × 6-8 · 2 RIR');
 h+=block('C2 · ANTI-EXTENSION',week<=8?'Ab wheel rollout':week<=12?'Body saw':week<=16?'Ab wheel rollout':week<=20?'Stir-the-pot or ab wheel':'Ab wheel rollout',v+' × '+(week>=9&&week<=12?'20-30 sec':'6-8')+' · 60-90s after each C1/C2 round');
 h+=block('D1 · HORIZONTAL PULL','Single-arm DB row or VOLTRA cable row',(red?1:2)+' × 8/side · 2-3 RIR');
 h+=block('D2 · TEST PRACTICE','Regular push-ups',(red?1:2)+' × 8-15 @ 3 RIR · 60-90s after each D1/D2 round');
 return h;
}
function wednesday(w,week){
 const row=LOWER[week],p=row[0],red=REDUCED.has(week),n=red?1:2;
 let h=warm('WED');
 h+=block('A · POWER','Vertical jump or low box jump',(red?2:3)+' × 3 · full reset · 75-90s rest');
 h+=main(w,p,week,row[1]==='test'?'test':row.slice(1));
 h+=block('C1 · UNILATERAL','DB reverse lunge or DB step-up',n+' × 6/leg @ 3 RIR · DBs at sides, or goblet load');
 h+=block('C2 · ANTI-ROTATION','Pallof press, cable or VOLTRA',n+' × 10/side · 75-90s after C1/C2 round');
 h+=block('D · LOWER LEG','Standing calf raise',n+' × 12 @ 3 RIR · 60s rest');
 return h;
}
function friday(w,week){
 const red=REDUCED.has(week),n=red?2:3,access=red?1:2;
 let h=warm('FRI');
 const power=w==='z'?(week>=13&&week<=16?'Hang clean pull':'Hang power clean or clean pull'):'VOLTRA explosive standing cable row, Damper Mode';
 h+=block('A · POWER',power,n+' × '+(w==='z'?'2':'4/side')+' · full reset · 90-120s rest',w==='z'?'Technical load at RPE 6-7; do not grind.':'Start Damper 2/10; adjust for repeatable speed and controlled return.');
 h+=block('B · PRESS / ROTATION',w==='z'?'Jammer arm press':'VOLTRA rotational press, Damper Mode',n+' × '+(w==='z'?'5':'5/side')+' · fast concentric · 90s rest',w==='z'?'Moderate load, RPE 6-7.':'Stable stance; rotate without forcing end range.');
 h+=block('C · FRONTAL PLANE',week>=13&&week<=16?'Lateral lunge':w==='z'?'Lateral bound + stick':'Lateral step + stick',access+' × '+(week>=13&&week<=16?'6/side':w==='z'?'3/side':'4/side')+' · 60-75s rest');
 h+=block('D · CARRY',w==='h'?'DB suitcase carry':week>=17&&week<=20?'Front-rack carry':week>=13&&week<=16?'Suitcase carry':'Farmer carry',access+' × '+(w==='h'?'25 yd/side':'30 yd')+' · posture intact · 75s rest');
 let trunk=week<=8?'Hanging knee raise or reverse crunch':week<=12?'Controlled Russian twist or cable chop':week<=16?'Reverse crunch':week<=20?'Hanging leg raise or knee raise':week<=24?'Ab wheel or reverse crunch':'Hanging knee raise';
 h+=block('E1 · TRUNK',trunk,access+' × '+(trunk.includes('twist')?'8/side':trunk.includes('wheel')?'6-8':'10')+' · controlled');
 const target=w==='z'?(week<13?'14-16':week<21?'16-18':'18'):(week<13?'8-10':week<21?'10-12':'12-14');
 h+=block('E2 · TEST PRACTICE','Regular 1-minute sit-up technique',(red?1:2)+' × 20 sec · '+target+' reps per set · 40s between sets');
 return h;
}
function view(){
 const week=Number(state.wk),day=state.day;
 if(week<7||week>28||!['MON','WED','FRI'].includes(day))return;
 const fn=day==='MON'?monday:day==='WED'?wednesday:friday;
 document.getElementById('zBody').innerHTML=fn('z',week);
 document.getElementById('hBody').innerHTML=fn('h',week);
 const t=day==='MON'?'Upper strength and power':day==='WED'?'Lower strength and power':'Athletic development';
 document.getElementById('dayTheme').textContent=t;
 document.getElementById('sessName').textContent=t;
 document.getElementById('dayTag').textContent=day==='FRI'?'Power and movement':'Strength';
 document.getElementById('dayWhy').textContent='Run program unchanged. Strength and explosive work are kept submaximal to manage fatigue.';
 const s=document.getElementById('statusLine');
 s.innerHTML='<b>Week '+week+'</b> · Athletic lifting: '+phase(week)+' · Mon upper / Wed lower / Fri athletic. Runs unchanged.';
}
function athleticLog(){
 const root=document.getElementById('p-log');
 if(!root)return;
 let section=document.getElementById('athletic-log');
 if(!section){
   section=document.createElement('section');section.id='athletic-log';section.className='athletic-log';
   const legacy=document.getElementById('liftLog');
   legacy.parentNode.insertBefore(section,legacy);
   const wrap=document.createElement('details');wrap.className='athletic-archive';
   const summary=document.createElement('summary');summary.textContent='Previous strength calibration and historical tests';
   wrap.appendChild(summary);legacy.parentNode.insertBefore(wrap,legacy);wrap.appendChild(legacy);
 }
 const who=LOG.who,P=athlete(who),label=who==='z'?'Zack':'Hannah';
 const c=P.athleticChoice||{};
 let html='<h3>Athletic strength · '+label+'</h3><p>Original Week 1 maxes and running logs are preserved. Week 13 introduces new lift 3RMs; the site calculates training maxes and all later loads.</p>';
 html+='<div class="athletic-original">Original 3RMs: Incline '+INITIAL_3RM[who].pr+' lb · Squat '+INITIAL_3RM[who].sq+' lb · Trap bar '+INITIAL_3RM[who].hi+' lb</div>';
 html+='<div class="athletic-choices"><label>New press <select data-athletic-choice="press"><option value="flat"'+(c.press!=='close'?' selected':'')+'>Flat bench</option><option value="close"'+(c.press==='close'?' selected':'')+'>Close-grip bench</option></select></label>';
 html+='<label>New squat <select data-athletic-choice="squat">'+(who==='z'?'<option value="ssb"'+(c.squat!=='front'?' selected':'')+'>Reverse SSB</option>':'')+'<option value="front"'+(c.squat==='front'||who==='h'?' selected':'')+'>Front squat</option></select></label></div>';
 for(const p of ['pr','sq','hi']){
   const val=P.rm3&&P.rm3[3]&&P.rm3[3][p],tm=trainingMax(who,p,13);
   html+='<form class="athletic-3rm" data-athletic-pat="'+p+'"><label>'+esc(liftName(who,p,13))+' · 3RM (lb) <input type="number" min="1" step="1" required value="'+(val||'')+'"></label><button type="submit">Save</button><span>'+(tm?'TM '+tm+' lb':'Not tested')+'</span></form>';
 }
 html+='<p class="athletic-small">No manual % calculations. Week 9/17 rep results already logged in the old system remain in the preserved calibration records below.</p>';
 section.innerHTML=html;
}
function updateReference(){
 const p=document.getElementById('p-lift');if(!p)return;
 const t=p.querySelector('h3');if(t)t.textContent='Athletic strength program';
 const intro=p.querySelector('p');if(intro)intro.textContent='Running is unchanged. Two strength days and one athletic day from Week 7. New primary variations start Week 13. Use Log to enter the new 3RMs.';
 const phases=document.getElementById('phaseTable');
 if(phases)phases.innerHTML=PHASES.map(x=>'<tr><td>'+x[0]+'-'+x[1]+'</td><td>'+x[2]+'</td><td>Fast concentric, controlled descent</td><td>Rotate assistance by phase</td></tr>').join('');
 const load=document.getElementById('loadTable');
 if(load)load.innerHTML=Object.keys(PRESS).map(k=>{
   const w=Number(k),pr=PRESS[w],l=LOWER[w];
   const ptxt=pr==='test'?'New press 3RM':pr[0]+'×'+pr[1]+' @ '+pr[2]+'%';
   const ltxt=l[1]==='test'?'New '+(l[0]==='sq'?'squat':'hinge')+' 3RM':l[0].toUpperCase()+' '+l[1]+'×'+l[2]+' @ '+l[3]+'%';
   return '<tr><td class="num">'+w+'</td><td>'+phase(w)+'</td><td>'+ptxt+'</td><td>'+ltxt+'</td></tr>';
 }).join('');
 const table=document.getElementById('maxTable');
 if(table)table.innerHTML=['z','h'].map(w=>['pr','sq','hi'].map(p=>{
   const pre=INITIAL_3RM[w][p],wm=latestWM(w,Math.max(13,state.wk),p);
   return '<tr><td>'+(w==='z'?'Zack':'Hannah')+'</td><td>'+esc(liftName(w,p,13))+'</td><td>'+pre+' lb (Week 1 original)</td><td>'+(wm?wm+' lb':'New 3RM pending')+'</td></tr>';
 }).join('')).join('');
}
document.addEventListener('submit',e=>{
 const form=e.target.closest('form.athletic-3rm');if(!form)return;
 e.preventDefault();const n=Number(form.querySelector('input').value);
 if(!Number.isFinite(n)||n<=0)return;
 store3RM(LOG.who,form.dataset.athleticPat,n);athleticLog();
});
document.addEventListener('change',e=>{
 const el=e.target.closest('[data-athletic-choice]');if(!el)return;
 const who=LOG.who,p=el.dataset.athleticChoice==='press'?'pr':'sq',P=athlete(who);
 if(P.rm3&&P.rm3[3]&&P.rm3[3][p]&&!confirm('Changing the lift will clear its recorded 3RM. Continue?')){athleticLog();return;}
 P.athleticChoice=P.athleticChoice||{};P.athleticChoice[el.dataset.athleticChoice]=el.value;
 if(P.rm3&&P.rm3[3])delete P.rm3[3][p];if(P.mx&&P.mx[3])delete P.mx[3][p];if(P.mx&&P.mx[4])delete P.mx[4][p];
 if(P.ro&&P.ro[17])delete P.ro[17][p];
 saveLog();athleticLog();render();updateReference();
});
const css=document.createElement('style');
css.textContent='.athletic-log{padding:14px;margin:14px 0;border:1px solid var(--line);background:var(--panel-2);border-radius:8px}.athletic-log h3{margin:0 0 6px;font-size:15px}.athletic-log p{font-size:12px;color:var(--ink-2)}.athletic-original{font-size:12px;margin-bottom:10px}.athletic-choices{display:flex;gap:10px;flex-wrap:wrap}.athletic-choices label,.athletic-3rm label{font-size:12px}.athletic-choices select,.athletic-3rm input{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:5px;padding:5px}.athletic-3rm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.athletic-3rm input{width:75px}.athletic-3rm button{padding:5px 10px;border:1px solid var(--line);border-radius:5px;background:var(--ink);color:var(--panel)}.athletic-3rm span,.athletic-small{font-size:12px;color:var(--ink-2)}.athletic-archive{margin-top:10px}.athletic-archive summary{cursor:pointer;font-size:12px;color:var(--ink-2)}';
document.head.appendChild(css);
const oldRender=render;
render=function(){oldRender();view();};
const oldDraw=drawAll;
drawAll=function(){oldDraw();athleticLog();updateReference();};
athleticLog();updateReference();view();
})();