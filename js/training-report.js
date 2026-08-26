import { parseLocalDate, isoDate, weightSeries } from './engine.js';
import { loadWindowAnalytics, muscleVolumeWindow } from './training-coordinator.js';

function dateAtOffset(endDate,offset){const d=parseLocalDate(endDate);d.setDate(d.getDate()+offset);return isoDate(d);}
function inWindow(date,start,end){return String(date)>=start&&String(date)<=end;}
function csvCell(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function downloadText(text,filename,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function buildTrainingReport(state,{days=28,endDate=isoDate()}={}){
  days=Math.max(1,Math.min(365,Number(days)||28));
  const startDate=dateAtOffset(endDate,-(days-1));
  const sessions=(state.sessions||[]).filter(s=>s.completedAt&&inWindow(s.date,startDate,endDate));
  const readiness=(state.readinessEntries||[]).filter(x=>inWindow(x.date,startDate,endDate));
  const pain=(state.painLogs||[]).filter(x=>inWindow(x.date,startDate,endDate));
  const weights=weightSeries((state.weights||[]).filter(x=>inWindow(x.date,startDate,endDate)));
  const walks=(state.walks||[]).filter(x=>x.completedAt&&inWindow(x.date,startDate,endDate));
  const load=loadWindowAnalytics(state,endDate), volume=muscleVolumeWindow(state,days,endDate);
  const rpes=sessions.map(s=>Number(s.rpe)).filter(Number.isFinite);
  const weightStart=weights[0]?.value??null,weightEnd=weights.at(-1)?.value??null;
  return {
    reportFormat:'foundation28-training-report',reportVersion:1,generatedAt:new Date().toISOString(),window:{days,startDate,endDate},
    appVersion:state.appVersion,schemaVersion:state.schemaVersion,
    summary:{
      completedSessions:sessions.length,
      foundationSessions:sessions.filter(s=>s.kind==='program').length,
      supplementalSessions:sessions.filter(s=>s.kind==='supplemental').length,
      recoverySessions:sessions.filter(s=>s.kind==='recovery').length,
      walks:walks.length,totalSessionMinutes:Math.round(sessions.reduce((a,s)=>a+(Number(s.totalSeconds)||0),0)/60),
      totalTrainingLoad:sessions.reduce((a,s)=>a+(Number(s.trainingLoad)||0),0),
      meanRpe:rpes.length?Number((rpes.reduce((a,b)=>a+b,0)/rpes.length).toFixed(2)):null,
      readinessEntries:readiness.length,meanReadiness:readiness.length?Number((readiness.reduce((a,x)=>a+Number(x.score||0),0)/readiness.length).toFixed(1)):null,
      painEntries:pain.length,activeInjuries:(state.injuries||[]).filter(i=>i.status==='active').length,
      weightStart,weightEnd,weightChange:weightStart!==null&&weightEnd!==null?Number((weightEnd-weightStart).toFixed(1)):null
    },
    loadAnalytics:load,muscleSetEquivalents:volume,
    activeInjuries:(state.injuries||[]).filter(i=>i.status==='active'),sessions,walks,readinessEntries:readiness,painLogs:pain,weights
  };
}

export function buildTrainingCsv(report){
  const header=['date','session','kind','program_id','duration_min','active_min','recovery_min','rpe','training_load','adaptive_factor','notes'];
  const lines=[header.join(',')];
  for(const s of report.sessions||[]){
    const row=[s.date,s.title||s.kind,s.kind,s.programId,(Number(s.totalSeconds||0)/60).toFixed(1),(Number(s.activeSeconds||0)/60).toFixed(1),(Number(s.recoverySeconds||0)/60).toFixed(1),s.rpe??'',s.trainingLoad??'',s.adaptivePlan?.factor??1,s.notes||''];
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function downloadTrainingReport(state,{days=28,format='json',endDate=isoDate()}={}){
  const report=buildTrainingReport(state,{days,endDate});const stamp=endDate;
  if(format==='csv') downloadText(buildTrainingCsv(report),`foundation28-training-report-${days}d-${stamp}.csv`,'text/csv;charset=utf-8');
  else downloadText(JSON.stringify(report,null,2),`foundation28-training-report-${days}d-${stamp}.json`,'application/json');
}
