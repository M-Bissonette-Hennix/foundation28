export const FIRST_MOTION_VERSION = 1;
export const MAX_ENTRY_LEVEL = 8;

const nowIso = () => new Date().toISOString();
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const newId = (prefix='fm') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export function createFirstMotionState(){
  return {
    version:FIRST_MOTION_VERSION,
    level:0,
    easyEvidence:0,
    hardEvidence:0,
    startRule:'When I notice myself avoiding today’s training, I open THRESHOLD and press FIRST MOTION.',
    history:[],
    lastLevelChangeAt:null
  };
}

export function normalizeFirstMotion(value){
  const base=createFirstMotionState(), src=value&&typeof value==='object'?value:{};
  return {
    ...base,
    ...src,
    version:FIRST_MOTION_VERSION,
    level:clamp(Math.floor(Number(src.level)||0),0,MAX_ENTRY_LEVEL),
    easyEvidence:clamp(Math.floor(Number(src.easyEvidence)||0),0,2),
    hardEvidence:clamp(Math.floor(Number(src.hardEvidence)||0),0,2),
    startRule:String(src.startRule||base.startRule).trim()||base.startRule,
    history:Array.isArray(src.history)?src.history:[]
  };
}

const preferredOrder=['shoulder-pulse','seated-forward-bend','squat-reach','crunch','shoulder-press'];

function isRestricted(step,blockedTags){
  return (step.tags||[]).some(tag=>(blockedTags||[]).includes(tag));
}

function lowFrictionOrder(steps){
  const preferred=[];const rest=[];
  for(const id of preferredOrder){
    const step=steps.find(s=>s.exerciseId===id);
    if(step&&!preferred.includes(step))preferred.push(step);
  }
  for(const step of steps)if(!preferred.includes(step))rest.push(step);
  return [...preferred,...rest];
}

function levelSpec(level,safeCount){
  const specs=[
    {count:1,factor:.20,repCap:3,secCap:10},
    {count:1,factor:.35,repCap:5,secCap:15},
    {count:2,factor:.30,repCap:4,secCap:15},
    {count:3,factor:.50,repCap:6,secCap:20},
    {count:3,factor:1.00,repCap:40,secCap:45},
    {count:4,factor:.75,repCap:20,secCap:30},
    {count:6,factor:.60,repCap:15,secCap:30},
    {count:Math.max(3,Math.ceil(safeCount*.50)),factor:.60,repCap:15,secCap:35},
    {count:Math.max(4,Math.ceil(safeCount*.65)),factor:.75,repCap:20,secCap:45}
  ];
  return specs[clamp(level,0,specs.length-1)];
}

function targetFor(step,{reps=null,seconds=null}={}){
  if(reps!==null){
    if(step.exerciseId==='shoulder-pulse'){
      const each=Math.max(1,Math.round(reps/2));
      return `${each} forward + ${each} backward`;
    }
    if(step.exerciseId==='reverse-lunge'){
      const each=Math.max(1,Math.round(reps/2));
      return `${each} per leg`;
    }
    return `${reps} rep${reps===1?'':'s'}`;
  }
  return `${seconds} second${seconds===1?'':'s'}`;
}

function entryStep(step,index,spec){
  let type=step.type;
  let reps=null,seconds=null;
  if(type==='emom'){
    if(Number(step.reps)>0){type='reps';reps=Number(step.reps);}
    else{type='timer';seconds=Number(step.activeSeconds||step.seconds||20);}
  }else if(type==='reps') reps=Math.max(1,Number(step.reps)||3);
  else seconds=Math.max(5,Number(step.seconds)||15);

  if(type==='reps'){
    reps=Math.max(1,Math.min(spec.repCap,Math.ceil(reps*spec.factor)));
    if(step.exerciseId==='shoulder-pulse')reps=Math.max(6,reps%2===0?reps:reps+1);
    if(step.exerciseId==='reverse-lunge')reps=Math.max(2,reps%2===0?reps:reps+1);
  }else{
    seconds=Math.max(5,Math.min(spec.secCap,Math.ceil(seconds*spec.factor)));
  }

  return {
    id:`first-motion-${step.id}-${index}`,
    sourceStepId:step.id,
    exerciseId:step.exerciseId,
    name:step.name,
    type,
    reps,
    seconds,
    target:targetFor(step,{reps,seconds}),
    cue:step.forceRegression&&step.regression?step.regression:(step.cue||''),
    tags:[...(step.tags||[])],
    forceRegression:Boolean(step.forceRegression),
    phase:step.phase||'Entry'
  };
}

function fallbackRecoveryStep(recoveryDefinition,blockedTags){
  const candidate=(recoveryDefinition?.steps||[]).find(s=>!s.isRest&&!isRestricted(s,blockedTags));
  if(!candidate)return {
    id:'first-motion-breathing-fallback',sourceStepId:null,exerciseId:null,name:'Controlled Breathing',type:'timer',seconds:20,reps:null,
    target:'20 seconds',cue:'Breathe comfortably. Let the exhale lengthen naturally without forcing it.',tags:[],forceRegression:false,phase:'Entry'
  };
  const spec={factor:.2,repCap:3,secCap:20};
  return entryStep(candidate,0,spec);
}

export function buildFirstMotionPlan({definition,recoveryDefinition=null,blockedTags=[],firstMotion=null}={}){
  const fm=normalizeFirstMotion(firstMotion);
  const original=(definition?.steps||[]).filter(s=>!s.isRest&&!isRestricted(s,blockedTags));
  const ordered=lowFrictionOrder(original);
  if(!ordered.length){
    const fallback=fallbackRecoveryStep(recoveryDefinition,blockedTags);
    return {level:fm.level,steps:[fallback],minimumIndex:0,estimatedSeconds:estimateFirstMotionSeconds([fallback]),fallback:true};
  }
  const spec=levelSpec(fm.level,ordered.length);
  const chosen=ordered.slice(0,Math.min(spec.count,ordered.length));
  const steps=chosen.map((step,index)=>entryStep(step,index,spec));
  return {level:fm.level,steps,minimumIndex:0,estimatedSeconds:estimateFirstMotionSeconds(steps),fallback:false};
}

export function estimateFirstMotionSeconds(steps=[]){
  return Math.round((steps||[]).reduce((sum,step)=>{
    if(step.type==='timer')return sum+(Number(step.seconds)||10)+4;
    return sum+(Number(step.reps)||3)*2.5+4;
  },0));
}

export function beginFirstMotionAttempt(firstMotion,{date,programId,programDay,plan}={}){
  const fm=normalizeFirstMotion(firstMotion);
  const attempt={
    id:newId('first-motion'),date:String(date||''),programId:programId||null,programDay:programDay??null,level:fm.level,
    startedAt:nowIso(),minimumCompletedAt:null,endedAt:null,outcome:null,difficulty:null,nextIndex:0,completedSteps:0,continuedSteps:0,
    handoffStarted:false,estimatedPlanSeconds:Number(plan?.estimatedSeconds)||0,plan:plan?JSON.parse(JSON.stringify(plan)):null
  };
  fm.history.push(attempt);
  return {firstMotion:fm,attempt};
}

export function getFirstMotionAttempt(firstMotion,attemptId){
  return normalizeFirstMotion(firstMotion).history.find(x=>x.id===attemptId)||null;
}

export function todayFirstMotionAttempt(firstMotion,date){
  return [...normalizeFirstMotion(firstMotion).history].filter(x=>x.date===date).sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')))[0]||null;
}

export function markFirstMotionStep(firstMotion,attemptId,{minimum=false}={}){
  const fm=normalizeFirstMotion(firstMotion), attempt=fm.history.find(x=>x.id===attemptId);
  if(!attempt)return {firstMotion:fm,attempt:null};
  attempt.completedSteps=(Number(attempt.completedSteps)||0)+1;
  attempt.nextIndex=(Number(attempt.nextIndex)||0)+1;
  if(minimum&&!attempt.minimumCompletedAt)attempt.minimumCompletedAt=nowIso();
  else if(attempt.minimumCompletedAt)attempt.continuedSteps=(Number(attempt.continuedSteps)||0)+1;
  return {firstMotion:fm,attempt};
}

function applyEvidence(fm,attempt,difficulty){
  const easy=difficulty==='easy'||Number(attempt.continuedSteps)>=2||attempt.handoffStarted;
  const hard=difficulty==='hard';
  if(easy){
    fm.easyEvidence=(Number(fm.easyEvidence)||0)+1;fm.hardEvidence=0;
    if(fm.easyEvidence>=2&&fm.level<MAX_ENTRY_LEVEL){fm.level++;fm.easyEvidence=0;fm.lastLevelChangeAt=nowIso();}
  }else if(hard){
    fm.hardEvidence=(Number(fm.hardEvidence)||0)+1;fm.easyEvidence=0;
    if(fm.hardEvidence>=2&&fm.level>0){fm.level--;fm.hardEvidence=0;fm.lastLevelChangeAt=nowIso();}
  }else{fm.easyEvidence=0;fm.hardEvidence=0;}
}

export function finishFirstMotionAttempt(firstMotion,attemptId,{outcome='stop',difficulty=null,handoff=false}={}){
  const fm=normalizeFirstMotion(firstMotion),attempt=fm.history.find(x=>x.id===attemptId);
  if(!attempt)return {firstMotion:fm,attempt:null,levelChanged:false};
  const before=fm.level;
  if(attempt.calibrationAppliedAt)return {firstMotion:fm,attempt,levelChanged:false,previousLevel:before,currentLevel:fm.level};
  if(handoff)attempt.handoffStarted=true;
  attempt.outcome=outcome;attempt.difficulty=difficulty||attempt.difficulty||null;attempt.endedAt=attempt.endedAt||nowIso();
  if(attempt.minimumCompletedAt)applyEvidence(fm,attempt,attempt.difficulty);
  attempt.calibrationAppliedAt=nowIso();
  return {firstMotion:fm,attempt,levelChanged:fm.level!==before,previousLevel:before,currentLevel:fm.level};
}

export function updateFirstMotionDifficulty(firstMotion,attemptId,difficulty){
  const fm=normalizeFirstMotion(firstMotion),attempt=fm.history.find(x=>x.id===attemptId);
  if(!attempt||!['easy','moderate','hard'].includes(difficulty))return {firstMotion:fm,attempt};
  attempt.difficulty=difficulty;
  return {firstMotion:fm,attempt};
}

export function firstMotionStats(firstMotion,{days=14,endDate=null}={}){
  const fm=normalizeFirstMotion(firstMotion);
  const end=endDate?new Date(`${endDate}T12:00:00`):new Date();
  const start=new Date(end);start.setDate(start.getDate()-(Math.max(1,days)-1));start.setHours(0,0,0,0);
  const rows=fm.history.filter(a=>{
    if(!a.date)return false;const d=new Date(`${a.date}T12:00:00`);return d>=start&&d<=end;
  });
  return {
    starts:rows.length,
    thresholdCrossings:rows.filter(a=>a.minimumCompletedAt).length,
    continued:rows.filter(a=>Number(a.continuedSteps)>0||a.handoffStarted).length,
    handoffs:rows.filter(a=>a.handoffStarted).length
  };
}

export function resetFirstMotionRamp(firstMotion){
  const fm=normalizeFirstMotion(firstMotion);fm.level=0;fm.easyEvidence=0;fm.hardEvidence=0;fm.lastLevelChangeAt=nowIso();return fm;
}
