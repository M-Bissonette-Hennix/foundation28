import { activeInjuries, latestReadiness, parseLocalDate, isoDate, clamp } from './engine.js';

export const RETURN_STAGES = [
  {stage:0,label:'Blocked',short:'BLOCKED',factor:0,mode:'block',description:'Matching movements remain blocked in the runner.'},
  {stage:1,label:'Regression',short:'REGRESSION',factor:.5,mode:'regression',description:'Use the listed regression and approximately half volume.'},
  {stage:2,label:'50% volume',short:'50%',factor:.5,mode:'scaled',description:'Use the normal movement only if appropriate, at approximately half prescribed volume.'},
  {stage:3,label:'75% volume',short:'75%',factor:.75,mode:'scaled',description:'Use approximately three-quarters of prescribed volume.'},
  {stage:4,label:'Full / monitoring',short:'FULL',factor:1,mode:'monitor',description:'Full prescription is allowed by the app while the limitation remains visible for monitoring.'}
];

const PROFILE_OVERRIDES = {
  'arms-chin-up': {muscles:{'Biceps / elbow flexors':1,'Upper back / traps':1,'Forearms / grip':.55}},
  'arms-band-shrug': {muscles:{'Upper back / traps':1,'Forearms / grip':.2}},
  'arms-band-bicep-curl': {muscles:{'Biceps / elbow flexors':1,'Forearms / grip':.35}},
  'arms-twister-hammer-curl': {muscles:{'Biceps / elbow flexors':.9,'Forearms / grip':.7}},
  'arms-forearm-trainer-flexion': {muscles:{'Forearms / grip':1}},
  'arms-forearm-trainer-extension': {muscles:{'Forearms / grip':1}},
  'arms-dead-hang': {muscles:{'Forearms / grip':1,'Upper back / traps':.35,'Shoulders':.3}},
  'arms-grip-strengthener-right': {muscles:{'Forearms / grip':1}},
  'arms-grip-strengthener-left': {muscles:{'Forearms / grip':1}},
  'arms-hand-openers': {muscles:{'Forearms / grip':.65}},
  'squat-reach': {muscles:{'Quads / glutes':.65,'Shoulders':.2},volumeFactor:.5},
  'shoulder-pulse': {muscles:{'Shoulders':.55},volumeFactor:.5},
  'seated-forward-bend': {muscles:{'Core / trunk':.25},volumeFactor:.35},
  'burpee': {muscles:{'Quads / glutes':.8,'Chest / triceps':.65,'Shoulders':.3,'Core / trunk':.35}},
  'prisoner-squat': {muscles:{'Quads / glutes':1}},
  'pushup': {muscles:{'Chest / triceps':1,'Shoulders':.45,'Core / trunk':.25}},
  'mountain-climber': {muscles:{'Core / trunk':.8,'Shoulders':.35,'Quads / glutes':.35}},
  'pushup-hold': {muscles:{'Chest / triceps':.75,'Shoulders':.45,'Core / trunk':.45}},
  'reverse-lunge': {muscles:{'Quads / glutes':1}},
  'crunch': {muscles:{'Core / trunk':1}},
  'wall-sit': {muscles:{'Quads / glutes':1}},
  'shoulder-press': {muscles:{'Shoulders':1,'Chest / triceps':.45}},
  'squat': {muscles:{'Quads / glutes':1}},
  'plank': {muscles:{'Core / trunk':1,'Shoulders':.25}},
  'reverse-hollow': {muscles:{'Core / trunk':.9,'Upper back / traps':.2}},
  'door-hang': {muscles:{'Forearms / grip':1,'Upper back / traps':.3,'Shoulders':.3}},
  'combat-crouch': {muscles:{'Quads / glutes':1}}
};

function addMuscle(map,name,value){ if(value>0) map[name]=(map[name]||0)+value; }

export function exerciseProfile(step={}) {
  const override=PROFILE_OVERRIDES[step.exerciseId];
  if(override)return {muscles:{...override.muscles},volumeFactor:override.volumeFactor??1};
  const tags=new Set(step.tags||[]), muscles={};
  if(tags.has('lower-body')||tags.has('knee-load')||tags.has('hip-load'))addMuscle(muscles,'Quads / glutes',1);
  if(tags.has('upper-push')){addMuscle(muscles,'Chest / triceps',.8);addMuscle(muscles,'Shoulders',.4);}
  if(tags.has('upper-pull')){addMuscle(muscles,'Upper back / traps',.75);addMuscle(muscles,'Biceps / elbow flexors',.5);}
  if(tags.has('shoulder-load')&&!tags.has('upper-push')&&!tags.has('upper-pull'))addMuscle(muscles,'Shoulders',.55);
  if(tags.has('grip')||tags.has('forearm-load')||tags.has('wrist-load'))addMuscle(muscles,'Forearms / grip',.65);
  if(tags.has('core')||tags.has('spinal-flexion')||tags.has('spinal-extension')||tags.has('spinal-rotation'))addMuscle(muscles,'Core / trunk',.7);
  return {muscles,volumeFactor:1};
}

export function definitionVolume(definition) {
  const out={};
  for(const step of definition?.steps||[]){
    if(step.isRest||!step.exerciseId)continue;
    const profile=exerciseProfile(step), base=(profile.volumeFactor??1)*(Number(step.adaptiveFactor)||1);
    for(const [muscle,weight] of Object.entries(profile.muscles))addMuscle(out,muscle,base*weight);
  }
  return out;
}

export function sessionVolume(session) {
  const out={}, records=new Map((session?.steps||[]).map(x=>[x.stepId,x]));
  for(const step of session?.definition||[]){
    if(step.isRest||!step.exerciseId)continue;
    const rec=records.get(step.id);
    if(!rec||rec.skipped||!rec.done)continue;
    const profile=exerciseProfile(step), base=(profile.volumeFactor??1)*(Number(step.adaptiveFactor)||1);
    for(const [muscle,weight] of Object.entries(profile.muscles))addMuscle(out,muscle,base*weight);
  }
  return out;
}

function dateAtOffset(endDate,offset){const d=parseLocalDate(endDate);d.setDate(d.getDate()+offset);return isoDate(d);}
function inWindow(date,start,end){return String(date)>=start&&String(date)<=end;}

export function muscleVolumeWindow(state,days=7,endDate=isoDate()) {
  const start=dateAtOffset(endDate,-(Math.max(1,days)-1)), out={};
  for(const session of state.sessions||[]){
    if(!session.completedAt||!inWindow(session.date,start,endDate))continue;
    const volume=sessionVolume(session);
    for(const [muscle,value] of Object.entries(volume))addMuscle(out,muscle,value);
  }
  return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]));
}

function sumLoadBetween(state,start,end){
  return (state.sessions||[]).filter(s=>s.completedAt&&inWindow(s.date,start,end)&&Number(s.trainingLoad)>0).reduce((a,s)=>a+Number(s.trainingLoad),0);
}
function pctChange(current,previous){return previous>0?((current-previous)/previous)*100:null;}

export function loadWindowAnalytics(state,endDate=isoDate()) {
  const current7Start=dateAtOffset(endDate,-6), prior7End=dateAtOffset(endDate,-7), prior7Start=dateAtOffset(endDate,-13);
  const current28Start=dateAtOffset(endDate,-27), prior28End=dateAtOffset(endDate,-28), prior28Start=dateAtOffset(endDate,-55);
  const current7=sumLoadBetween(state,current7Start,endDate), previous7=sumLoadBetween(state,prior7Start,prior7End);
  const current28=sumLoadBetween(state,current28Start,endDate), previous28=sumLoadBetween(state,prior28Start,prior28End);
  const daily=[];
  for(let offset=-27;offset<=0;offset++){
    const date=dateAtOffset(endDate,offset);
    daily.push({date,value:sumLoadBetween(state,date,date)});
  }
  return {
    current7,previous7,current28,previous28,
    change7:pctChange(current7,previous7),change28:pctChange(current28,previous28),
    current7Start,current28Start,daily
  };
}

export function collisionAnalysis(items=[]) {
  const usable=items.filter(x=>x?.definition?.steps?.length);
  const volumes=usable.map(x=>({...x,volume:definitionVolume(x.definition)}));
  const overlaps=[]; let score=0;
  for(let i=0;i<volumes.length;i++)for(let j=i+1;j<volumes.length;j++){
    const a=volumes[i],b=volumes[j];
    for(const muscle of new Set([...Object.keys(a.volume),...Object.keys(b.volume)])){
      const av=a.volume[muscle]||0,bv=b.volume[muscle]||0,overlap=Math.min(av,bv);
      if(overlap>=.25){overlaps.push({aId:a.id,aName:a.name,bId:b.id,bName:b.name,muscle,aVolume:av,bVolume:bv,overlap});score+=overlap;}
    }
  }
  let severity='none';
  if(score>=4)severity='high'; else if(score>=2)severity='moderate'; else if(score>=.5)severity='low';
  const topMuscles=[...new Set(overlaps.sort((a,b)=>b.overlap-a.overlap).map(x=>x.muscle))].slice(0,5);
  return {severity,score:Number(score.toFixed(2)),overlaps,topMuscles,programCount:usable.length};
}

export function returnStageInfo(stage=0){return RETURN_STAGES.find(x=>x.stage===Number(stage))||RETURN_STAGES[0];}

export function returnAdjustmentForStep(state,step){
  const matches=activeInjuries(state).filter(i=>(i.blockedTags||[]).some(t=>(step.tags||[]).includes(t)));
  if(!matches.length)return {stage:null,factor:1,mode:'none',forceRegression:false,injuries:[]};
  const stage=Math.min(...matches.map(i=>clamp(Number(i.returnStage)||0,0,4)));
  const info=returnStageInfo(stage);
  return {stage,factor:info.factor,mode:info.mode,forceRegression:info.mode==='regression',injuries:matches,info};
}

function scaledInt(value,factor){return Math.max(1,Math.round(Number(value)*factor));}
function adaptationLabel(factor,stage,rest=false){
  if(rest&&factor>1)return `Recovery +${Math.round((factor-1)*100)}%`;
  if(stage===1)return 'Return: regression';
  if(factor<1)return `${Math.round(factor*100)}% volume`;
  return '';
}

export function adaptDefinition(definition,state,{factor=1,restMultiplier=1,reasons=[]}={}) {
  const globalFactor=clamp(Number(factor)||1,.25,1), restFactor=clamp(Number(restMultiplier)||1,1,2);
  const steps=(definition?.steps||[]).map(step=>{
    const original={...step,tags:[...(step.tags||[])]};
    if(step.isRest){
      if(restFactor===1)return original;
      const seconds=Math.max(1,Math.round((Number(step.seconds)||0)*restFactor));
      return {...original,seconds,target:`${seconds} seconds · adaptive recovery`,adaptiveFactor:1,restMultiplier:restFactor,originalTarget:step.target};
    }
    const ret=returnAdjustmentForStep(state,step);
    const injuryFactor=ret.stage===0?1:ret.factor;
    const stepFactor=Math.min(globalFactor,injuryFactor||1);
    const adapted={...original,adaptiveFactor:stepFactor,returnStage:ret.stage,forceRegression:ret.forceRegression,originalTarget:step.target,adaptationReasons:[...reasons]};
    if(ret.stage===0)return adapted;
    if(step.type==='reps'&&Number(step.reps)>0){
      adapted.reps=scaledInt(step.reps,stepFactor);
      adapted.target=`${adaptationLabel(stepFactor,ret.stage)} · ${adapted.reps} reps · original ${step.target}`;
    }else if(step.type==='timer'&&Number(step.seconds)>0){
      adapted.seconds=scaledInt(step.seconds,stepFactor);
      if(Number(step.minSeconds)>0)adapted.minSeconds=Math.min(adapted.seconds,scaledInt(step.minSeconds,stepFactor));
      adapted.target=`${adaptationLabel(stepFactor,ret.stage)} · ${adapted.seconds} sec · original ${step.target}`;
    }else if(step.type==='emom'){
      if(Number(step.reps)>0)adapted.reps=scaledInt(step.reps,stepFactor);
      if(Number(step.activeSeconds)>0)adapted.activeSeconds=scaledInt(step.activeSeconds,stepFactor);
      const dose=adapted.reps?`${adapted.reps} reps`:adapted.activeSeconds?`${adapted.activeSeconds} sec work`:step.target;
      adapted.target=`${adaptationLabel(stepFactor,ret.stage)} · ${dose} · original ${step.target}`;
      adapted.seconds=Number(step.seconds)||60;
    }
    return adapted;
  });
  return {...definition,steps,adaptivePlan:{factor:globalFactor,restMultiplier:restFactor,reasons:[...reasons]}};
}

export function recommendSessionScaling(state,definition,{kind='program',collision=null,date=isoDate()}={}) {
  const ready=latestReadiness(state,date), load=loadWindowAnalytics(state,date); let factor=1,restMultiplier=1; const reasons=[];
  let recommendRecovery=false;
  if(ready?.band==='yellow'){factor=.75;restMultiplier=1.25;reasons.push(`Readiness ${ready.score}/100 (yellow)`);}
  if(ready?.band==='red'){factor=.5;restMultiplier=1.5;recommendRecovery=true;reasons.push(`Readiness ${ready.score}/100 (red)`);}
  if(load.previous7>0&&load.current7>=load.previous7*1.5&&load.current7-load.previous7>=75){factor=Math.min(factor,.75);restMultiplier=Math.max(restMultiplier,1.2);reasons.push('7-day load is ≥50% above the preceding 7 days');}
  if(kind==='supplemental'&&collision?.severity==='moderate'){factor=Math.min(factor,.75);reasons.push('Moderate same-day program overlap');}
  if(kind==='supplemental'&&collision?.severity==='high'){factor=Math.min(factor,.5);restMultiplier=Math.max(restMultiplier,1.2);reasons.push('High same-day program overlap');}
  const returning=activeInjuries(state).filter(i=>Number(i.returnStage)>0&&Number(i.returnStage)<4);
  if(returning.length)reasons.push(`${returning.length} active return-to-training progression${returning.length===1?'':'s'}`);
  return {factor,restMultiplier,reasons,recommendRecovery,readiness:ready,load};
}

export function commandCenterSummary(state,{primary=null,supplementals=[],walkMinutes=0,date=isoDate()}={}) {
  const items=[];
  if(primary?.definition)items.push({id:primary.id||'primary',name:primary.name||'Primary',definition:primary.definition});
  for(const s of supplementals)if(s?.definition)items.push({id:s.id,name:s.name,definition:s.definition});
  const collision=collisionAnalysis(items), load=loadWindowAnalytics(state,date), readiness=latestReadiness(state,date);
  const plannedSeconds=items.reduce((a,x)=>a+(x.estimatedSeconds||0),0)+Math.max(0,Number(walkMinutes)||0)*60;
  return {collision,load,readiness,plannedSeconds,items};
}
