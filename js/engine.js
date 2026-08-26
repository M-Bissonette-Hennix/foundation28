export const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
export const isoDate = (d=new Date()) => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
export const parseLocalDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
export const prettyDate = s => parseLocalDate(s).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
export const secondsFmt = n => {
  const s=Math.max(0,Math.round(Number(n)||0));
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
};
export const timerFmt = n => {
  const s=Math.max(0,Math.ceil(Number(n)||0));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};

export function readinessScore(input) {
  const sleep=clamp(Number(input.sleep)||1,1,5);
  const energy=clamp(Number(input.energy)||1,1,5);
  const motivation=clamp(Number(input.motivation)||1,1,5);
  const soreness=clamp(Number(input.soreness)||0,0,10);
  const pain=clamp(Number(input.pain)||0,0,10);
  let score = (sleep/5)*20 + (energy/5)*20 + (motivation/5)*10 + ((10-soreness)/10)*20 + ((10-pain)/10)*30;
  score=Math.round(clamp(score,0,100));
  const hardRed = Boolean(input.illness) || input.coordination === false || pain >= 7;
  let band = hardRed || score < 50 ? 'red' : score < 75 ? 'yellow' : 'green';
  let label = band==='green' ? 'Train as programmed' : band==='yellow' ? 'Train conservatively / consider reducing load' : 'Recovery session recommended';
  return {score,band,label,hardRed};
}

export function activeInjuries(state) {
  return (state.injuries||[]).filter(x=>x.status==='active');
}
export function blockedTags(state) {
  return [...new Set(activeInjuries(state).filter(x=>(Number(x.returnStage)||0)===0).flatMap(x=>Array.isArray(x.blockedTags)?x.blockedTags:[]))];
}
export function restrictionMatches(step, blocked) {
  const matched=(step.tags||[]).filter(t=>blocked.includes(t));
  return {restricted:matched.length>0,matched};
}

export function estimateSessionSeconds(session, preCountdown=true) {
  let seconds=0;
  for (const step of session.steps||[]) {
    if (preCountdown && !step.isRest) seconds += 3;
    if (step.type==='timer' || step.type==='emom') seconds += Number(step.seconds)||0;
    else if (step.type==='reps') seconds += (Number(step.reps)||8)*(Number(step.estimatedRepSeconds)||3);
    seconds += step.isRest ? 0 : 7; // modest transition / logging allowance
  }
  return Math.round(seconds);
}

export function summarizeSessionTiming(session) {
  const steps=session.steps||[];
  const activeSeconds=steps.filter(s=>!s.isRest&&!s.skipped).reduce((a,s)=>a+(Number(s.engagedSeconds)||0),0);
  const recoverySeconds=steps.filter(s=>s.isRest&&!s.skipped).reduce((a,s)=>a+(Number(s.engagedSeconds)||0),0);
  let wall=0;
  if (session.startedAt && session.completedAt) wall=Math.max(0,(new Date(session.completedAt)-new Date(session.startedAt))/1000);
  const otherSeconds=Math.max(0,wall-activeSeconds-recoverySeconds);
  return {activeSeconds:Math.round(activeSeconds),recoverySeconds:Math.round(recoverySeconds),otherSeconds:Math.round(otherSeconds),totalSeconds:Math.round(wall||activeSeconds+recoverySeconds)};
}

export function sessionTrainingLoad(session) {
  const rpe=Number(session.rpe);
  const seconds=Number(session.totalSeconds)||0;
  if (!rpe || !seconds) return null;
  return Math.round((seconds/60)*rpe);
}

export function latestReadiness(state,date=isoDate()) {
  return [...(state.readinessEntries||[])].filter(x=>x.date===date).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]||null;
}

export function advanceProgram(state,date,durationDays) {
  const ps=state.programState;
  if (ps.status==='paused' || ps.status==='completed') return false;
  if (ps.advancementByDate?.[date]) return false;
  if (!ps.startedAt) ps.startedAt=new Date().toISOString();
  ps.advancementByDate={...(ps.advancementByDate||{}),[date]:ps.currentDay};
  if (ps.currentDay >= durationDays) {
    ps.status='completed';
    ps.completedAt=new Date().toISOString();
  } else {
    ps.currentDay += 1;
  }
  return true;
}

export function pauseProgram(state,reason='') {
  const ps=state.programState;
  if (ps.status==='paused' || ps.status==='completed') return false;
  ps.status='paused'; ps.pausedAt=new Date().toISOString(); ps.pauseReason=String(reason||'').trim();
  return true;
}

export function resumeProgram(state) {
  const ps=state.programState;
  if (ps.status!=='paused') return false;
  ps.pauseHistory=[...(ps.pauseHistory||[]),{pausedAt:ps.pausedAt,resumedAt:new Date().toISOString(),reason:ps.pauseReason||''}];
  ps.status='active'; ps.pausedAt=null; ps.pauseReason='';
  return true;
}

export function weightSeries(weights) {
  const sorted=[...(weights||[])].filter(x=>x.date&&Number.isFinite(Number(x.value))).sort((a,b)=>a.date.localeCompare(b.date));
  return sorted.map((w,i)=>{
    const end=parseLocalDate(w.date); const start=new Date(end); start.setDate(end.getDate()-6);
    const window=sorted.slice(0,i+1).filter(x=>{const d=parseLocalDate(x.date);return d>=start&&d<=end;});
    const avg=window.reduce((a,x)=>a+Number(x.value),0)/window.length;
    return {...w,value:Number(w.value),rollingAvg:avg};
  });
}

export function exerciseHistory(state, exerciseId) {
  const rows=[];
  for (const session of state.sessions||[]) {
    if (!session.completedAt) continue;
    for (const step of session.steps||[]) {
      if (step.exerciseId!==exerciseId || step.skipped) continue;
      rows.push({
        date:session.date, programDay:session.programDay, week:session.week, sessionId:session.id,
        programId:session.programId||null, kind:session.kind||null, sessionTitle:session.title||'',
        actualReps:step.actualReps??null, actualSeconds:step.actualSeconds??null, target:step.target||'',
        exerciseRpe:step.exerciseRpe??null, painReported:Boolean(step.painReported), engagedSeconds:step.engagedSeconds||0
      });
    }
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}

export function programCompletion(state,durationDays) {
  const completedProgramSessions=(state.sessions||[]).filter(s=>s.kind==='program'&&s.completedAt).length;
  return {completed:Math.min(durationDays,completedProgramSessions),percent:Math.round(Math.min(1,completedProgramSessions/durationDays)*100)};
}

export function sessionLoadSeries(state) {
  return (state.sessions||[]).filter(s=>s.completedAt&&Number.isFinite(Number(s.trainingLoad))&&Number(s.trainingLoad)>0)
    .map(s=>({date:s.date,value:Number(s.trainingLoad),rpe:s.rpe,duration:s.totalSeconds,kind:s.kind,programId:s.programId,title:s.title||''})).sort((a,b)=>a.date.localeCompare(b.date));
}
