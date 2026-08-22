import { foundation28Program } from './programs/foundation28.js';

const programs = new Map([[foundation28Program.id, foundation28Program]]);

export function getProgram(id='foundation28') {
  return programs.get(id) || foundation28Program;
}

export function listPrograms() {
  return [...programs.values()].map(({id,version,name,durationDays,description})=>({id,version,name,durationDays,description}));
}
