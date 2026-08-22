const ex = (id, name, tags, cue, regression = '', stopCue = '') => ({
  id, name, tags, cue, regression, stopCue
});

const exercises = {
  squatReach: ex('squat-reach','Squat + Reach',['lower-body','foot-load','knee-load','hip-load','shoulder-load'],
    'Use a comfortable stance. Sit under control, stand through the full foot, finish with glute tension, then reach overhead without forcing the low back.',
    'Reduce squat depth or perform the reach separately.', 'Stop for sharp joint pain, instability, or worsening foot/ankle pain.'),
  shoulderPulse: ex('shoulder-pulse','Shoulder Pulse Circle',['shoulder-load'],
    'Arms extended around shoulder height; make tiny controlled circles. Keep the neck relaxed and ribs down.',
    'Reduce arm height or perform seated.', 'Stop for sharp shoulder pain, numbness, or loss of control.'),
  seatedForward: ex('seated-forward-bend','Seated Forward Bend Stretches',['spinal-flexion'],
    'Move only through a comfortable range. Exhale into the reach; do not bounce or force the spine into pain.',
    'Shorten range of motion.', 'Stop for sharp back pain, radiating pain, or neurological symptoms.'),
  burpee: ex('burpee','Burpees',['lower-body','foot-load','ankle-load','knee-load','hip-load','wrist-load','upper-push','impact'],
    'Keep the trunk controlled through the plank. Week 1 uses the no-jump version. Stand tall before the next rep.',
    'Step back one leg at a time; omit jump; elevate hands on a stable surface.', 'Stop for sharp wrist, shoulder, knee, ankle, foot, or back pain.'),
  prisonerSquat: ex('prisoner-squat','Prisoner Squats',['lower-body','foot-load','ankle-load','knee-load','hip-load'],
    'Hands behind head without pulling the neck. Keep chest controlled and knees tracking with the feet.',
    'Reduce depth or use light support.', 'Stop for sharp joint pain or instability.'),
  pushup: ex('pushup','Pushups',['upper-push','wrist-load','shoulder-load','core','foot-load'],
    'Maintain a single line from shoulders through hips. Use a regression if clean reps are not available.',
    'Incline pushup on a stable surface or knees-down version if appropriate.', 'Stop for sharp wrist, shoulder, elbow, chest, or back pain.'),
  mountainClimber: ex('mountain-climber','Mountain Climbers',['core','wrist-load','shoulder-load','foot-load','ankle-load','hip-load'],
    'Keep shoulders stable over the hands and drive knees at a pace that preserves trunk control.',
    'Slow alternating knee drives from an elevated hand position.', 'Stop for sharp wrist, shoulder, hip, ankle, foot, or back pain.'),
  pushupHold: ex('pushup-hold','Push-Up Holds',['upper-push','wrist-load','shoulder-load','core','foot-load'],
    'Use your established hold point. Keep shoulders organized; the pause should not collapse into the joints.',
    'Use an incline surface.', 'Stop for sharp joint pain or loss of shoulder control.'),
  reverseLunge: ex('reverse-lunge','Reverse Lunges',['lower-body','foot-load','ankle-load','knee-load','hip-load','balance'],
    'Step back under control, keep the front foot planted, and use a range that feels stable at the knee and hip.',
    'Use support, shorten range, or substitute only if intentionally selected.', 'Stop for sharp knee, ankle, foot, or hip pain or instability.'),
  crunch: ex('crunch','Crunches',['core','spinal-flexion'],
    'Use a controlled curl rather than momentum. Keep the neck relaxed.',
    'Shorten range of motion.', 'Stop for sharp neck or back pain.'),
  wallSit: ex('wall-sit','Wall Sit',['lower-body','foot-load','ankle-load','knee-load','hip-load','isometric'],
    'Back supported, feet positioned so the knees are comfortable. Approximately 90° is a target only if pain-free.',
    'Use a higher position and shorter knee bend.', 'Stop for sharp knee, ankle, foot, hip, or back pain.'),
  shoulderPress: ex('shoulder-press','Shoulder Presses',['shoulder-load','upper-push'],
    'Use the shoulder-press variation and load intended for your routine. Keep ribs stacked; do not turn the press into low-back extension.',
    'Reduce resistance, range, or perform seated if your chosen implement allows it.', 'Stop for sharp shoulder, neck, elbow, or back pain.'),
  squat: ex('squat','Squats',['lower-body','foot-load','ankle-load','knee-load','hip-load'],
    'Use a controlled depth you can own. Keep balance over the full foot and finish each rep tall.',
    'Reduce depth or use light support.', 'Stop for sharp joint pain or instability.'),
  plank: ex('plank','Plank',['core','foot-load','shoulder-load','isometric'],
    'Elbows under shoulders; brace without holding your breath. Stop before the low back begins to sag.',
    'Knees-down plank if appropriate.', 'Stop for sharp shoulder, back, hip, ankle, or foot pain.'),
  reverseHollow: ex('reverse-hollow','Reverse Hollow Body Hold',['core','spinal-extension','isometric'],
    'On the stomach, lift shoulders and legs only as far as you can control. Avoid cranking the neck or low back.',
    'Lift upper body only, lower body only, or reduce range.', 'Stop for sharp back or neck pain.'),
  doorHang: ex('door-hang','Door Frame Hang Hold',['hanging','shoulder-load','grip','isometric'],
    'Use only a purpose-built bar or structure verified to support bodyweight. Do not hang from decorative trim or an uncertain frame.',
    'Use partial unloading with feet supported if the equipment is designed for it.', 'Stop for sharp shoulder, elbow, hand, or neck pain; do not use uncertain equipment.'),
  combatCrouch: ex('combat-crouch','Combat Crouch',['lower-body','foot-load','ankle-load','knee-load','hip-load','isometric'],
    'Use your established combat-crouch position. Keep knee alignment controlled and breathe continuously.',
    'Raise the position or shorten the hold.', 'Stop for sharp knee, ankle, foot, hip, or back pain.'),
  breathing: ex('recovery-breathing','Controlled Breathing',[],
    'Use relaxed nasal or comfortable breathing. Let the exhale lengthen naturally; do not strain or hold your breath.', '', 'Stop if breathing exercises make you dizzy or unwell.'),
  seatedShoulder: ex('recovery-shoulders','Seated Shoulder Mobility',['shoulder-load'],
    'Use slow, comfortable shoulder rolls and circles while seated. Keep the neck relaxed.', 'Reduce range.', 'Stop for sharp shoulder or neck pain.'),
  thoracicRotation: ex('recovery-thoracic','Seated Thoracic Rotation',['spinal-rotation'],
    'Sit tall and rotate gently through the upper trunk without forcing the low back.', 'Use a smaller range.', 'Stop for sharp or radiating back pain.'),
  supineCoreBrace: ex('recovery-core-brace','Supine Core Brace',['core'],
    'Lie comfortably and practice gentle abdominal bracing while breathing normally.', 'Use a lighter brace.', 'Stop for pain or breath-holding.'),
  neckMobility: ex('recovery-neck','Gentle Neck Mobility',['neck'],
    'Use small, slow pain-free turns and nods. Do not force end range.', 'Use smaller range.', 'Stop for dizziness, radiating symptoms, or sharp pain.')
};

const phase1 = [
  {exercise:exercises.squatReach, type:'reps', target:'10 reps', reps:10, estimatedRepSeconds:4},
  {exercise:exercises.shoulderPulse, type:'reps', target:'15 forward + 15 backward', reps:30, estimatedRepSeconds:1.5},
  {exercise:exercises.seatedForward, type:'reps', target:'10 gentle reps', reps:10, estimatedRepSeconds:4}
];

const phase2 = [
  exercises.burpee, exercises.prisonerSquat, exercises.pushup, exercises.mountainClimber,
  exercises.pushupHold, exercises.reverseLunge, exercises.crunch, exercises.wallSit,
  exercises.shoulderPress, exercises.squat
];

const phase3 = [exercises.plank, exercises.reverseHollow, exercises.wallSit, exercises.doorHang, exercises.combatCrouch];

const weekGoals = {
  1:{title:'FOUNDATION & MOBILITY',goal:'Wake up the CNS; establish joint stability; normalize breathing.',hold:20},
  2:{title:'INTERVAL INTEGRATION',goal:'Increase heart-rate recovery speed; build muscular endurance.',hold:30},
  3:{title:'VOLUME SCALING',goal:'Simulate EMOM pressure; increase volume.',hold:45},
  4:{title:'FULL INTEGRATION',goal:'Reach 100% specifications.',hold:60}
};

const week1 = {
  'burpee':{target:'5 reps · no jump',reps:5},
  'prisoner-squat':{target:'10 reps',reps:10},
  'pushup':{target:'3 reps',reps:3},
  'mountain-climber':{target:'15 seconds',seconds:15},
  'pushup-hold':{target:'2 reps · 1-second pause',reps:2},
  'reverse-lunge':{target:'5 per leg',reps:10},
  'crunch':{target:'8 total',reps:8},
  'wall-sit':{target:'20 seconds',seconds:20},
  'shoulder-press':{target:'10 reps',reps:10},
  'squat':{target:'5 reps',reps:5}
};

const week3 = {
  'burpee':{target:'8–10 reps',reps:8},
  'prisoner-squat':{target:'15–20 reps',reps:15},
  'pushup':{target:'5–7 reps',reps:5},
  'mountain-climber':{target:'30 seconds',activeSeconds:30},
  'pushup-hold':{target:'5 reps · 2-second pause',reps:5},
  'reverse-lunge':{target:'10 per leg',reps:20},
  'crunch':{target:'12–15 reps',reps:12},
  'wall-sit':{target:'40 seconds',activeSeconds:40},
  'shoulder-press':{target:'15 reps',reps:15},
  'squat':{target:'8–10 reps',reps:8}
};

const week2Cues = {
  'burpee':'Slow, steady pace.', 'prisoner-squat':'Constant tension.', 'pushup':'Focus on form over reps.',
  'mountain-climber':'Moderate pace.', 'pushup-hold':'Use a 2-second pause.', 'reverse-lunge':'Steady cadence.',
  'crunch':'Controlled.', 'wall-sit':'Hold for the full 30 seconds.', 'shoulder-press':'Maximum deliberate muscular tension without sacrificing joint position.',
  'squat':'Focused verticality.'
};

function stepBase(exercise, phase, idSuffix='') {
  return {
    id:`${phase.toLowerCase().replace(/\s+/g,'-')}-${exercise.id}${idSuffix}`,
    exerciseId:exercise.id,
    name:exercise.name,
    phase,
    tags:[...exercise.tags],
    cue:exercise.cue,
    regression:exercise.regression,
    stopCue:exercise.stopCue
  };
}

function buildSession(programDay) {
  const week = Math.min(4, Math.max(1, Math.ceil(programDay / 7)));
  const steps = [];
  phase1.forEach((p, i) => steps.push({...stepBase(p.exercise,'Phase I',`-${i}`),...p,isRest:false}));

  if (week === 1) {
    phase2.forEach((exercise, i) => {
      const spec = week1[exercise.id];
      steps.push({...stepBase(exercise,'Phase II',`-${i}`),type:spec.seconds?'timer':'reps',target:spec.target,reps:spec.reps||null,seconds:spec.seconds||null,estimatedRepSeconds:3,isRest:false});
      if (i < phase2.length - 1) steps.push({id:`phase-ii-rest-${i}`,exerciseId:null,name:'Recovery',phase:'Phase II',type:'timer',target:'90 seconds',seconds:90,tags:[],cue:'Breathe normally and let heart rate settle before the next movement.',regression:'',stopCue:'',isRest:true});
    });
  } else if (week === 2) {
    phase2.forEach((exercise, i) => {
      steps.push({...stepBase(exercise,'Phase II',`-${i}`),type:'timer',target:'30 seconds work',seconds:30,tags:[...exercise.tags],cue:`${exercise.cue} ${week2Cues[exercise.id]}`,isRest:false});
      steps.push({id:`phase-ii-rest-${i}`,exerciseId:null,name:'Rest',phase:'Phase II',type:'timer',target:'30 seconds',seconds:30,tags:[],cue:`Recover before ${phase2[(i+1)%phase2.length]?.name || 'the next phase'}.`,regression:'',stopCue:'',isRest:true});
    });
  } else {
    phase2.forEach((exercise, i) => {
      const spec = week3[exercise.id];
      steps.push({...stepBase(exercise,'Phase II',`-${i}`),type:'emom',target:spec.target,seconds:60,reps:spec.reps||null,activeSeconds:spec.activeSeconds||null,recovery:week===4?'Combat Crouch':'Rest',isRest:false});
    });
  }

  const hold = weekGoals[week].hold;
  phase3.forEach((exercise, i) => steps.push({...stepBase(exercise,'Phase III',`-${i}`),type:'timer',target:`${hold} seconds`,seconds:hold,isHold:true,isRest:false}));

  return {
    programId:'foundation28', programDay, week, title:weekGoals[week].title, goal:weekGoals[week].goal,
    steps
  };
}

function buildRecoverySession(blockedTags=[]) {
  const raw = [
    {exercise:exercises.breathing,type:'timer',seconds:120,target:'2 minutes'},
    {exercise:exercises.seatedShoulder,type:'timer',seconds:90,target:'90 seconds'},
    {exercise:exercises.thoracicRotation,type:'timer',seconds:120,target:'2 minutes'},
    {exercise:exercises.supineCoreBrace,type:'timer',seconds:120,target:'2 minutes'},
    {exercise:exercises.neckMobility,type:'timer',seconds:90,target:'90 seconds'}
  ];
  const steps = raw.filter(x => !x.exercise.tags.some(t => blockedTags.includes(t))).map((x,i)=>({
    ...stepBase(x.exercise,'Recovery',`-${i}`), type:x.type, seconds:x.seconds, target:x.target, isRest:false, isRecovery:true
  }));
  return {programId:'foundation28', programDay:null, week:null, title:'RECOVERY SESSION',goal:'Preserve the training ritual without loading restricted or painful movements.',steps};
}

export const foundation28Program = {
  id:'foundation28', version:'2.0.0', name:'FOUNDATION / 28', durationDays:28,
  description:'Four-week return-to-training calisthenics progression.',
  weekGoals, exercises:Object.fromEntries(Object.values(exercises).map(e=>[e.id,e])),
  buildSession, buildRecoverySession
};
