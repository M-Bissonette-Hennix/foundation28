import { foundation28Program } from './programs/foundation28.js';
import { armsMassGripProgram } from './programs/arms-mass-grip.js';

const programs = new Map([
  [foundation28Program.id, foundation28Program],
  [armsMassGripProgram.id, armsMassGripProgram]
]);

export function getProgram(id='foundation28') {
  return programs.get(id) || foundation28Program;
}

export function getAllPrograms() {
  return [...programs.values()];
}

export function listPrograms() {
  return [...programs.values()].map(({id,version,name,type='primary',durationDays=null,description,schedule=null}) => ({
    id, version, name, type, durationDays, description, schedule
  }));
}

export function listSupplementalPrograms() {
  return [...programs.values()].filter(p => p.type === 'supplemental');
}

export function findExerciseById(exerciseId) {
  for (const program of programs.values()) {
    const exercise = program.exercises?.[exerciseId];
    if (exercise) return exercise;
  }
  return null;
}
