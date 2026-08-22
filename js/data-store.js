const KEY = 'foundation28.v2';
const LEGACY_KEY = 'foundation28.v1';
export const SCHEMA_VERSION = 2;
export const APP_VERSION = '2.0.0';

const nowIso = () => new Date().toISOString();
const id = (prefix='id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    activeProgramId: 'foundation28',
    programState: {
      status: 'active',
      currentDay: 1,
      startedAt: null,
      completedAt: null,
      pausedAt: null,
      pauseReason: '',
      pauseHistory: [],
      advancementByDate: {}
    },
    settings: {
      tones: true,
      voiceCues: true,
      wakeLock: true,
      preCountdown: true,
      readinessGate: true,
      walkGoalMinutes: 40,
      walkSpeedMph: 4,
      showPainPrompt: true
    },
    readinessEntries: [],
    injuries: [],
    sessions: [],
    walks: [],
    painLogs: [],
    weights: []
  };
}

function normalize(state) {
  const base = createDefaultState();
  const s = {...base, ...(state || {})};
  s.settings = {...base.settings, ...(state?.settings || {})};
  s.programState = {...base.programState, ...(state?.programState || {})};
  const boolKeys=['tones','voiceCues','wakeLock','preCountdown','readinessGate','showPainPrompt'];
  for(const k of boolKeys)s.settings[k]=s.settings[k]!==false;
  const walkMinutes=Number(s.settings.walkGoalMinutes); s.settings.walkGoalMinutes=Number.isFinite(walkMinutes)?Math.min(240,Math.max(1,walkMinutes)):40;
  const walkSpeed=Number(s.settings.walkSpeedMph); s.settings.walkSpeedMph=Number.isFinite(walkSpeed)?Math.min(10,Math.max(.5,walkSpeed)):4;
  const currentDay=Number(s.programState.currentDay); s.programState.currentDay=Number.isFinite(currentDay)?Math.max(1,Math.floor(currentDay)):1;
  if(!['active','paused','completed'].includes(s.programState.status))s.programState.status='active';
  for (const k of ['readinessEntries','injuries','sessions','walks','painLogs','weights']) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  s.schemaVersion = SCHEMA_VERSION;
  s.appVersion = APP_VERSION;
  return s;
}

function migrateLegacyV1(legacy) {
  const s = createDefaultState();
  try {
    if (legacy?.walkGoal) s.settings.walkGoalMinutes = Number(legacy.walkGoal) || 40;
    if (legacy?.walkSpeed) s.settings.walkSpeedMph = Number(legacy.walkSpeed) || 4;
    if (legacy?.settings) {
      s.settings.tones = legacy.settings.sound !== false;
      s.settings.wakeLock = legacy.settings.wake !== false;
    }
    if (Array.isArray(legacy?.weights)) {
      s.weights = legacy.weights.map(w => ({id:id('weight'),date:w.date,value:Number(w.value),createdAt:nowIso()})).filter(w=>w.date&&Number.isFinite(w.value));
    }
    if (legacy?.walks && typeof legacy.walks === 'object') {
      s.walks = Object.entries(legacy.walks).filter(([,w])=>w?.completedAt).map(([date,w])=>({
        id:id('walk'),date,startedAt:null,completedAt:w.completedAt,actualMinutes:Number(w.actualMinutes)||s.settings.walkGoalMinutes,
        speedMph:Number(w.speed)||s.settings.walkSpeedMph,rpe:null,notes:'Imported from FOUNDATION / 28 v1.'
      }));
    }
    if (legacy?.sessions && typeof legacy.sessions === 'object') {
      s.sessions = Object.entries(legacy.sessions).filter(([,x])=>x?.startedAt||x?.completedAt).map(([date,x])=>({
        id:id('session'),date,kind:'program',programId:'foundation28',programDay:null,week:x.week||null,startedAt:x.startedAt||x.completedAt,
        completedAt:x.completedAt||null,abandonedAt:null,steps:[],rpe:x.rpe||null,notes:[x.notes,'Imported from v1; granular step history was not migrated.'].filter(Boolean).join(' '),
        activeSeconds:0,recoverySeconds:0,otherSeconds:0,totalSeconds:0,trainingLoad:null
      }));
    }
    const completed = s.sessions.filter(x=>x.completedAt).length;
    s.programState.currentDay = Math.min(28, Math.max(1, completed + 1));
    s.programState.startedAt = s.sessions.map(x=>x.startedAt).filter(Boolean).sort()[0] || null;
  } catch (e) {
    console.warn('Legacy migration was partial:', e);
  }
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Could not load v2 state:',e); }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyV1(JSON.parse(legacyRaw));
      saveState(migrated);
      return migrated;
    }
  } catch (e) { console.warn('Could not migrate v1 state:',e); }

  const fresh = createDefaultState();
  saveState(fresh);
  return fresh;
}

export function saveState(state) {
  const s = normalize(state);
  s.updatedAt = nowIso();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function newId(prefix='id') { return id(prefix); }

export function createBackupObject(state) {
  return {
    backupFormat: 'foundation28-backup',
    backupVersion: 1,
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    state: normalize(state)
  };
}

export function downloadBackup(state) {
  const backup = createBackupObject(state);
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundation28-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function validateImported(candidate) {
  const rawState = candidate?.backupFormat === 'foundation28-backup' ? candidate.state : candidate;
  if (!rawState || typeof rawState !== 'object') throw new Error('The selected file does not contain a FOUNDATION / 28 data object.');
  if (rawState.schemaVersion === 1 || rawState.sessions && !Array.isArray(rawState.sessions)) return migrateLegacyV1(rawState);
  if (Number(rawState.schemaVersion) !== SCHEMA_VERSION) throw new Error(`Unsupported data schema: ${rawState.schemaVersion ?? 'unknown'}.`);
  if (!rawState.programState || !rawState.settings) throw new Error('The backup is missing required program/settings data.');
  return normalize(rawState);
}

export async function importBackupFile(file, currentState) {
  if (!file) throw new Error('No backup file selected.');
  if (file.size > 8_000_000) throw new Error('Backup file is unexpectedly large.');
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The selected file is not valid JSON.'); }
  const imported = validateImported(parsed);
  try {
    localStorage.setItem(`${KEY}.preimport.${Date.now()}`, JSON.stringify(createBackupObject(currentState)));
  } catch (e) { console.warn('Could not keep pre-import backup:', e); }
  saveState(imported);
  return imported;
}

export function resetAll() {
  localStorage.removeItem(KEY);
  return createDefaultState();
}
