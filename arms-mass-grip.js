const ex = (id, name, tags, cue, regression = '', stopCue = '') => ({
  id, name, tags, cue, regression, stopCue
});

const exercises = {
  chinUp: ex(
    'arms-chin-up',
    'Chin-ups',
    ['upper-pull','hanging','shoulder-load','elbow-load','grip'],
    'Palms facing you. Begin from a controlled full extension that your shoulders tolerate, pull without kipping, and lower under control. Keep the neck neutral.',
    'Use band assistance or controlled foot assistance only if the setup is secure and compatible with active restrictions.',
    'Stop for sharp shoulder, elbow, wrist/hand, chest, neck, or back pain; stop if grip becomes unsafe.'
  ),
  bandShrug: ex(
    'arms-band-shrug',
    'Resistance Band Shrugs',
    ['upper-pull','shoulder-load','grip','foot-load'],
    'Use a secure band setup. Elevate the shoulders deliberately, pause briefly at peak contraction, then lower fully under control. Do not roll the shoulders.',
    'Reduce band resistance or use a secure non-foot anchor if foot loading is restricted.',
    'Stop for sharp neck, shoulder, elbow, hand, or foot pain, or if the band/anchor is not secure.'
  ),
  bandCurl: ex(
    'arms-band-bicep-curl',
    'Resistance Band Bicep Curls',
    ['upper-pull','elbow-load','grip','forearm-load','foot-load'],
    'Keep the upper arm quiet, curl through a controlled range, squeeze the biceps at the top, and lower slowly. Avoid leaning back to manufacture reps.',
    'Reduce band resistance or use a secure non-foot anchor if foot loading is restricted.',
    'Stop for sharp elbow, wrist/hand, shoulder, or foot pain, or if the band/anchor is not secure.'
  ),
  twisterHammer: ex(
    'arms-twister-hammer-curl',
    'Twister Arm Trainer Hammer Curls',
    ['upper-pull','elbow-load','grip','forearm-load'],
    'Use a neutral/hammer-grip path. Keep the wrist stacked, maintain continuous resistance, and finish each rep with a deliberate contraction rather than momentum.',
    'Reduce device resistance or shorten range while preserving a neutral wrist.',
    'Stop for sharp wrist/hand, elbow, or shoulder pain, numbness, tingling, or loss of grip control.'
  ),
  forearmFlex: ex(
    'arms-forearm-trainer-flexion',
    'Forearm Trainer Curls — Flexion Direction',
    ['wrist-load','grip','forearm-load','elbow-load'],
    'Move through the flexion/curl direction under control. Keep the forearm supported or stable and avoid jerking through the wrist.',
    'Reduce resistance or range.',
    'Stop for sharp wrist/hand or elbow pain, numbness, tingling, or tendon pain that worsens rep to rep.'
  ),
  forearmExt: ex(
    'arms-forearm-trainer-extension',
    'Forearm Trainer Curls — Extension Direction',
    ['wrist-load','grip','forearm-load','elbow-load'],
    'Reverse the trainer for the opposite direction. Extend under control and keep the wrist aligned rather than letting the device pull it abruptly.',
    'Reduce resistance or range.',
    'Stop for sharp wrist/hand or elbow pain, numbness, tingling, or tendon pain that worsens rep to rep.'
  ),
  deadHang: ex(
    'arms-dead-hang',
    'Dead Hangs',
    ['hanging','shoulder-load','elbow-load','grip','forearm-load'],
    'Use a secure pull-up bar. Hang with controlled shoulders and continuous breathing; do not remain on the bar once grip becomes unreliable.',
    'Use partial unloading with the feet only if the setup is secure and compatible with active restrictions.',
    'Stop for sharp shoulder, elbow, wrist/hand, neck, or back pain, numbness/tingling, or unsafe grip fatigue.'
  ),
  gripRight: ex(
    'arms-grip-strengthener-right',
    'Grip Strengthener Squeezes — Right Hand',
    ['grip','forearm-load','wrist-load'],
    'Close the gripper deliberately, squeeze at full closure without twisting the wrist, and reopen under control.',
    'Reduce gripper resistance.',
    'Stop for sharp hand, finger, wrist, or elbow pain, numbness, tingling, or cramping that does not release promptly.'
  ),
  gripLeft: ex(
    'arms-grip-strengthener-left',
    'Grip Strengthener Squeezes — Left Hand',
    ['grip','forearm-load','wrist-load'],
    'Close the gripper deliberately, squeeze at full closure without twisting the wrist, and reopen under control.',
    'Reduce gripper resistance.',
    'Stop for sharp hand, finger, wrist, or elbow pain, numbness, tingling, or cramping that does not release promptly.'
  ),
  handOpeners: ex(
    'arms-hand-openers',
    'Hand Openers Stretch',
    ['forearm-load','wrist-load'],
    'Open the fingers fully against the intended resistance/stretch, control the return, and keep the wrist neutral. Treat 30–40 as controlled repetitions, not fast pulses.',
    'Use lighter resistance or a smaller opening range.',
    'Stop for sharp finger, hand, or wrist pain, numbness, or tingling.'
  )
};

const restStep = (id, seconds, after) => ({
  id,
  exerciseId: null,
  name: 'Rest',
  phase: after,
  type: 'timer',
  target: `${seconds} seconds`,
  seconds,
  tags: [],
  cue: `Recover for the next set of ${after}. Breathe normally and keep the target muscle relaxed enough to reproduce clean reps.`,
  regression: '',
  stopCue: '',
  isRest: true
});

const repStep = (exercise, phase, id, target, reps, estimatedRepSeconds = 3) => ({
  id,
  exerciseId: exercise.id,
  name: exercise.name,
  phase,
  type: 'reps',
  target,
  reps,
  estimatedRepSeconds,
  tags: [...exercise.tags],
  cue: exercise.cue,
  regression: exercise.regression,
  stopCue: exercise.stopCue,
  isRest: false
});

const timerStep = (exercise, phase, id, target, seconds, minSeconds = null) => ({
  id,
  exerciseId: exercise.id,
  name: exercise.name,
  phase,
  type: 'timer',
  target,
  seconds,
  minSeconds,
  tags: [...exercise.tags],
  cue: exercise.cue,
  regression: exercise.regression,
  stopCue: exercise.stopCue,
  isRest: false
});

function addRepSets(steps, exercise, sets, low, high, restSeconds, phase, {estimatedRepSeconds=3, restAfterFinal=true}={}) {
  for (let set = 1; set <= sets; set++) {
    const range = low === high ? `${low} reps` : `${low}–${high} reps`;
    steps.push(repStep(exercise, phase, `${exercise.id}-set-${set}`, `Set ${set}/${sets} · ${range}`, low, estimatedRepSeconds));
    if (set < sets || restAfterFinal) {
      steps.push(restStep(`${exercise.id}-rest-${set}`, restSeconds, exercise.name));
    }
  }
}

function buildSession() {
  const steps = [];

  // 1. Chin-ups — 4 x 5
  addRepSets(steps, exercises.chinUp, 4, 5, 5, 120, '1 · Chin-ups', {estimatedRepSeconds:4});

  // 2. Resistance Band Shrugs — 4 x 20–30
  addRepSets(steps, exercises.bandShrug, 4, 20, 30, 75, '2 · Band Shrugs', {estimatedRepSeconds:2});

  // 3. Resistance Band Bicep Curls — 3 x 12–20
  addRepSets(steps, exercises.bandCurl, 3, 12, 20, 75, '3 · Band Bicep Curls', {estimatedRepSeconds:3});

  // 4. Twister Arm Trainer Hammer Curls — 3 x 10–12
  addRepSets(steps, exercises.twisterHammer, 3, 10, 12, 75, '4 · Twister Hammer Curls', {estimatedRepSeconds:3});

  // 5. Forearm Trainer Curls — 3 x 12–15 each direction
  for (let set = 1; set <= 3; set++) {
    steps.push(repStep(exercises.forearmFlex, '5 · Forearm Trainer', `arms-forearm-flex-round-${set}`, `Set ${set}/3 · 12–15 reps · flexion direction`, 12, 3));
    steps.push(repStep(exercises.forearmExt, '5 · Forearm Trainer', `arms-forearm-ext-round-${set}`, `Set ${set}/3 · 12–15 reps · extension direction`, 12, 3));
    steps.push(restStep(`arms-forearm-rest-${set}`, 60, 'Forearm Trainer'));
  }

  // 6. Dead Hangs — 3 x 20–30 sec
  for (let set = 1; set <= 3; set++) {
    steps.push(timerStep(exercises.deadHang, '6 · Dead Hangs', `arms-dead-hang-set-${set}`, `Set ${set}/3 · 20–30 seconds`, 30, 20));
    steps.push(restStep(`arms-dead-hang-rest-${set}`, 90, 'Dead Hangs'));
  }

  // 7. Grip Strengthener Squeezes — 3 x 10–15 per hand
  for (let set = 1; set <= 3; set++) {
    steps.push(repStep(exercises.gripRight, '7 · Grip Strengthener', `arms-grip-right-set-${set}`, `Set ${set}/3 · 10–15 reps · right hand`, 10, 2.5));
    steps.push(repStep(exercises.gripLeft, '7 · Grip Strengthener', `arms-grip-left-set-${set}`, `Set ${set}/3 · 10–15 reps · left hand`, 10, 2.5));
    steps.push(restStep(`arms-grip-rest-${set}`, 60, 'Grip Strengthener'));
  }

  // 8. Hand Openers Stretch — 2 x 30–40
  addRepSets(steps, exercises.handOpeners, 2, 30, 40, 45, '8 · Hand Openers', {estimatedRepSeconds:1.5, restAfterFinal:false});

  return {
    programId: 'arms-mass-grip',
    programDay: null,
    week: null,
    title: 'ARMS / MASS + GRIP',
    goal: 'Optional Monday/Wednesday/Friday upper-arm and forearm hypertrophy, vascularity-oriented volume, and grip-strength work with recovery spacing between sessions.',
    steps
  };
}

export const armsMassGripProgram = {
  id: 'arms-mass-grip',
  version: '1.0.0',
  name: 'ARMS / MASS + GRIP',
  type: 'supplemental',
  description: 'Optional recurring biceps, forearms, grip, and upper-back accessory program.',
  schedule: {
    type: 'weekly',
    weekdays: [1, 3, 5],
    label: 'Monday · Wednesday · Friday'
  },
  progressionNote: 'Use controlled reps. When every prescribed set reaches the top of its rep range with clean form at a manageable effort, increase resistance modestly on a later session rather than adding unscheduled training days.',
  exercises: Object.fromEntries(Object.values(exercises).map(e => [e.id, e])),
  buildSession
};
