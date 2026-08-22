import { getProgram, listPrograms } from './program-registry.js';
import { loadState, saveState, newId, downloadBackup, importBackupFile, resetAll, APP_VERSION } from './data-store.js';
import {
  isoDate, prettyDate, timerFmt, secondsFmt, readinessScore, activeInjuries, blockedTags, restrictionMatches,
  estimateSessionSeconds, latestReadiness, advanceProgram, pauseProgram, resumeProgram, weightSeries,
  exerciseHistory, programCompletion, sessionLoadSeries, sessionTrainingLoad
} from './engine.js';
import { cue, tone, completeTone, speak } from './audio.js';
import { lineChart, barChart } from './charts.js';

let state = loadState();
let program = getProgram(state.activeProgramId);
let currentView = 'today';
let runner = null;
let timerController = null;
let wakeLock = null;
let readinessContinuation = null;

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const sheet = document.getElementById('sheet');
const $ = (sel,root=document) => root.querySelector(sel);
const $$ = (sel,root=document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const pct = (n,d) => d ? Math.round((n/d)*100) : 0;
const nowIso = () => new Date().toISOString();

function persist(){ state = saveState(state); }
function currentDay(){ return Math.max(1, Math.min(program.durationDays, Number(state.programState.currentDay)||1)); }
function currentWeek(){ return Math.min(4,Math.max(1,Math.ceil(currentDay()/7))); }
function today(){ return isoDate(); }
function statusChip(){
  const ps=state.programState;
  if(ps.status==='paused') return '<span class="chip warn">PAUSED</span>';
  if(ps.status==='completed') return '<span class="chip good">COMPLETE</span>';
  return '<span class="chip good">ACTIVE</span>';
}
function latestProgramSession(){
  return [...state.sessions].filter(s=>s.kind==='program').sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')))[0]||null;
}
function incompleteSession(kind='program', programDay=currentDay()){
  return [...state.sessions].filter(s=>s.kind===kind&&!s.completedAt&&!s.abandonedAt&&(kind!=='program'||s.programDay===programDay)).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)))[0]||null;
}
function getSessionById(id){return state.sessions.find(s=>s.id===id)||null;}
function getStepRecord(session, stepId){return (session.steps||[]).find(s=>s.stepId===stepId)||null;}
function upsertStepRecord(session,record){
  session.steps=session.steps||[];
  const i=session.steps.findIndex(x=>x.stepId===record.stepId);
  if(i>=0) session.steps[i]={...session.steps[i],...record}; else session.steps.push(record);
}
function activeBlockedTags(){return blockedTags(state);}

async function keepAwake(){
  if(!state.settings.wakeLock || !('wakeLock' in navigator)) return;
  try{ wakeLock = await navigator.wakeLock.request('screen'); }catch{}
}
function releaseWake(){ try{wakeLock?.release();}catch{} wakeLock=null; }

document.addEventListener('visibilitychange',()=>{
  if(!runner)return;
  const session=getSessionById(runner.sessionId);
  if(!session)return;
  if(document.visibilityState==='hidden'){
    closeOpenSegment(session); persist();
  }else{
    const segs=session.segments||[]; const last=segs.length?segs[segs.length-1]:null;
    if(!last||last.end)segs.push({start:nowIso(),end:null});
    session.segments=segs; persist(); keepAwake();
  }
});

function topbar(){
  const ps=state.programState;
  document.getElementById('topbarMeta').innerHTML=`${prettyDate(today())}<br>${ps.status==='paused'?'Program paused':`Day ${currentDay()} / ${program.durationDays}`}`;
}

function setView(view){
  currentView=view;
  $$('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  render();
}
$$('.nav-button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));

function render(){
  topbar();
  if(currentView==='today') app.innerHTML=renderToday();
  else if(currentView==='program') app.innerHTML=renderProgram();
  else if(currentView==='recovery') app.innerHTML=renderRecovery();
  else if(currentView==='metrics') app.innerHTML=renderMetrics();
  else app.innerHTML=renderSettings();
  bindActions(app);
  renderAfter();
}

function bindActions(root){
  $$('[data-action]',root).forEach(el=>el.addEventListener('click',()=>handleAction(el.dataset.action,el.dataset.arg)));
  $$('[data-setting]',root).forEach(el=>el.addEventListener('change',()=>{
    const key=el.dataset.setting;
    state.settings[key]=el.type==='checkbox'?el.checked:(el.type==='number'?Number(el.value):el.value);
    persist();
  }));
}

function handleAction(action,arg){
  const map={
    readiness:()=>openReadiness(), preview:()=>openSessionPreview(Number(arg)||currentDay()), startWorkout:()=>requestProgramStart(),
    startRecovery:()=>openRecoveryPreview(), injuries:()=>openInjuryManager(), pain:()=>openPainLog(), walk:()=>openWalk(),
    pause:()=>openPause(), resume:()=>doResume(), addWeight:()=>openWeight(), exerciseHistory:()=>openExerciseHistory(arg),
    export:()=>downloadBackup(state), import:()=>$('#importFile')?.click(), reset:()=>resetData(), update:()=>forceUpdate(),
    close:()=>closeModal(), dayPreview:()=>openSessionPreview(Number(arg)), history:()=>openSessionHistory(), resolveInjury:()=>resolveInjury(arg)
  };
  map[action]?.();
}

function renderToday(){
  const ps=state.programState, day=currentDay(), week=currentWeek(), goal=program.weekGoals[week];
  const ready=latestReadiness(state,today());
  const injuries=activeInjuries(state);
  const completion=programCompletion(state,program.durationDays);
  const unfinished=incompleteSession('program',day);
  const footRestricted=activeBlockedTags().includes('foot-load');
  const lastSession=[...state.sessions].filter(s=>s.completedAt).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0];

  return `
    ${ps.status==='paused'?`<div class="card warn"><div class="row between"><div><div class="kicker">Program paused</div><h2>Day ${day} is frozen.</h2><p>${esc(ps.pauseReason||'No reason recorded.')}</p></div>${statusChip()}</div><button class="btn good" data-action="resume">Resume program</button></div>`:''}
    ${ps.status==='completed'?`<div class="card good"><div class="kicker">Program complete</div><h2>FOUNDATION / 28 finished.</h2><p>Your full history remains available below and in Metrics.</p></div>`:''}
    <div class="card">
      <div class="row between"><div><div class="kicker">${ps.status==='paused'?'Frozen':'Current prescription'}</div><h2>Day ${day} · Week ${week}</h2></div>${statusChip()}</div>
      <h3>${esc(goal.title)}</h3><p>${esc(goal.goal)}</p>
      <div class="progress"><i style="width:${completion.percent}%"></i></div>
      <div class="small" style="margin-top:8px">${completion.completed} of ${program.durationDays} program sessions completed · ${completion.percent}%</div>
      <div class="spacer12"></div>
      <button class="btn ${unfinished?'good':''}" data-action="${unfinished?'startWorkout':'preview'}" ${ps.status!=='active'?'disabled':''}>${unfinished?'Resume unfinished session':'Preview today’s session'}</button>
    </div>

    <div class="grid2">
      <div class="card tight ${ready?ready.band:''}">
        <div class="kicker">Readiness</div>
        <h3>${ready?`${ready.score}/100`:'Not logged'}</h3>
        <div class="small">${ready?esc(ready.label):'Optional 15-second check'}</div>
        <div class="spacer8"></div><button class="btn secondary" data-action="readiness">${ready?'Update':'Log readiness'}</button>
      </div>
      <div class="card tight ${injuries.length?'warn':''}">
        <div class="kicker">Restrictions</div>
        <h3>${injuries.length?`${injuries.length} active`:'None active'}</h3>
        <div class="small">${injuries.length?`${activeBlockedTags().length} movement tags blocked`:'No movement restrictions'}</div>
        <div class="spacer8"></div><button class="btn secondary" data-action="injuries">Manage</button>
      </div>
    </div>

    <div class="grid2">
      <div class="card tight ${footRestricted?'warn':''}"><div class="kicker">Walking pad</div><h3>${state.settings.walkGoalMinutes} min · ${state.settings.walkSpeedMph} mph</h3><div class="small">${footRestricted?'Foot-loading currently restricted':'Independent cardio block'}</div><div class="spacer8"></div><button class="btn secondary" data-action="walk">Open walk</button></div>
      <div class="card tight"><div class="kicker">Recovery mode</div><h3>Filtered session</h3><div class="small">Automatically excludes blocked movement tags.</div><div class="spacer8"></div><button class="btn secondary" data-action="startRecovery">Open recovery</button></div>
    </div>

    <div class="card">
      <div class="row between"><div><div class="kicker">Pain / issue log</div><h3>Record a symptom without diagnosing it</h3></div><button class="chip" data-action="pain">+ Log</button></div>
      <p class="small">Pain entries can be linked to an exercise, body area, side, intensity, and symptom type. They remain separate from readiness and injury restrictions.</p>
    </div>

    ${lastSession?`<div class="card subtle"><div class="kicker">Most recent completed session</div><div class="row between"><div><h3>${esc(lastSession.kind==='recovery'?'Recovery session':`Program Day ${lastSession.programDay}`)}</h3><div class="small">${prettyDate(lastSession.date)} · ${secondsFmt(lastSession.totalSeconds||0)}${lastSession.rpe?` · RPE ${lastSession.rpe}`:''}</div></div>${lastSession.trainingLoad?`<span class="chip">Load ${lastSession.trainingLoad}</span>`:''}</div></div>`:''}
  `;
}

function renderProgram(){
  const ps=state.programState, day=currentDay();
  let grid='';
  for(let i=1;i<=program.durationDays;i++){
    const session=state.sessions.find(s=>s.kind==='program'&&s.programDay===i&&s.completedAt);
    grid+=`<button class="day ${session?'done':''} ${i===day?'current':''} ${ps.status==='paused'&&i===day?'paused':''}" data-action="dayPreview" data-arg="${i}"><span>D${i}</span><b>${Math.ceil(i/7)}</b></button>`;
  }
  const def=program.buildSession(day), blocked=activeBlockedTags();
  const affected=def.steps.filter(s=>restrictionMatches(s,blocked).restricted).length;
  return `
    <div class="card"><div class="row between"><div><div class="kicker">Program control</div><h2>${esc(program.name)}</h2></div>${statusChip()}</div>
      <p>${esc(program.description)}</p>
      ${ps.status==='active'?`<button class="btn warn" data-action="pause">Pause program</button>`:ps.status==='paused'?`<button class="btn good" data-action="resume">Resume at Day ${day}</button>`:''}
    </div>
    <div class="card tight"><div class="kicker">28-session progression</div><div class="day-grid">${grid}</div><div class="small" style="margin-top:10px">Numbers inside tiles indicate the week. Green = completed; outline = current program day.</div></div>
    <div class="card"><div class="kicker">Current day preview</div><h2>Day ${day} · Week ${Math.ceil(day/7)}</h2><div class="row wrap"><span class="chip">~${secondsFmt(estimateSessionSeconds(def,state.settings.preCountdown))}</span><span class="chip">${def.steps.length} steps</span>${affected?`<span class="chip warn">${affected} restricted</span>`:''}</div><div class="spacer12"></div><button class="btn secondary" data-action="preview" data-arg="${day}">Inspect session</button></div>
  `;
}

function renderRecovery(){
  const injuries=activeInjuries(state), blocked=activeBlockedTags();
  const def=program.buildRecoverySession(blocked);
  const recentPain=[...state.painLogs].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,6);
  return `
    <div class="card"><div class="kicker">Recovery session mode</div><h2>Keep the ritual; remove the load.</h2><p>This mode filters the recovery template against your active restriction tags. Completing it does <strong>not</strong> advance the 28-session program.</p>
      <div class="row wrap"><span class="chip">${def.steps.length} movements</span><span class="chip">~${secondsFmt(estimateSessionSeconds(def,state.settings.preCountdown))}</span>${blocked.length?`<span class="chip warn">${blocked.length} blocked tags respected</span>`:''}</div><div class="spacer12"></div><button class="btn" data-action="startRecovery">Preview recovery session</button>
    </div>
    <div class="card"><div class="row between"><div><div class="kicker">Active injuries / limitations</div><h3>${injuries.length?`${injuries.length} active record${injuries.length===1?'':'s'}`:'No active records'}</h3></div><button class="chip" data-action="injuries">Manage</button></div>
      ${injuries.length?`<div class="list" style="margin-top:10px">${injuries.map(injuryCard).join('')}</div>`:`<p class="small">Add an injury/limitation to create movement restrictions. The app will flag matching exercises; it will not diagnose the injury.</p>`}
    </div>
    <div class="card"><div class="row between"><div><div class="kicker">Recent pain / issues</div><h3>${state.painLogs.length} total entries</h3></div><button class="chip" data-action="pain">+ Log</button></div>
      ${recentPain.length?`<div class="list" style="margin-top:10px">${recentPain.map(p=>`<div class="list-item"><div class="row between"><strong>${esc(p.side||'')} ${esc(p.area)}</strong><span class="chip ${p.intensity>=7?'bad':p.intensity>=4?'warn':''}">${p.intensity}/10</span></div><div class="small">${prettyDate(p.date)} · ${esc(p.type)}${p.exerciseName?` · ${esc(p.exerciseName)}`:''}</div>${p.notes?`<div class="small" style="margin-top:5px">${esc(p.notes)}</div>`:''}</div>`).join('')}</div>`:`<p class="small">No pain/issue entries yet.</p>`}
    </div>
  `;
}

function injuryCard(i){
  return `<div class="list-item restricted"><div class="row between"><div><strong>${esc(i.side||'')} ${esc(i.area)}</strong><div class="small">Severity ${i.severity}/10 · since ${prettyDate(i.date)}</div></div><span class="chip warn">ACTIVE</span></div><div class="small" style="margin-top:6px">Blocks: ${(i.blockedTags||[]).map(esc).join(', ')||'No tags selected'}</div>${i.notes?`<div class="small" style="margin-top:5px">${esc(i.notes)}</div>`:''}<div class="spacer8"></div><button class="btn ghost" data-action="resolveInjury" data-arg="${esc(i.id)}">Mark resolved</button></div>`;
}
function renderMetrics(){
  const weights=weightSeries(state.weights);
  const loads=sessionLoadSeries(state);
  const completed=state.sessions.filter(s=>s.completedAt);
  const programSessions=completed.filter(s=>s.kind==='program');
  const recoverySessions=completed.filter(s=>s.kind==='recovery');
  const totalMinutes=Math.round(completed.reduce((a,s)=>a+(Number(s.totalSeconds)||0),0)/60);
  const latestWeight=weights.length?weights[weights.length-1]:null;
  const firstWeight=weights.length?weights[0]:null;
  const weightChange=latestWeight&&firstWeight?(latestWeight.value-firstWeight.value):null;
  const exerciseOptions=Object.values(program.exercises).filter(e=>!e.id.startsWith('recovery-')).sort((a,b)=>a.name.localeCompare(b.name));
  const recentSessions=[...completed].sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt))).slice(0,8);

  return `
    <div class="grid3">
      <div class="stat"><strong>${programSessions.length}</strong><span>Program sessions</span></div>
      <div class="stat"><strong>${recoverySessions.length}</strong><span>Recovery sessions</span></div>
      <div class="stat"><strong>${totalMinutes}</strong><span>Logged minutes</span></div>
    </div><div class="spacer12"></div>

    <div class="card"><div class="row between"><div><div class="kicker">Body weight</div><h2>${latestWeight?`${latestWeight.value.toFixed(1)} lb`:'No entries'}</h2></div><button class="chip" data-action="addWeight">+ Weight</button></div>
      ${latestWeight?`<div class="row wrap"><span class="chip">7-day avg ${latestWeight.rollingAvg.toFixed(1)} lb</span>${weightChange!==null?`<span class="chip ${weightChange<0?'good':weightChange>0?'warn':''}">${weightChange>0?'+':''}${weightChange.toFixed(1)} lb total</span>`:''}</div><div class="spacer12"></div>${lineChart(weights,{valueKey:'value',avgKey:'rollingAvg',unit:' lb'})}<div class="legend"><span><i></i>Measurement</span><span><i class="dashed"></i>Trailing 7-day mean</span></div>`:`<p class="small">Log weight consistently if you want a trend. The graph emphasizes the trailing seven-calendar-day average rather than individual fluctuations.</p>`}
    </div>

    <div class="card"><div class="kicker">Training load</div><h2>Session-RPE load</h2><p class="small">Calculated as logged session duration in minutes × session RPE. This is a simple internal workload signal, not a medical metric.</p>
      ${barChart(loads.slice(-20),{unit:''})}
      ${loads.length?`<div class="small">Most recent load: ${loads[loads.length-1].value} AU · ${prettyDate(loads[loads.length-1].date)}</div>`:''}
    </div>

    <div class="card"><div class="kicker">Exercise-specific history</div><h2>Performance ledger</h2>
      <div class="field"><label for="exerciseSelect">Exercise</label><select id="exerciseSelect"><option value="">Choose an exercise…</option>${exerciseOptions.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select></div>
      <button class="btn secondary" id="openExerciseHistory" disabled>Open history</button>
    </div>

    <div class="card"><div class="row between"><div><div class="kicker">Recent session timing</div><h3>Automatic duration records</h3></div><button class="chip" data-action="history">All sessions</button></div>
      ${recentSessions.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Session</th><th>Duration</th><th>RPE</th><th>Load</th></tr></thead><tbody>${recentSessions.map(s=>`<tr><td>${prettyDate(s.date)}</td><td>${s.kind==='program'?`Day ${s.programDay}`:'Recovery'}</td><td>${secondsFmt(s.totalSeconds||0)}</td><td>${s.rpe??'—'}</td><td>${s.trainingLoad??'—'}</td></tr>`).join('')}</tbody></table></div>`:`<p class="small">No completed sessions yet.</p>`}
    </div>
  `;
}

function renderSettings(){
  return `
    <div class="card"><div class="kicker">Application</div><h2>FOUNDATION / 28</h2><div class="row wrap"><span class="chip">App ${APP_VERSION}</span><span class="chip">Program ${esc(program.version)}</span><span class="chip">Schema 2</span></div><p class="small" style="margin-top:10px">Pure-black AMOLED interface. Program definitions, training engine, and user data are separate modules.</p></div>

    <div class="card"><div class="kicker">Runner</div>
      <label class="toggle"><span>3-2-1 pre-countdowns</span><input type="checkbox" data-setting="preCountdown" ${state.settings.preCountdown?'checked':''}></label>
      <label class="toggle"><span>Audio tones</span><input type="checkbox" data-setting="tones" ${state.settings.tones?'checked':''}></label>
      <label class="toggle"><span>Spoken audio cues</span><input type="checkbox" data-setting="voiceCues" ${state.settings.voiceCues?'checked':''}></label>
      <label class="toggle"><span>Request screen wake lock</span><input type="checkbox" data-setting="wakeLock" ${state.settings.wakeLock?'checked':''}></label>
      <label class="toggle"><span>Readiness check before program sessions</span><input type="checkbox" data-setting="readinessGate" ${state.settings.readinessGate?'checked':''}></label>
    </div>

    <div class="card"><div class="kicker">Walking pad defaults</div><div class="grid2"><div class="field"><label>Minutes</label><input type="number" min="1" max="240" step="1" data-setting="walkGoalMinutes" value="${state.settings.walkGoalMinutes}"></div><div class="field"><label>Speed (mph)</label><input type="number" min="0.5" max="10" step="0.1" data-setting="walkSpeedMph" value="${state.settings.walkSpeedMph}"></div></div></div>

    <div class="card"><div class="kicker">Backup & restore</div><h3>Local data control</h3><p class="small">Export a complete JSON backup before major app updates. Import replaces the current local database only after validation; a pre-import copy is retained in local storage when possible.</p>
      <button class="btn secondary" data-action="export">Export JSON backup</button><div class="spacer8"></div>
      <button class="btn secondary" id="importButton">Import / restore JSON</button><input id="importFile" class="hidden" type="file" accept="application/json,.json">
    </div>

    <div class="card"><div class="kicker">Installed programs</div>${listPrograms().map(p=>`<div class="list-item"><div class="row between"><div><strong>${esc(p.name)}</strong><div class="small">${esc(p.description)}</div></div><span class="chip">v${esc(p.version)}</span></div></div>`).join('')}<p class="small" style="margin-top:10px">Future programs can be added to <code>js/programs/</code> and registered without changing the storage schema or workout runner.</p></div>

    <div class="card"><div class="kicker">Maintenance</div><button class="btn secondary" data-action="update">Check/reload latest app files</button><div class="spacer8"></div><button class="btn danger" data-action="reset">Erase local training data</button></div>
  `;
}

function renderAfter(){
  if(currentView==='metrics'){
    const select=$('#exerciseSelect'); const btn=$('#openExerciseHistory');
    if(select&&btn){select.addEventListener('change',()=>btn.disabled=!select.value);btn.addEventListener('click',()=>openExerciseHistory(select.value));}
  }
  if(currentView==='settings'){
    $('#importButton')?.addEventListener('click',()=>$('#importFile')?.click());
    $('#importFile')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if(!file)return;
      try{state=await importBackupFile(file,state);program=getProgram(state.activeProgramId);alert('Backup restored successfully.');render();}
      catch(err){alert(`Import failed: ${err.message}`);} finally{e.target.value='';}
    });
  }
}

function showModal(html,{lock=false}={}){
  sheet.innerHTML=html;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  modal.dataset.lock=lock?'1':'0'; bindActions(sheet);
}
function closeModal(){
  stopTimerController();
  modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); sheet.innerHTML=''; modal.dataset.lock='0';
  if(!runner) releaseWake();
}
modal.addEventListener('click',e=>{if(e.target===modal && modal.dataset.lock!=='1')closeModal();});

function openReadiness(continuation=null){
  readinessContinuation=continuation;
  const prior=latestReadiness(state,today());
  const vals={sleep:prior?.sleep||3,energy:prior?.energy||3,motivation:prior?.motivation||3,soreness:prior?.soreness||0,pain:prior?.pain||0};
  showModal(`<div class="step-top"><div><div class="kicker">Heuristic training readiness</div><h2>Readiness check</h2></div><button class="chip" data-action="close">Close</button></div>
    <p class="small">This score organizes training decisions; it does not diagnose illness or injury.</p>
    ${readinessRating('sleep','Sleep quality',vals.sleep,5)}
    ${readinessRating('energy','Energy',vals.energy,5)}
    ${readinessRating('motivation','Motivation',vals.motivation,5)}
    <div class="field"><label>Soreness: <span id="sorenessOut">${vals.soreness}</span>/10</label><input id="soreness" type="range" min="0" max="10" value="${vals.soreness}"></div>
    <div class="field"><label>Joint / tendon / injury pain: <span id="painOut">${vals.pain}</span>/10</label><input id="readinessPain" type="range" min="0" max="10" value="${vals.pain}"></div>
    <label class="toggle"><span>Feeling acutely ill today</span><input id="illness" type="checkbox" ${prior?.illness?'checked':''}></label>
    <label class="toggle"><span>Normal coordination / control</span><input id="coordination" type="checkbox" ${prior?.coordination!==false?'checked':''}></label>
    <div class="field" style="margin-top:12px"><label>Optional note</label><textarea id="readinessNote" placeholder="Sleep disruption, unusual fatigue, etc.">${esc(prior?.note||'')}</textarea></div>
    <button class="btn" id="saveReadiness">Calculate & save</button>`);

  const selected={sleep:vals.sleep,energy:vals.energy,motivation:vals.motivation};
  $$('.rate-btn',sheet).forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.key; selected[key]=Number(b.dataset.value);
    $$(`.rate-btn[data-key="${key}"]`,sheet).forEach(x=>x.classList.toggle('selected',x===b));
  }));
  $('#soreness').addEventListener('input',e=>$('#sorenessOut').textContent=e.target.value);
  $('#readinessPain').addEventListener('input',e=>$('#painOut').textContent=e.target.value);
  $('#saveReadiness').addEventListener('click',()=>{
    const input={...selected,soreness:Number($('#soreness').value),pain:Number($('#readinessPain').value),illness:$('#illness').checked,coordination:$('#coordination').checked,note:$('#readinessNote').value.trim()};
    const result=readinessScore(input);
    const entry={id:newId('ready'),date:today(),createdAt:nowIso(),...input,...result};
    state.readinessEntries.push(entry); persist();
    showReadinessResult(entry);
  });
}

function readinessRating(key,label,value,max){
  return `<div class="field"><label>${esc(label)}</label><div class="readiness-grid">${Array.from({length:max},(_,i)=>i+1).map(v=>`<button type="button" class="rate-btn ${v===value?'selected':''}" data-key="${key}" data-value="${v}">${v}</button>`).join('')}</div></div>`;
}

function showReadinessResult(entry){
  showModal(`<div class="row" style="align-items:flex-start"><div class="score-ring" style="--score:${entry.score}%"><strong>${entry.score}</strong></div><div class="grow"><div class="kicker">${entry.band.toUpperCase()}</div><h2>${esc(entry.label)}</h2><p class="small">Sleep ${entry.sleep}/5 · Energy ${entry.energy}/5 · Soreness ${entry.soreness}/10 · Pain ${entry.pain}/10</p></div></div>
  ${entry.band==='red'?`<div class="alert bad">The app recommends recovery rather than escalation today. Acute illness, abnormal coordination, or high pain can force a red result regardless of the numerical score.</div>`:entry.band==='yellow'?`<div class="alert warn">Use conservative judgment. A yellow score is permission to reduce load, not a challenge to overcome it.</div>`:`<div class="alert good">No readiness flag was triggered by the values you entered.</div>`}
  <div class="spacer12"></div><button class="btn" id="readinessContinue">${readinessContinuation?'Continue':'Done'}</button>`,{lock:Boolean(readinessContinuation)});
  $('#readinessContinue').addEventListener('click',()=>{const cb=readinessContinuation;readinessContinuation=null;closeModal();render();if(cb)cb(entry);});
}

function openPause(){
  showModal(`<div class="kicker">Program control</div><h2>Pause at Day ${currentDay()}?</h2><p>The current program day will remain frozen until you explicitly resume. Recovery sessions and logging remain available.</p><div class="field"><label>Reason (optional)</label><textarea id="pauseReason" placeholder="Injury recovery, illness, travel…"></textarea></div><button class="btn warn" id="confirmPause">Pause program</button><div class="spacer8"></div><button class="btn ghost" data-action="close">Cancel</button>`);
  $('#confirmPause').addEventListener('click',()=>{pauseProgram(state,$('#pauseReason').value);persist();closeModal();render();});
}
function doResume(){ if(resumeProgram(state)){persist();render();} }

const AREAS=['Foot','Ankle','Shin / lower leg','Knee','Hip','Low back','Upper back','Neck','Shoulder','Elbow','Wrist / hand','Chest','Other'];
const RESTRICTIONS=[
  ['foot-load','Foot loading'],['impact','Impact / jumping'],['ankle-load','Ankle loading'],['knee-load','Knee loading'],['hip-load','Hip loading'],
  ['lower-body','Lower-body work'],['balance','Balance-demanding work'],['wrist-load','Wrist loading'],['shoulder-load','Shoulder loading'],['upper-push','Upper-body pushing'],
  ['hanging','Hanging'],['grip','Grip loading'],['core','Core bracing'],['spinal-flexion','Spinal flexion'],['spinal-extension','Spinal extension'],['spinal-rotation','Spinal rotation']
];
const PRESETS={
  'Foot':['foot-load','impact','balance'], 'Ankle':['foot-load','ankle-load','impact','balance'], 'Shin / lower leg':['foot-load','impact'],
  'Knee':['knee-load','lower-body','impact'], 'Hip':['hip-load','lower-body','impact'], 'Low back':['spinal-flexion','spinal-extension','spinal-rotation'],
  'Shoulder':['shoulder-load','upper-push','hanging'], 'Elbow':['upper-push','hanging'], 'Wrist / hand':['wrist-load','upper-push','grip','hanging']
};

function openInjuryManager(){
  const active=activeInjuries(state), resolved=state.injuries.filter(x=>x.status==='resolved').slice(-5).reverse();
  showModal(`<div class="step-top"><div><div class="kicker">Movement restriction system</div><h2>Injuries / limitations</h2></div><button class="chip" data-action="close">Close</button></div>
    <div class="alert">These records are user-defined training restrictions. They do not identify a diagnosis or determine whether exercise is medically safe.</div>
    <div class="section-title">Active</div>${active.length?`<div class="list">${active.map(injuryCard).join('')}</div>`:'<p class="small">No active restrictions.</p>'}
    <div class="spacer12"></div><button class="btn" id="addInjury">Add injury / limitation</button>
    ${resolved.length?`<div class="section-title">Recently resolved</div><div class="list">${resolved.map(i=>`<div class="list-item"><strong>${esc(i.side||'')} ${esc(i.area)}</strong><div class="small">Resolved ${prettyDate(i.resolvedDate||i.date)}</div></div>`).join('')}</div>`:''}`);
  $('#addInjury').addEventListener('click',openAddInjury);
}

function openAddInjury(){
  showModal(`<div class="kicker">New limitation</div><h2>Add training restriction</h2>
    <div class="grid2"><div class="field"><label>Body area</label><select id="injuryArea">${AREAS.map(a=>`<option>${esc(a)}</option>`).join('')}</select></div><div class="field"><label>Side</label><select id="injurySide"><option value="">Not specified</option><option>Right</option><option>Left</option><option>Bilateral</option><option>Central</option></select></div></div>
    <div class="field"><label>Current severity: <span id="severityOut">4</span>/10</label><input id="injurySeverity" type="range" min="1" max="10" value="4"></div>
    <div class="field"><label>Blocked movement categories</label><div id="restrictionChecks" class="card tight">${RESTRICTIONS.map(([tag,label])=>`<label class="toggle"><span>${esc(label)}</span><input type="checkbox" value="${esc(tag)}"></label>`).join('')}</div></div>
    <div class="field"><label>Notes</label><textarea id="injuryNotes" placeholder="What you want the app to remember…"></textarea></div>
    <button class="btn" id="saveInjury">Save restriction</button><div class="spacer8"></div><button class="btn ghost" data-action="close">Cancel</button>`);
  const applyPreset=()=>{const preset=PRESETS[$('#injuryArea').value]||[];$$('#restrictionChecks input').forEach(x=>x.checked=preset.includes(x.value));};
  applyPreset(); $('#injuryArea').addEventListener('change',applyPreset); $('#injurySeverity').addEventListener('input',e=>$('#severityOut').textContent=e.target.value);
  $('#saveInjury').addEventListener('click',()=>{
    const record={id:newId('injury'),date:today(),createdAt:nowIso(),area:$('#injuryArea').value,side:$('#injurySide').value,severity:Number($('#injurySeverity').value),blockedTags:$$('#restrictionChecks input:checked').map(x=>x.value),notes:$('#injuryNotes').value.trim(),status:'active',resolvedAt:null,resolvedDate:null};
    state.injuries.push(record);persist();openInjuryManager();render();
  });
}

function resolveInjury(id){
  const i=state.injuries.find(x=>x.id===id);if(!i)return;
  if(confirm(`Mark ${i.side?i.side+' ':''}${i.area} as resolved?`)){i.status='resolved';i.resolvedAt=nowIso();i.resolvedDate=today();persist();openInjuryManager();render();}
}

function openPainLog(context={}){
  if(context.sessionId) stopTimerController();
  const exerciseName=context.exerciseName||'';
  showModal(`<div class="kicker">Symptom record</div><h2>Log pain / issue</h2>
    ${exerciseName?`<div class="alert warn">Linked exercise: ${esc(exerciseName)}</div><div class="spacer12"></div>`:''}
    <div class="grid2"><div class="field"><label>Area</label><select id="painArea">${AREAS.map(a=>`<option>${esc(a)}</option>`).join('')}</select></div><div class="field"><label>Side</label><select id="painSide"><option value="">Not specified</option><option>Right</option><option>Left</option><option>Bilateral</option><option>Central</option></select></div></div>
    <div class="field"><label>Intensity: <span id="painIntensityOut">4</span>/10</label><input id="painIntensity" type="range" min="0" max="10" value="4"></div>
    <div class="field"><label>Type</label><select id="painType"><option>Ache</option><option>Sharp</option><option>Burning</option><option>Tightness</option><option>Instability</option><option>Numbness / tingling</option><option>Other</option></select></div>
    <div class="field"><label>Notes</label><textarea id="painNotes" placeholder="What happened, what movement provoked it, whether it stopped when you stopped…"></textarea></div>
    <button class="btn" id="savePain">Save issue</button><div class="spacer8"></div><button class="btn ghost" data-action="close">Cancel</button>`);
  $('#painIntensity').addEventListener('input',e=>$('#painIntensityOut').textContent=e.target.value);
  $('#savePain').addEventListener('click',()=>{
    const record={id:newId('pain'),date:today(),createdAt:nowIso(),area:$('#painArea').value,side:$('#painSide').value,intensity:Number($('#painIntensity').value),type:$('#painType').value,notes:$('#painNotes').value.trim(),sessionId:context.sessionId||null,exerciseId:context.exerciseId||null,exerciseName:exerciseName||null};
    state.painLogs.push(record);
    if(context.sessionId&&context.stepId){
      const s=getSessionById(context.sessionId);
      if(s){
        const prior=getStepRecord(s,context.stepId);
        if(prior) prior.painReported=true;
        else upsertStepRecord(s,{stepId:context.stepId,exerciseId:context.exerciseId||null,name:exerciseName||'',target:'',phase:'',isRest:false,done:false,skipped:false,painReported:true});
      }
    }
    persist(); closeModal(); if(runner)renderRunnerStep(); else render();
  });
}
function openSessionPreview(day=currentDay()){
  const def=program.buildSession(day), blocked=activeBlockedTags(), estimated=estimateSessionSeconds(def,state.settings.preCountdown);
  const affected=def.steps.filter(s=>restrictionMatches(s,blocked).restricted);
  const ready=latestReadiness(state,today());
  const canStart=day===currentDay()&&state.programState.status==='active';
  showModal(`<div class="step-top"><div><div class="kicker">Session preview</div><h2>Day ${day} · Week ${def.week}</h2></div><button class="chip" data-action="close">Close</button></div>
    <p>${esc(def.title)} · ${esc(def.goal)}</p>
    <div class="row wrap"><span class="chip">~${secondsFmt(estimated)}</span><span class="chip">${def.steps.length} steps</span>${ready?`<span class="chip ${ready.band==='green'?'good':ready.band==='yellow'?'warn':'bad'}">Readiness ${ready.score}</span>`:''}${affected.length?`<span class="chip warn">${affected.length} restricted steps</span>`:''}</div>
    ${affected.length?`<div class="alert warn" style="margin-top:12px">Active restrictions intersect this session. Restricted steps will be visibly blocked in the runner until you explicitly skip or override them.</div>`:''}
    <div class="section-title">Sequence</div><div class="list">${def.steps.map((s,i)=>{
      const r=restrictionMatches(s,blocked);return `<div class="list-item ${r.restricted?'restricted':''}"><div class="row between"><div><strong>${i+1}. ${esc(s.name)}</strong><div class="small">${esc(s.phase)} · ${esc(s.target)}</div></div>${r.restricted?'<span class="chip bad">RESTRICTED</span>':''}</div>${r.restricted?`<div class="tiny" style="margin-top:5px">Matched: ${r.matched.map(esc).join(', ')}</div>`:''}</div>`;
    }).join('')}</div>
    <div class="spacer12"></div>${canStart?`<button class="btn" id="previewStart">${incompleteSession('program',day)?'Resume session':'Start session'}</button>`:`<div class="alert">Preview only. The active program is currently at Day ${currentDay()}${state.programState.status==='paused'?' and paused':''}.</div>`}`);
  if(canStart)$('#previewStart').addEventListener('click',requestProgramStart);
}

function requestProgramStart(){
  if(state.programState.status!=='active')return;
  const existing=incompleteSession('program',currentDay());
  if(existing){startRunner(existing);return;}
  if(state.settings.readinessGate && !latestReadiness(state,today())){
    openReadiness(()=>beginProgramSession());
  }else beginProgramSession();
}

function beginProgramSession(){
  const def=program.buildSession(currentDay());
  const session={
    id:newId('session'),date:today(),kind:'program',programId:program.id,programVersion:program.version,programDay:currentDay(),week:def.week,
    title:def.title,startedAt:nowIso(),completedAt:null,abandonedAt:null,definition:def.steps,steps:[],segments:[],rpe:null,notes:'',activeSeconds:0,recoverySeconds:0,otherSeconds:0,totalSeconds:0,trainingLoad:null
  };
  state.sessions.push(session); if(!state.programState.startedAt)state.programState.startedAt=session.startedAt; persist(); startRunner(session);
}

function openRecoveryPreview(){
  const def=program.buildRecoverySession(activeBlockedTags());
  showModal(`<div class="step-top"><div><div class="kicker">Recovery preview</div><h2>${esc(def.title)}</h2></div><button class="chip" data-action="close">Close</button></div><p>${esc(def.goal)}</p>
    <div class="row wrap"><span class="chip">~${secondsFmt(estimateSessionSeconds(def,state.settings.preCountdown))}</span><span class="chip">${def.steps.length} movements</span></div>
    <div class="section-title">Filtered sequence</div><div class="list">${def.steps.map((s,i)=>`<div class="list-item"><strong>${i+1}. ${esc(s.name)}</strong><div class="small">${esc(s.target)}</div></div>`).join('')}</div>
    ${def.steps.length?`<div class="spacer12"></div><button class="btn" id="beginRecovery">Begin recovery session</button>`:`<div class="alert warn" style="margin-top:12px">Every recovery-template movement is currently filtered by your active restrictions. No session will be started.</div>`}`);
  $('#beginRecovery')?.addEventListener('click',()=>beginRecoverySession(def));
}

function beginRecoverySession(def){
  const existing=incompleteSession('recovery'); if(existing){startRunner(existing);return;}
  const session={id:newId('session'),date:today(),kind:'recovery',programId:program.id,programVersion:program.version,programDay:null,week:null,title:'Recovery',startedAt:nowIso(),completedAt:null,abandonedAt:null,definition:def.steps,steps:[],segments:[],rpe:null,notes:'',activeSeconds:0,recoverySeconds:0,otherSeconds:0,totalSeconds:0,trainingLoad:null};
  state.sessions.push(session);persist();startRunner(session);
}

function startRunner(session){
  closeOpenSegment(session);
  session.segments=session.segments||[]; session.segments.push({start:nowIso(),end:null}); persist();
  const def={programId:session.programId,programDay:session.programDay,week:session.week,title:session.title,steps:session.definition||[]};
  const completedIds=new Set((session.steps||[]).filter(x=>x.done||x.skipped).map(x=>x.stepId));
  let idx=def.steps.findIndex(s=>!completedIds.has(s.id)); if(idx<0)idx=def.steps.length;
  runner={sessionId:session.id,definition:def,index:idx,overrides:new Set(),stepOpenedAt:null,emomRecoveryAt:null};
  keepAwake(); renderRunnerStep();
}

function closeOpenSegment(session){
  const segments=session.segments||[]; const last=segments.length?segments[segments.length-1]:null;
  if(last&&!last.end)last.end=nowIso();
}
function segmentSeconds(session){return (session.segments||[]).reduce((a,s)=>a+(s.start&&s.end?Math.max(0,(new Date(s.end)-new Date(s.start))/1000):0),0);}

function renderRunnerStep(){
  stopTimerController();
  const session=runner&&getSessionById(runner.sessionId); if(!runner||!session){runner=null;closeModal();render();return;}
  const steps=runner.definition.steps;
  while(runner.index<steps.length){const existing=getStepRecord(session,steps[runner.index].id);if(existing&&(existing.done||existing.skipped))runner.index++;else break;}
  if(runner.index>=steps.length){finishSession(session);return;}
  const step=steps[runner.index], blocked=activeBlockedTags(), match=restrictionMatches(step,blocked), overridden=runner.overrides.has(step.id);
  runner.stepOpenedAt=Date.now(); runner.emomRecoveryAt=null;
  const base=`<div class="step-top"><div class="step-count">${session.kind==='recovery'?'RECOVERY':`DAY ${session.programDay}`} · STEP ${runner.index+1}/${steps.length} · ${esc(step.phase)}</div><button class="chip" id="exitRunner">Exit</button></div>
    <div class="progress"><i style="width:${pct(runner.index,steps.length)}%"></i></div><div class="spacer16"></div>
    <div class="kicker">${step.isRest?'Recovery':esc(step.phase)}</div><div class="hero-move">${esc(step.name)}</div><div class="target">${esc(step.target)}</div><div class="instruction">${esc(step.cue||'')}</div>
    ${step.regression?`<div class="alert" style="margin-top:12px"><strong>Regression:</strong> ${esc(step.regression)}</div>`:''}
    ${step.stopCue?`<div class="small" style="margin-top:9px">${esc(step.stopCue)}</div>`:''}
    ${match.restricted&&!overridden?`<div class="alert bad" style="margin-top:12px"><strong>ACTIVE RESTRICTION</strong><br>This movement matches: ${match.matched.map(esc).join(', ')}.</div>`:''}<hr>`;

  if(match.restricted&&!overridden){
    showModal(base+`<button class="btn warn" id="skipRestricted">Skip restricted movement</button><div class="spacer8"></div><button class="btn ghost" id="overrideRestricted">Override restriction for this step</button><div class="spacer8"></div><button class="btn ghost" id="runnerPain">Log pain / issue</button>`,{lock:true});
    $('#skipRestricted').addEventListener('click',()=>skipRunnerStep(step,'restricted'));
    $('#overrideRestricted').addEventListener('click',()=>{runner.overrides.add(step.id);renderRunnerStep();});
  }else if(step.type==='reps') renderRepStep(base,session,step);
  else if(step.type==='timer') renderTimedStep(base,session,step);
  else if(step.type==='emom') renderEmomStep(base,session,step);
  else showModal(base+`<button class="btn" id="genericComplete">Complete</button>`,{lock:true});

  $('#exitRunner')?.addEventListener('click',exitRunner);
  $('#runnerPain')?.addEventListener('click',()=>openPainLog({sessionId:session.id,stepId:step.id,exerciseId:step.exerciseId,exerciseName:step.name}));
}

function renderRepStep(base,session,step){
  let actual=Number(step.reps)||0;
  showModal(base+`<div class="repbox"><button id="minusRep">−</button><strong id="repActual">${actual}</strong><button id="plusRep">+</button></div><div class="small" style="text-align:center">Actual reps completed</div><div class="spacer12"></div><button class="btn" id="completeRep">Complete movement</button><div class="spacer8"></div><button class="btn ghost" id="skipStep">Skip / stop</button><div class="spacer8"></div><button class="btn ghost" id="runnerPain">Log pain / issue</button>`,{lock:true});
  $('#minusRep').addEventListener('click',()=>{$('#repActual').textContent=String(actual=Math.max(0,actual-1));});
  $('#plusRep').addEventListener('click',()=>{$('#repActual').textContent=String(++actual);});
  $('#completeRep').addEventListener('click',()=>completeRunnerStep(step,{actualReps:actual,actualSeconds:null}));
  $('#skipStep').addEventListener('click',()=>skipRunnerStep(step,'user'));
}

function renderTimedStep(base,session,step){
  showModal(base+timerMarkup(step.seconds)+`<button class="btn" id="timerMain">Start</button><div class="spacer8"></div><button class="btn ghost" id="skipStep">Skip / stop</button><div class="spacer8"></div><button class="btn ghost" id="runnerPain">Log pain / issue</button>`,{lock:true});
  $('#timerMain').addEventListener('click',()=>startCountdownAndTimer(step,{onComplete:()=>completeRunnerStep(step,{actualSeconds:step.seconds}),isRest:Boolean(step.isRest)}));
  $('#skipStep').addEventListener('click',()=>skipRunnerStep(step,'user'));
}

function renderEmomStep(base,session,step){
  let actual=Number(step.reps)||0;
  const repBox=step.reps?`<div class="repbox"><button id="minusRep">−</button><strong id="repActual">${actual}</strong><button id="plusRep">+</button></div><div class="small" style="text-align:center">Actual reps</div>`:'';
  showModal(base+timerMarkup(60)+`<div id="emomState" class="alert">WORK · complete ${esc(step.target)}.</div><div class="spacer12"></div>${repBox}${step.activeSeconds?'':`<button class="btn secondary" id="workDone">Work complete → ${esc(step.recovery)}</button><div class="spacer8"></div>`}<button class="btn" id="timerMain">Start minute</button><div class="spacer8"></div><button class="btn ghost" id="skipStep">Skip / stop</button><div class="spacer8"></div><button class="btn ghost" id="runnerPain">Log pain / issue</button>`,{lock:true});
  if(step.reps){$('#minusRep').addEventListener('click',()=>{$('#repActual').textContent=String(actual=Math.max(0,actual-1));});$('#plusRep').addEventListener('click',()=>{$('#repActual').textContent=String(++actual);});}
  const switchRecovery=elapsed=>{
    if(runner.emomRecoveryAt!==null)return;runner.emomRecoveryAt=Math.max(0,Number(elapsed)||0);
    const box=$('#emomState');if(box){box.className='alert good';box.textContent=`${String(step.recovery).toUpperCase()} · continue until the minute ends.`;}
    cue(state.settings,step.recovery,{freq:540,duration:.1,speech:true});
  };
  $('#workDone')?.addEventListener('click',()=>switchRecovery(timerController?.getElapsed?.()||0));
  $('#timerMain').addEventListener('click',()=>startCountdownAndTimer(step,{seconds:60,onTick:elapsed=>{if(step.activeSeconds&&elapsed>=step.activeSeconds)switchRecovery(step.activeSeconds);},onComplete:()=>completeRunnerStep(step,{actualReps:step.reps?actual:null,actualSeconds:step.activeSeconds||runner.emomRecoveryAt||60,recoveryWithinStepSeconds:runner.emomRecoveryAt===null?0:Math.max(0,60-runner.emomRecoveryAt)})}));
  $('#skipStep').addEventListener('click',()=>skipRunnerStep(step,'user'));
}

function timerMarkup(seconds){return `<div class="timer-wrap"><div class="timer" id="timerDisplay">${timerFmt(seconds)}</div><div class="timer-label" id="timerLabel">Ready</div></div>`;}
function startCountdownAndTimer(step,{seconds=null,onTick=null,onComplete=null,isRest=false}={}){
  if(timerController?.running)return;
  const total=Number(seconds||step.seconds)||0;
  const main=$('#timerMain'), display=$('#timerDisplay'), label=$('#timerLabel');
  if(!main||!display)return;
  main.disabled=true;

  const begin=()=>{
    cue(state.settings,isRest?'Rest':'Go',{freq:isRest?520:880,duration:.11,speech:true});
    runTimer(total,{display,label,main,isRest,onTick,onComplete});
  };

  if(state.settings.preCountdown && !isRest){
    let n=3; display.textContent=String(n); display.classList.add('countdown'); label.textContent='Starting';
    cue(state.settings,'3',{freq:620,speech:true});
    const id=setInterval(()=>{
      n--;
      if(n>0){display.textContent=String(n);cue(state.settings,String(n),{freq:n===1?760:680,speech:true});}
      else{clearInterval(id);display.classList.remove('countdown');display.textContent=timerFmt(total);begin();}
    },1000);
    timerController={running:true,stop:()=>clearInterval(id),getElapsed:()=>0};
  }else begin();
}

function runTimer(total,{display,label,main,isRest=false,onTick=null,onComplete=null}={}){
  let remaining=total, end=Date.now()+total*1000, paused=false, interval=null, elapsed=0;
  const flags={ten:false,three:false,two:false,one:false};
  main.disabled=false; main.textContent='Pause';
  label.textContent=isRest?'Recovery':'Work';
  const tick=()=>{
    if(paused)return;
    remaining=Math.max(0,(end-Date.now())/1000); elapsed=Math.max(0,total-remaining);
    display.textContent=timerFmt(remaining);
    onTick?.(elapsed,remaining);
    if(remaining<=10&&!flags.ten&&remaining>3){flags.ten=true;cue(state.settings,'Ten seconds',{freq:650,speech:true});}
    const ceil=Math.ceil(remaining);
    for(const n of [3,2,1]){
      if(ceil===n&&!flags[n===3?'three':n===2?'two':'one']){
        flags[n===3?'three':n===2?'two':'one']=true;tone(state.settings.tones,700+(3-n)*70,.07);
      }
    }
    if(remaining<=0){
      clearInterval(interval);timerController=null;display.textContent='00:00';label.textContent='Complete';main.disabled=true;completeTone(state.settings.tones);speak(state.settings.voiceCues,'Complete');setTimeout(()=>onComplete?.(),260);
    }
  };
  interval=setInterval(tick,125);tick();
  main.onclick=()=>{
    if(!paused){paused=true;remaining=Math.max(0,(end-Date.now())/1000);clearInterval(interval);main.textContent='Resume';label.textContent='Paused';}
    else{paused=false;end=Date.now()+remaining*1000;interval=setInterval(tick,125);main.textContent='Pause';label.textContent=isRest?'Recovery':'Work';tick();}
  };
  timerController={running:true,stop:()=>clearInterval(interval),getElapsed:()=>elapsed};
}

function stopTimerController(){
  try{timerController?.stop?.();}catch{} timerController=null;
}

function completeRunnerStep(step,data={}){
  const session=getSessionById(runner.sessionId);if(!session)return;
  const wall=Math.max(1,(Date.now()-(runner.stepOpenedAt||Date.now()))/1000);
  const engaged=step.type==='timer'?Number(data.actualSeconds??step.seconds??wall):step.type==='emom'?Number(step.seconds||60):wall;
  upsertStepRecord(session,{
    stepId:step.id,exerciseId:step.exerciseId,name:step.name,target:step.target,phase:step.phase,isRest:Boolean(step.isRest),done:true,skipped:false,
    completedAt:nowIso(),actualReps:data.actualReps??null,actualSeconds:data.actualSeconds??null,engagedSeconds:Math.max(0,engaged),
    recoveryWithinStepSeconds:Number(data.recoveryWithinStepSeconds)||0,painReported:Boolean(getStepRecord(session,step.id)?.painReported)
  });
  persist();runner.index++;renderRunnerStep();
}

function skipRunnerStep(step,reason='user'){
  const session=getSessionById(runner.sessionId);if(!session)return;
  const elapsed=timerController?.getElapsed?.() ?? Math.max(0,(Date.now()-(runner.stepOpenedAt||Date.now()))/1000);
  upsertStepRecord(session,{stepId:step.id,exerciseId:step.exerciseId,name:step.name,target:step.target,phase:step.phase,isRest:Boolean(step.isRest),done:false,skipped:true,skipReason:reason,completedAt:nowIso(),actualReps:null,actualSeconds:step.type==='timer'||step.type==='emom'?Math.round(elapsed):null,engagedSeconds:Math.max(0,Math.round(elapsed)),recoveryWithinStepSeconds:0,painReported:Boolean(getStepRecord(session,step.id)?.painReported)});
  persist();runner.index++;renderRunnerStep();
}

function exitRunner(){
  stopTimerController();
  const session=getSessionById(runner.sessionId);if(session){closeOpenSegment(session);persist();}
  runner=null;releaseWake();closeModal();render();
}

function finishSession(session){
  stopTimerController();closeOpenSegment(session);
  const stepRows=session.steps||[];
  const withinRecovery=stepRows.reduce((a,s)=>a+(Number(s.recoveryWithinStepSeconds)||0),0);
  const explicitRest=stepRows.filter(s=>s.isRest&&!s.skipped).reduce((a,s)=>a+(Number(s.engagedSeconds)||0),0);
  const nonRest=stepRows.filter(s=>!s.isRest&&!s.skipped).reduce((a,s)=>a+(Number(s.engagedSeconds)||0),0);
  const total=Math.round(segmentSeconds(session));
  session.activeSeconds=Math.max(0,Math.round(nonRest-withinRecovery));
  session.recoverySeconds=Math.max(0,Math.round(explicitRest+withinRecovery));
  session.totalSeconds=Math.max(1,total||Math.round(session.activeSeconds+session.recoverySeconds));
  session.otherSeconds=Math.max(0,session.totalSeconds-session.activeSeconds-session.recoverySeconds);
  persist();

  showModal(`<div class="kicker">Session complete</div><h2>${session.kind==='program'?`Day ${session.programDay} finished`:'Recovery session finished'}</h2>
    <div class="grid3"><div class="stat"><strong>${secondsFmt(session.totalSeconds)}</strong><span>Total</span></div><div class="stat"><strong>${secondsFmt(session.activeSeconds)}</strong><span>Active</span></div><div class="stat"><strong>${secondsFmt(session.recoverySeconds)}</strong><span>Recovery</span></div></div>
    <div class="spacer12"></div><div class="field"><label>Session RPE (1–10)</label><input id="sessionRpe" type="number" min="1" max="10" inputmode="numeric" placeholder="e.g. 6"></div>
    <div class="field"><label>Notes</label><textarea id="sessionNotes" placeholder="Breathing, form, pain, recovery, anything useful…"></textarea></div>
    <button class="btn" id="saveSessionFinish">Save session</button>`,{lock:true});
  $('#saveSessionFinish').addEventListener('click',()=>{
    const rpe=Number($('#sessionRpe').value);session.rpe=rpe>=1&&rpe<=10?rpe:null;session.notes=$('#sessionNotes').value.trim();session.completedAt=nowIso();session.trainingLoad=sessionTrainingLoad(session);
    if(session.kind==='program')advanceProgram(state,session.id,program.durationDays);
    persist();runner=null;releaseWake();closeModal();render();
  });
}
function openWalk(){
  const minutes=Math.max(1,Number(state.settings.walkGoalMinutes)||40), speed=Math.max(.5,Number(state.settings.walkSpeedMph)||4), seconds=minutes*60;
  const restricted=activeBlockedTags().includes('foot-load');
  showModal(`<div class="step-top"><div><div class="kicker">Walking pad</div><h2>${minutes} min · ${speed.toFixed(1)} mph</h2></div><button class="chip" data-action="close">Close</button></div>
    <div class="row wrap"><span class="chip">${(minutes*speed/60).toFixed(2)} mi target distance</span><span class="chip">${(60/speed).toFixed(1)} min/mi</span></div>
    ${restricted?`<div class="alert bad" style="margin-top:12px"><strong>Foot-loading is currently restricted.</strong> The app will not start this timer unless you explicitly acknowledge that you are overriding your own restriction.</div>`:''}
    <div class="spacer12"></div>${timerMarkup(seconds)}
    ${restricted?`<label class="toggle"><span>Override current foot-loading restriction for this walk</span><input id="walkOverride" type="checkbox"></label><div class="spacer12"></div>`:''}
    <button class="btn" id="walkStart" ${restricted?'disabled':''}>Start walk</button><div class="spacer8"></div><button class="btn ghost" id="walkPartial" disabled>Stop & save partial walk</button><div class="spacer8"></div><button class="btn ghost" id="walkPain">Log pain / issue</button>`);
  if(restricted)$('#walkOverride').addEventListener('change',e=>$('#walkStart').disabled=!e.target.checked);
  $('#walkStart').addEventListener('click',()=>{
    keepAwake(); $('#walkPartial').disabled=false;
    startCountdownAndTimer({name:'Walk',seconds},{seconds,onComplete:()=>saveWalk(minutes,speed)});
  });
  $('#walkPartial').addEventListener('click',()=>{
    const elapsed=Math.max(0,Math.round(timerController?.getElapsed?.()||0));
    if(elapsed<10){alert('No meaningful walking time has been recorded yet.');return;}
    if(confirm(`Save ${secondsFmt(elapsed)} as a partial walk?`)){saveWalk(elapsed/60,speed,true);}
  });
  $('#walkPain').addEventListener('click',()=>openPainLog({exerciseId:'walking-pad',exerciseName:'Walking Pad'}));
}

function saveWalk(minutes,speed,partial=false){
  stopTimerController();releaseWake();
  state.walks.push({id:newId('walk'),date:today(),startedAt:null,completedAt:nowIso(),actualMinutes:Number(minutes),speedMph:Number(speed),distanceMiles:Number(minutes)*Number(speed)/60,partial:Boolean(partial),rpe:null,notes:''});
  persist();closeModal();render();
}

function openWeight(){
  const existing=state.weights.find(w=>w.date===today());
  showModal(`<div class="kicker">Body-weight trend</div><h2>Log weight</h2><div class="field"><label>Date</label><input id="weightDate" type="date" value="${today()}"></div><div class="field"><label>Weight (lb)</label><input id="weightValue" type="number" inputmode="decimal" min="50" max="800" step="0.1" value="${existing?existing.value:''}" placeholder="0.0"></div><button class="btn" id="saveWeight">Save entry</button><div class="spacer8"></div><button class="btn ghost" data-action="close">Cancel</button>`);
  $('#saveWeight').addEventListener('click',()=>{
    const date=$('#weightDate').value,value=Number($('#weightValue').value);
    if(!date||!Number.isFinite(value)||value<50||value>800){alert('Enter a valid date and weight.');return;}
    state.weights=state.weights.filter(w=>w.date!==date);state.weights.push({id:newId('weight'),date,value,createdAt:nowIso()});persist();closeModal();render();
  });
}

function openExerciseHistory(exerciseId){
  const exercise=program.exercises[exerciseId];if(!exercise)return;
  const rows=exerciseHistory(state,exerciseId);
  const repRows=rows.filter(r=>Number.isFinite(Number(r.actualReps))), timeRows=rows.filter(r=>Number.isFinite(Number(r.actualSeconds)));
  const bestReps=repRows.length?Math.max(...repRows.map(r=>Number(r.actualReps))):null;
  const bestSeconds=timeRows.length?Math.max(...timeRows.map(r=>Number(r.actualSeconds))):null;
  showModal(`<div class="step-top"><div><div class="kicker">Exercise ledger</div><h2>${esc(exercise.name)}</h2></div><button class="chip" data-action="close">Close</button></div>
    <div class="row wrap">${bestReps!==null?`<span class="chip good">Best reps ${bestReps}</span>`:''}${bestSeconds!==null?`<span class="chip good">Best time ${secondsFmt(bestSeconds)}</span>`:''}<span class="chip">${rows.length} logged performances</span></div>
    <div class="spacer12"></div><div class="alert"><strong>Key cue:</strong> ${esc(exercise.cue)}</div>
    ${rows.length?`<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Day</th><th>Target</th><th>Actual</th><th>Pain</th></tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><td>${prettyDate(r.date)}</td><td>${r.programDay??'—'}</td><td>${esc(r.target)}</td><td>${r.actualReps!==null?`${r.actualReps} reps`:r.actualSeconds!==null?secondsFmt(r.actualSeconds):'—'}</td><td>${r.painReported?'Yes':'—'}</td></tr>`).join('')}</tbody></table></div>`:`<p class="small" style="margin-top:12px">No completed performances for this exercise yet.</p>`}`);
}

function openSessionHistory(){
  const rows=[...state.sessions].filter(s=>s.completedAt).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
  showModal(`<div class="step-top"><div><div class="kicker">Training history</div><h2>Completed sessions</h2></div><button class="chip" data-action="close">Close</button></div>
    ${rows.length?`<div class="list">${rows.map(s=>`<div class="list-item"><div class="row between"><div><strong>${s.kind==='program'?`Day ${s.programDay} · Week ${s.week}`:'Recovery session'}</strong><div class="small">${prettyDate(s.date)} · ${secondsFmt(s.totalSeconds||0)}${s.rpe?` · RPE ${s.rpe}`:''}</div></div>${s.trainingLoad?`<span class="chip">Load ${s.trainingLoad}</span>`:''}</div><div class="small" style="margin-top:6px">Active ${secondsFmt(s.activeSeconds||0)} · Recovery ${secondsFmt(s.recoverySeconds||0)} · Other ${secondsFmt(s.otherSeconds||0)}</div>${s.notes?`<div class="small" style="margin-top:5px">${esc(s.notes)}</div>`:''}</div>`).join('')}</div>`:'<p class="small">No completed sessions yet.</p>'}`);
}

function resetData(){
  if(!confirm('Erase all FOUNDATION / 28 v2 local training data on this browser? This cannot be undone unless you have an exported backup.'))return;
  state=resetAll();persist();program=getProgram(state.activeProgramId);render();
}

async function forceUpdate(){
  try{
    if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.update()));}
  }catch{}
  location.reload();
}

if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker registration failed:',err)));
}

render();
