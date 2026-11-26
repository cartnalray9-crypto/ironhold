import {
  BRANCHES,
  BUILDINGS,
  BUILD_ORDER,
  GATHER_SLOTS,
  HEROES,
  HERO_PER_LEVEL,
  ISLANDS,
  MAX_HERO_LEVEL,
  MAX_HQ,
  MAX_OFFLINE,
  MAX_TRACK,
  MERGE_GAP,
  PLOT_ORDER,
  RES_KEYS,
  RES_META,
  SAVE_VERSION,
  START_PLOTS,
  TOTAL_PLOTS,
  TRACKS,
  UNIT_GAP,
  branchDef,
  costFor,
  emptyResources,
  fmt,
  fmtTime,
  gatherRate,
  heroUnlocked,
  hqWaveGate,
  islandOpen,
  isPlotUnlocked,
  makeZones,
  mergeCapOf,
  prodFor,
  researchCost,
  researchTime,
  rollGear,
  timeFor,
  trackCeiling,
  unitCapOf,
  unitCost,
  unitPower,
  unitTime,
  wavePower,
  waveReward,
  xpNeed,
  zoneHuntCost,
  zoneLoot,
  zoneNeighbors,
  zonePower,
  zoneScoutCost,
  zoneScoutTime,
} from './data';
import type {
  Branch,
  Building,
  BuildingKind,
  GameState,
  HeroFocus,
  Job,
  ResKey,
  Resources,
  Slot,
  TrackKey,
} from '../types';

let seq = 0;
function uid(): string {
  seq += 1;
  return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* ------------------------------------------------------------------ *
 * State helpers
 * ------------------------------------------------------------------ */

export function hqLevel(s: GameState): number {
  const cc = s.buildings.find((b) => b.kind === 'command');
  return cc ? cc.level : 1;
}

export function maxBranchLevel(s: GameState, branch: Branch): number {
  const kind = branchDef(branch).kind;
  return s.buildings.filter((b) => b.kind === kind).reduce((m, b) => Math.max(m, b.level), 0);
}

export function trainTierCap(s: GameState, branch: Branch): number {
  return Math.min(unitCapOf(s.research), maxBranchLevel(s, branch) + UNIT_GAP);
}

export function builderLimit(s: GameState): number {
  return 2 + Math.floor(hqLevel(s) / 10);
}

export function activeBuilders(s: GameState): number {
  return s.jobs.filter((j) => j.type === 'upgrade').length;
}

export function repairBonus(s: GameState): number {
  const best = s.buildings.filter((b) => b.kind === 'repair').reduce((m, b) => Math.max(m, b.level), 0);
  return Math.min(0.48, best * 0.04);
}

export function trainingSpeedBonus(s: GameState): number {
  const total = s.buildings.filter((b) => b.kind === 'decor').reduce((a, b) => a + b.level, 0);
  return Math.min(0.6, total * 0.02);
}

export function gearBonus(s: GameState, key: 'atk' | 'gather' | 'build' | 'prod'): number {
  let sum = 0;
  for (const slot of ['weapon', 'armor', 'relic'] as Slot[]) {
    const id = s.equipped[slot];
    if (!id) continue;
    const g = s.gear.find((x) => x.id === id);
    if (!g) continue;
    sum += g[key];
  }
  return sum / 100;
}

export function heroUnlockedState(s: GameState, heroId: string): boolean {
  const def = HEROES.find((h) => h.id === heroId);
  if (!def) return false;
  return heroUnlocked(def, s.stats.gatherSeconds, s.stats.kills);
}

export function heroBonus(s: GameState, focus: HeroFocus): number {
  let sum = 0;
  for (const h of s.heroes) {
    const def = HEROES.find((d) => d.id === h.id);
    if (!def || def.focus !== focus) continue;
    if (!heroUnlocked(def, s.stats.gatherSeconds, s.stats.kills)) continue;
    sum += h.level * HERO_PER_LEVEL[focus];
  }
  const key = focus === 'combat' ? 'atk' : focus;
  return sum + gearBonus(s, key as 'atk' | 'gather' | 'build');
}

export function productionRates(s: GameState): Resources {
  const out = emptyResources();
  for (const b of s.buildings) {
    const def = BUILDINGS[b.kind];
    if (def.produces) out[def.produces] += prodFor(b.kind, b.level);
  }
  const mul = 1 + gearBonus(s, 'prod');
  for (const k of RES_KEYS) out[k] *= mul;
  return out;
}

export function troopPower(s: GameState): number {
  let p = 0;
  for (const b of BRANCHES) {
    for (const key of Object.keys(s.troops[b.key])) {
      const tier = Number(key);
      const count = s.troops[b.key][key] ?? 0;
      if (!Number.isFinite(tier) || count <= 0) continue;
      p += count * unitPower(tier, b.mul);
    }
  }
  return p;
}

export function powerOf(s: GameState): number {
  return troopPower(s) * (1 + heroBonus(s, 'combat'));
}

export function troopTiers(s: GameState, branch: Branch): number[] {
  return Object.keys(s.troops[branch])
    .map(Number)
    .filter((n) => Number.isFinite(n) && (s.troops[branch][String(n)] ?? 0) > 0)
    .sort((a, b) => a - b);
}

export function alliancePower(s: GameState): number {
  return s.alliance.members.reduce((a, m) => a + m.power, 0) + powerOf(s);
}

/* ------------------------------------------------------------------ *
 * Logging
 * ------------------------------------------------------------------ */

export function pushLog(s: GameState, text: string, tone: 'ok' | 'warn' | 'info' | 'epic' = 'info'): void {
  s.log.unshift({ id: uid(), at: Date.now(), text, tone });
  if (s.log.length > 80) s.log.length = 80;
}

/* ------------------------------------------------------------------ *
 * Resources
 * ------------------------------------------------------------------ */

export function canAfford(s: GameState, cost: Partial<Resources>): boolean {
  return RES_KEYS.every((k) => s.resources[k] >= (cost[k] ?? 0));
}

function pay(s: GameState, cost: Partial<Resources>): void {
  for (const k of RES_KEYS) s.resources[k] -= cost[k] ?? 0;
}

export function grant(s: GameState, gain: Partial<Resources>): void {
  for (const k of RES_KEYS) s.resources[k] += gain[k] ?? 0;
}

export function scaleCost(cost: Partial<Resources>, count: number): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (const k of RES_KEYS) {
    const v = cost[k];
    if (v) out[k] = Math.ceil(v * count);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * New game
 * ------------------------------------------------------------------ */

export function newGame(name: string, joinCode?: string): GameState {
  const now = Date.now();
  const seed = Math.floor(Math.random() * 1_000_000);
  const s: GameState = {
    version: SAVE_VERSION,
    name: name.trim().slice(0, 20) || 'Commander',
    seed,
    createdAt: now,
    updatedAt: now,
    resources: { gold: 560, wood: 560, stone: 380, food: 520, ore: 90 },
    buildings: [],
    unlockedPlots: START_PLOTS,
    research: { construction: 1, merge: 2, unitForce: 4 },
    jobs: [],
    troops: { army: { '1': 6 }, navy: {}, air: {} },
    heroes: HEROES.map((h) => ({ id: h.id, level: 1, xp: 0 })),
    gear: [],
    equipped: {},
    zones: makeZones(seed),
    wavesCleared: 0,
    log: [],
    alliance: { code: makeCode(), name: '', members: [] },
    stats: { kills: 0, hunts: 0, merges: 0, built: 0, gathered: 0, gatherSeconds: 0 },
  };
  s.alliance.name = `${s.name}'s Banner`;
  const opening: BuildingKind[] = ['command', 'goldmine', 'lumbermill', 'farm', 'barracks'];
  opening.forEach((kind, i) => {
    s.buildings.push({ uid: uid(), kind, level: 1, island: 0, plot: PLOT_ORDER[i] });
  });
  pushLog(s, `You take command of ${s.alliance.name}. No shop, no VIP, no packages — only the work you put in.`, 'epic');
  pushLog(s, 'Next: clear Wave 1, then merge two Level 1 Gold Mines to reach Level 2.', 'info');
  if (joinCode) addAlly(s, joinCode);
  return s;
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

export function tick(s: GameState, now: number = Date.now()): void {
  const realSec = (now - s.updatedAt) / 1000;
  if (!Number.isFinite(realSec) || realSec <= 0) {
    s.updatedAt = now;
    return;
  }
  const sec = Math.min(realSec, MAX_OFFLINE);
  const rates = productionRates(s);
  for (const k of RES_KEYS) s.resources[k] += rates[k] * sec;

  const finished = s.jobs.filter((j) => j.endsAt <= now);
  if (finished.length) {
    s.jobs = s.jobs.filter((j) => j.endsAt > now);
    for (const job of finished) finishJob(s, job);
  }
  s.updatedAt = now;
}

function finishJob(s: GameState, job: Job): void {
  if (job.type === 'upgrade' && job.buildingUid) {
    const b = s.buildings.find((x) => x.uid === job.buildingUid);
    if (b) {
      b.level = job.targetLevel ?? b.level + 1;
      pushLog(s, `${BUILDINGS[b.kind].name} reached Level ${b.level}.`, 'ok');
    }
    return;
  }
  if (job.type === 'research' && job.track) {
    const track = job.track;
    const target = Math.min(MAX_TRACK, job.targetLevel ?? s.research[track] + 1);
    s.research[track] = target;
    const def = TRACKS.find((t) => t.key === track);
    pushLog(s, `Research complete: ${def ? def.name : track} Level ${target}.`, 'ok');
    return;
  }
  if (job.type === 'train' && job.branch && job.tier && job.count) {
    addTroops(s, job.branch, job.tier, job.count);
    pushLog(s, `${job.count} ${branchDef(job.branch).unit} (Tier ${job.tier}) finished training.`, 'ok');
    return;
  }
  if (job.type === 'scout' && job.zoneId) {
    const z = s.zones.find((x) => x.id === job.zoneId);
    if (z) {
      z.revealed = true;
      pushLog(s, `Scouts reached ${z.name} — depth ${z.depth}.`, 'ok');
    }
    return;
  }
  if (job.type === 'gather' && job.res && job.amount) {
    const key = job.res;
    s.resources[key] += job.amount;
    s.stats.gathered += job.amount;
    s.stats.gatherSeconds += job.duration;
    addHeroXp(s, 'gather', Math.round(job.duration * 0.5));
    pushLog(s, `Gathering party returned with ${fmt(job.amount)} ${RES_META[key].name}.`, 'ok');
  }
}

function addTroops(s: GameState, branch: Branch, tier: number, count: number): void {
  const key = String(tier);
  s.troops[branch][key] = (s.troops[branch][key] ?? 0) + count;
}

export function addHeroXp(s: GameState, focus: HeroFocus, amount: number): void {
  if (amount <= 0) return;
  for (const h of s.heroes) {
    const def = HEROES.find((d) => d.id === h.id);
    if (!def || def.focus !== focus) continue;
    if (!heroUnlocked(def, s.stats.gatherSeconds, s.stats.kills)) continue;
    h.xp += amount;
    while (h.level < MAX_HERO_LEVEL && h.xp >= xpNeed(h.level)) {
      h.xp -= xpNeed(h.level);
      h.level += 1;
      pushLog(s, `${def.name} reached Level ${h.level}.`, 'epic');
    }
  }
}

/* ------------------------------------------------------------------ *
 * Building actions
 * ------------------------------------------------------------------ */

export function build(s: GameState, kind: BuildingKind, island: number, plot: number): boolean {
  const hq = hqLevel(s);
  if (!islandOpen(s.wavesCleared, hq, island)) {
    pushLog(s, 'That island is not open yet — clear more waves and raise the Command Center.', 'warn');
    return false;
  }
  if (!isPlotUnlocked(s.unlockedPlots, island, plot)) {
    pushLog(s, 'That plot is still wilderness. Clear waves to expand.', 'warn');
    return false;
  }
  if (s.buildings.some((b) => b.island === island && b.plot === plot)) {
    pushLog(s, 'That plot is occupied.', 'warn');
    return false;
  }
  if (kind === 'command' && s.buildings.some((b) => b.kind === 'command')) {
    pushLog(s, 'You can only have one Command Center.', 'warn');
    return false;
  }
  if (kind !== 'command' && !BUILD_ORDER.includes(kind)) return false;

  const level = Math.max(1, s.research.construction);
  const cost = costFor(kind, level);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough resources to build that.', 'warn');
    return false;
  }
  pay(s, cost);
  s.buildings.push({ uid: uid(), kind, level, island, plot });
  s.stats.built += 1;
  pushLog(s, `${BUILDINGS[kind].name} raised at Level ${level}.`, 'ok');
  return true;
}

export function upgradeBuilding(s: GameState, buildingUid: string): boolean {
  const b = s.buildings.find((x) => x.uid === buildingUid);
  if (!b) return false;
  if (s.jobs.some((j) => j.type === 'upgrade' && j.buildingUid === buildingUid)) {
    pushLog(s, 'That building is already upgrading.', 'warn');
    return false;
  }
  const target = b.level + 1;

  if (b.kind === 'command') {
    if (target > MAX_HQ) {
      pushLog(s, `The Command Center caps at Level ${MAX_HQ}.`, 'warn');
      return false;
    }
    const need = hqWaveGate(target);
    if (s.wavesCleared < need) {
      pushLog(s, `Clear ${need} campaign waves before the Command Center can reach Level ${target}.`, 'warn');
      return false;
    }
  } else if (b.level >= s.research.construction) {
    pushLog(
      s,
      `${BUILDINGS[b.kind].name} is at your Structure Level (Lv ${s.research.construction}). Raise Structure Level research, or merge two identical Lv ${b.level} buildings.`,
      'warn',
    );
    return false;
  }

  if (activeBuilders(s) >= builderLimit(s)) {
    pushLog(s, `All ${builderLimit(s)} build crews are busy.`, 'warn');
    return false;
  }
  const cost = costFor(b.kind, target);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough resources for that upgrade.', 'warn');
    return false;
  }
  pay(s, cost);
  const seconds = Math.max(2, Math.round(timeFor(b.kind, target) * (1 - heroBonus(s, 'build'))));
  s.jobs.push({
    id: uid(),
    type: 'upgrade',
    label: `${BUILDINGS[b.kind].name} → Lv ${target}`,
    startedAt: Date.now(),
    endsAt: Date.now() + seconds * 1000,
    duration: seconds,
    buildingUid,
    targetLevel: target,
  });
  pushLog(s, `Upgrading ${BUILDINGS[b.kind].name} to Level ${target} (${fmtTime(seconds)}).`, 'info');
  return true;
}

export function mergeBuilding(s: GameState, buildingUid: string): boolean {
  const a = s.buildings.find((x) => x.uid === buildingUid);
  if (!a) return false;
  if (a.kind === 'command') {
    pushLog(s, 'The Command Center cannot be merged.', 'warn');
    return false;
  }
  const target = a.level + 1;
  const cap = mergeCapOf(s.research);
  if (target > cap) {
    pushLog(
      s,
      `Merge ceiling is Level ${cap}. Raise Merge Level research (max Structure Level + ${MERGE_GAP}) to go higher.`,
      'warn',
    );
    return false;
  }
  const partner = s.buildings.find((x) => x.uid !== a.uid && x.kind === a.kind && x.level === a.level);
  if (!partner) {
    pushLog(s, `Merging needs two identical ${BUILDINGS[a.kind].name}s at Level ${a.level}.`, 'warn');
    return false;
  }
  if (s.jobs.some((j) => j.buildingUid === partner.uid)) {
    pushLog(s, `The partner ${BUILDINGS[a.kind].name} is busy — wait for its job to finish.`, 'warn');
    return false;
  }
  s.buildings = s.buildings.filter((x) => x.uid !== partner.uid);
  a.level = target;
  s.stats.merges += 1;
  pushLog(
    s,
    `Merged two Lv ${target - 1} ${BUILDINGS[a.kind].name}s into one Level ${target}. A plot was freed.`,
    'ok',
  );
  return true;
}

export function demolishBuilding(s: GameState, buildingUid: string): boolean {
  const b = s.buildings.find((x) => x.uid === buildingUid);
  if (!b) return false;
  if (b.kind === 'command') {
    pushLog(s, 'The Command Center cannot be demolished.', 'warn');
    return false;
  }
  if (s.jobs.some((j) => j.buildingUid === buildingUid)) {
    pushLog(s, 'Wait for the current job on that building to finish.', 'warn');
    return false;
  }
  const cost = costFor(b.kind, b.level);
  const refund: Partial<Resources> = {};
  for (const k of RES_KEYS) {
    const v = cost[k];
    if (v) refund[k] = Math.floor(v * 0.25);
  }
  grant(s, refund);
  s.buildings = s.buildings.filter((x) => x.uid !== buildingUid);
  pushLog(s, `Dismantled a Level ${b.level} ${BUILDINGS[b.kind].name}; recovered a quarter of its cost.`, 'info');
  return true;
}

export function moveBuilding(s: GameState, buildingUid: string, island: number, plot: number): boolean {
  const b = s.buildings.find((x) => x.uid === buildingUid);
  if (!b) return false;
  if (b.island === island && b.plot === plot) return false;
  if (!islandOpen(s.wavesCleared, hqLevel(s), island)) {
    pushLog(s, 'That island is not open yet.', 'warn');
    return false;
  }
  if (!isPlotUnlocked(s.unlockedPlots, island, plot)) {
    pushLog(s, 'That plot is still wilderness.', 'warn');
    return false;
  }
  if (s.buildings.some((x) => x.island === island && x.plot === plot)) {
    pushLog(s, 'That plot is occupied.', 'warn');
    return false;
  }
  b.island = island;
  b.plot = plot;
  pushLog(s, `${BUILDINGS[b.kind].name} redeployed.`, 'info');
  return true;
}

export function mergeCandidates(s: GameState, b: Building): Building[] {
  if (b.kind === 'command') return [];
  return s.buildings.filter((x) => x.uid !== b.uid && x.kind === b.kind && x.level === b.level);
}

/* ------------------------------------------------------------------ *
 * Research
 * ------------------------------------------------------------------ */

export function researchJob(s: GameState): Job | undefined {
  return s.jobs.find((j) => j.type === 'research');
}

export function startResearch(s: GameState, track: TrackKey): boolean {
  if (!s.buildings.some((b) => b.kind === 'research')) {
    pushLog(s, 'Build a Research Center first.', 'warn');
    return false;
  }
  if (researchJob(s)) {
    pushLog(s, 'The Research Center is already running a project.', 'warn');
    return false;
  }
  const current = s.research[track];
  const target = current + 1;
  const ceiling = trackCeiling(track, s.research);
  if (target > ceiling) {
    pushLog(s, `That track is capped at Level ${ceiling} by the stair-step rule.`, 'warn');
    return false;
  }
  const hq = hqLevel(s);
  if (hq < target) {
    pushLog(s, `Command Center Level ${target} is required for that research.`, 'warn');
    return false;
  }
  const cost = researchCost(track, target);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough resources for that research.', 'warn');
    return false;
  }
  pay(s, cost);
  const seconds = Math.max(5, Math.round(researchTime(track, target) * (1 - heroBonus(s, 'build') * 0.5)));
  const def = TRACKS.find((t) => t.key === track);
  s.jobs.push({
    id: uid(),
    type: 'research',
    label: `${def ? def.name : track} → Lv ${target}`,
    startedAt: Date.now(),
    endsAt: Date.now() + seconds * 1000,
    duration: seconds,
    track,
    targetLevel: target,
  });
  pushLog(s, `Research started: ${def ? def.name : track} Level ${target} (${fmtTime(seconds)}).`, 'info');
  return true;
}

/* ------------------------------------------------------------------ *
 * Troops
 * ------------------------------------------------------------------ */

export function trainJob(s: GameState, branch: Branch): Job | undefined {
  return s.jobs.find((j) => j.type === 'train' && j.branch === branch);
}

export function trainTroops(s: GameState, branch: Branch, tier: number, count: number): boolean {
  const def = branchDef(branch);
  const best = maxBranchLevel(s, branch);
  if (best <= 0) {
    pushLog(s, `Build a ${BUILDINGS[def.kind].name} first.`, 'warn');
    return false;
  }
  const cap = trainTierCap(s, branch);
  if (tier < 1 || tier > cap) {
    pushLog(s, `Tier ${tier} is above this branch's ceiling (Tier ${cap}).`, 'warn');
    return false;
  }
  if (count < 1 || count > 100) return false;
  if (trainJob(s, branch)) {
    pushLog(s, `The ${BUILDINGS[def.kind].name} is already training.`, 'warn');
    return false;
  }
  const cost = scaleCost(unitCost(tier), count);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough resources to train that many.', 'warn');
    return false;
  }
  pay(s, cost);
  const seconds = Math.max(2, Math.round(unitTime(tier) * count * (1 - trainingSpeedBonus(s))));
  s.jobs.push({
    id: uid(),
    type: 'train',
    label: `${count}× ${def.unit} T${tier}`,
    startedAt: Date.now(),
    endsAt: Date.now() + seconds * 1000,
    duration: seconds,
    branch,
    tier,
    count,
  });
  pushLog(s, `Training ${count} ${def.unit} (Tier ${tier}) — ${fmtTime(seconds)}.`, 'info');
  return true;
}

export function combineTroops(s: GameState, branch: Branch, tier: number): boolean {
  const key = String(tier);
  const count = s.troops[branch][key] ?? 0;
  const cap = trainTierCap(s, branch);
  if (tier + 1 > cap) {
    pushLog(s, `Combination capped at Tier ${cap}. Research Unit Force Combination or merge a higher ${branchDef(branch).name} building.`, 'warn');
    return false;
  }
  if (count < 2) {
    pushLog(s, `Need 2 units at Tier ${tier} to combine.`, 'warn');
    return false;
  }
  s.troops[branch][key] = count - 2;
  addTroops(s, branch, tier + 1, 1);
  pushLog(s, `Combined two Tier ${tier} ${branchDef(branch).unit} into one Tier ${tier + 1}.`, 'ok');
  return true;
}

/* ------------------------------------------------------------------ *
 * Gathering
 * ------------------------------------------------------------------ */

export function gatherJobCount(s: GameState): number {
  return s.jobs.filter((j) => j.type === 'gather').length;
}

export function gatherYield(s: GameState, seconds: number): number {
  return Math.round(gatherRate(hqLevel(s)) * (1 + heroBonus(s, 'gather')) * seconds);
}

export function startGather(s: GameState, res: ResKey, seconds: number): boolean {
  if (gatherJobCount(s) >= GATHER_SLOTS) {
    pushLog(s, `Both gathering parties are out. (${GATHER_SLOTS} slots)`, 'warn');
    return false;
  }
  const secondsClamped = Math.max(30, Math.min(3600, Math.round(seconds)));
  const amount = gatherYield(s, secondsClamped);
  s.jobs.push({
    id: uid(),
    type: 'gather',
    label: `${RES_META[res].name} gathering (${fmtTime(secondsClamped)})`,
    startedAt: Date.now(),
    endsAt: Date.now() + secondsClamped * 1000,
    duration: secondsClamped,
    res,
    amount,
  });
  pushLog(s, `Gathering party sent for ${RES_META[res].name}: ${fmt(amount)} in ${fmtTime(secondsClamped)}.`, 'info');
  return true;
}

/* ------------------------------------------------------------------ *
 * World map
 * ------------------------------------------------------------------ */

export function scoutJob(s: GameState): Job | undefined {
  return s.jobs.find((j) => j.type === 'scout');
}

export function isZoneReachable(s: GameState, zoneId: string): boolean {
  const z = s.zones.find((x) => x.id === zoneId);
  if (!z || z.revealed) return false;
  return s.zones.some((o) => o.revealed && zoneNeighbors(o).includes(zoneId));
}

export function startScout(s: GameState, zoneId: string): boolean {
  const z = s.zones.find((x) => x.id === zoneId);
  if (!z || z.revealed) return false;
  if (!isZoneReachable(s, zoneId)) {
    pushLog(s, 'Scouts must move through revealed land first.', 'warn');
    return false;
  }
  if (scoutJob(s)) {
    pushLog(s, 'Your scout party is already in the field.', 'warn');
    return false;
  }
  const cost = zoneScoutCost(z.depth);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough supplies for that scouting run.', 'warn');
    return false;
  }
  pay(s, cost);
  const seconds = zoneScoutTime(z.depth);
  s.jobs.push({
    id: uid(),
    type: 'scout',
    label: `Scouting ${z.name}`,
    startedAt: Date.now(),
    endsAt: Date.now() + seconds * 1000,
    duration: seconds,
    zoneId,
  });
  pushLog(s, `Scouts sent toward ${z.name} (${fmtTime(seconds)}).`, 'info');
  return true;
}

function applyLosses(s: GameState, frac: number): number {
  const f = Math.max(0, Math.min(0.9, frac * (1 - repairBonus(s))));
  let lost = 0;
  for (const b of BRANCHES) {
    for (const key of Object.keys(s.troops[b.key])) {
      const c = s.troops[b.key][key] ?? 0;
      if (c <= 0) continue;
      const l = Math.min(c, Math.round(c * f));
      if (l > 0) {
        s.troops[b.key][key] = c - l;
        lost += l;
      }
    }
  }
  return lost;
}

export function huntZone(s: GameState, zoneId: string): boolean {
  const z = s.zones.find((x) => x.id === zoneId);
  if (!z || !z.revealed) return false;
  if (troopPower(s) <= 0) {
    pushLog(s, 'You have no troops to hunt with. Train some first.', 'warn');
    return false;
  }
  const cost = zoneHuntCost(z.depth);
  if (!canAfford(s, cost)) {
    pushLog(s, 'Not enough food for a hunting party.', 'warn');
    return false;
  }
  pay(s, cost);
  const enemy = zonePower(z.depth) * (0.9 + Math.random() * 0.2);
  const mine = powerOf(s);
  if (mine >= enemy) {
    grant(s, zoneLoot(z.depth));
    z.hunts += 1;
    s.stats.kills += 1;
    s.stats.hunts += 1;
    addHeroXp(s, 'combat', 16 + z.depth * 18);
    pushLog(s, `Cleared ${z.name} — the monster is down.`, 'ok');
    const chance = Math.min(0.95, 0.35 + z.depth * 0.12);
    if (z.depth > 0 && Math.random() < chance) {
      const gear = rollGear(z.depth, Math.random);
      s.gear.unshift(gear);
      pushLog(s, `Recovered ${gear.name} (Tier ${gear.tier}, ${gear.slot}) from ${z.name}.`, 'epic');
    }
    return true;
  }
  const lost = applyLosses(s, 0.18);
  pushLog(s, `Repelled from ${z.name} — lost ${lost} unit${lost === 1 ? '' : 's'}.`, 'warn');
  return false;
}

/* ------------------------------------------------------------------ *
 * Campaign
 * ------------------------------------------------------------------ */

export function attackWave(s: GameState): boolean {
  if (troopPower(s) <= 0) {
    pushLog(s, 'No army, no assault. Train troops first.', 'warn');
    return false;
  }
  const wave = s.wavesCleared + 1;
  const enemy = wavePower(wave);
  const mine = powerOf(s);
  const roll = 0.92 + Math.random() * 0.16;
  if (mine * roll >= enemy) {
    s.wavesCleared = wave;
    grant(s, waveReward(wave));
    if (s.unlockedPlots < TOTAL_PLOTS) s.unlockedPlots += 1;
    s.stats.kills += 5;
    addHeroXp(s, 'combat', 18 + wave * 10);
    pushLog(s, `Wave ${wave} broken. A new plot opens on the frontier.`, 'epic');
    for (const isl of ISLANDS) {
      if (isl.id > 0 && s.wavesCleared === isl.needWaves) {
        pushLog(s, `${isl.name} can now be reached at Command Center Level ${isl.needHq}.`, 'ok');
      }
    }
    return true;
  }
  const lost = applyLosses(s, 0.22);
  pushLog(s, `Wave ${wave} held. Lost ${lost} unit${lost === 1 ? '' : 's'} — rebuild and try again.`, 'warn');
  return false;
}

/* ------------------------------------------------------------------ *
 * Gear
 * ------------------------------------------------------------------ */

export function equipGear(s: GameState, gearId: string): boolean {
  const g = s.gear.find((x) => x.id === gearId);
  if (!g) return false;
  if (s.equipped[g.slot] === g.id) {
    delete s.equipped[g.slot];
    pushLog(s, `Unequipped ${g.name}.`, 'info');
  } else {
    s.equipped[g.slot] = g.id;
    pushLog(s, `Equipped ${g.name}. Bonuses from the old ${g.slot} are gone.`, 'ok');
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Alliance — invite links and cards
 * ------------------------------------------------------------------ */

interface Card {
  n: string;
  c: string;
  a?: string;
  h: number;
  p: number;
  s: number;
  t: number;
}

export function encodeCard(s: GameState): string {
  const payload: Card = {
    n: s.name,
    c: s.alliance.code,
    a: s.alliance.name,
    h: hqLevel(s),
    p: Math.round(powerOf(s)),
    s: s.seed,
    t: Date.now(),
  };
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeCard(code: string): Card | null {
  try {
    let raw = code.trim();
    if (!raw) return null;
    if (raw.includes('ally=')) {
      const url = new URL(raw, 'https://example.invalid/');
      raw = url.searchParams.get('ally') ?? '';
    }
    if (!raw) return null;
    const json = decodeURIComponent(atob(raw));
    const parsed = JSON.parse(json) as Card;
    if (!parsed || typeof parsed.n !== 'string' || typeof parsed.c !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function inviteLink(s: GameState): string {
  const code = encodeCard(s);
  if (typeof window === 'undefined') return code;
  const url = new URL(window.location.href);
  url.searchParams.set('ally', code);
  return url.toString();
}

export function addAlly(s: GameState, code: string): boolean {
  const card = decodeCard(code);
  if (!card) {
    pushLog(s, 'That banner code could not be read. Copy the whole link or code.', 'warn');
    return false;
  }
  if (card.c && card.c !== s.alliance.code) {
    s.alliance.code = card.c;
    if (card.a) s.alliance.name = card.a;
  }
  const memberId = `${card.n}|${card.t}`;
  if (s.alliance.members.some((m) => m.id === memberId)) {
    pushLog(s, `${card.n} is already on this banner.`, 'info');
    return false;
  }
  s.alliance.members.unshift({
    id: memberId,
    name: card.n,
    hq: card.h,
    power: card.p,
    joinedAt: Date.now(),
    lastSupplyAt: 0,
  });
  pushLog(s, `${card.n} (HQ ${card.h}, ${fmt(card.p)} power) joined ${s.alliance.name}.`, 'epic');
  return true;
}

export const SUPPLY_COOLDOWN = 30 * 60 * 1000;

export function claimSupply(s: GameState, allyId: string): boolean {
  const m = s.alliance.members.find((x) => x.id === allyId);
  if (!m) return false;
  const wait = SUPPLY_COOLDOWN - (Date.now() - m.lastSupplyAt);
  if (wait > 0) {
    pushLog(s, `${m.name}'s next supply drop is ready in ${fmtTime(wait / 1000)}.`, 'warn');
    return false;
  }
  m.lastSupplyAt = Date.now();
  const gain: Partial<Resources> = {
    gold: Math.round(70 + m.hq * 22),
    wood: Math.round(60 + m.hq * 18),
    food: Math.round(45 + m.hq * 14),
  };
  grant(s, gain);
  pushLog(s, `${m.name} sent a supply drop.`, 'ok');
  return true;
}
