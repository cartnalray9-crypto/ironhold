import type {
  Branch,
  BuildingKind,
  Category,
  Gear,
  HeroFocus,
  ResKey,
  Resources,
  Slot,
  TrackKey,
  Zone,
} from '../types';

export const SAVE_VERSION = 1;

export const RES_KEYS: ResKey[] = ['gold', 'wood', 'stone', 'food', 'ore'];

export const RES_META: Record<ResKey, { name: string; icon: string; color: string }> = {
  gold: { name: 'Gold', icon: '🪙', color: '#f2c14e' },
  wood: { name: 'Wood', icon: '🪵', color: '#c08a5a' },
  stone: { name: 'Stone', icon: '🧱', color: '#9aa8b6' },
  food: { name: 'Food', icon: '🌾', color: '#b8cf6a' },
  ore: { name: 'Ore', icon: '⛓', color: '#6fc7d8' },
};

export function emptyResources(): Resources {
  return { gold: 0, wood: 0, stone: 0, food: 0, ore: 0 };
}

/* ------------------------------------------------------------------ *
 * Global limits
 * ------------------------------------------------------------------ */

export const MAX_HQ = 80;
export const MAX_TRACK = 40;
export const MERGE_GAP = 3;
export const UNIT_GAP = 3;
export const TOTAL_PLOTS = 72;
export const START_PLOTS = 9;
export const MAX_OFFLINE = 12 * 3600;
export const MAX_HERO_LEVEL = 40;
export const GATHER_TIMES = [60, 300, 900];
export const GATHER_SLOTS = 2;

/* ------------------------------------------------------------------ *
 * Islands and plots
 * ------------------------------------------------------------------ */

export const PLOTS_PER_ISLAND = 24;

export interface IslandDef {
  id: number;
  name: string;
  cols: number;
  rows: number;
  needHq: number;
  needWaves: number;
}

export const ISLANDS: IslandDef[] = [
  { id: 0, name: 'Home Isle', cols: 6, rows: 4, needHq: 0, needWaves: 0 },
  { id: 1, name: 'Tidebreak Isle', cols: 6, rows: 4, needHq: 10, needWaves: 10 },
  { id: 2, name: 'Stormcrag Isle', cols: 6, rows: 4, needHq: 20, needWaves: 20 },
];

function centerOutOrder(cols: number, rows: number): number[] {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const idx: number[] = [];
  for (let i = 0; i < cols * rows; i++) idx.push(i);
  idx.sort((a, b) => {
    const ax = a % cols;
    const ay = Math.floor(a / cols);
    const bx = b % cols;
    const by = Math.floor(b / cols);
    const da = Math.hypot(ax - cx, ay - cy);
    const db = Math.hypot(bx - cx, by - cy);
    if (Math.abs(da - db) > 0.001) return da - db;
    return a - b;
  });
  return idx;
}

/** Plot indices in the order they get unlocked, starting at the island centre. */
export const PLOT_ORDER = centerOutOrder(ISLANDS[0].cols, ISLANDS[0].rows);

export function plotGlobalIndex(island: number, plot: number): number {
  const within = PLOT_ORDER.indexOf(plot);
  if (within < 0) return -1;
  return island * PLOTS_PER_ISLAND + within;
}

export function isPlotUnlocked(unlockedPlots: number, island: number, plot: number): boolean {
  const g = plotGlobalIndex(island, plot);
  return g >= 0 && g < unlockedPlots;
}

export function islandOpen(wavesCleared: number, hqLevel: number, island: number): boolean {
  const def = ISLANDS[island];
  if (!def) return false;
  return wavesCleared >= def.needWaves && hqLevel >= def.needHq;
}

/* ------------------------------------------------------------------ *
 * Buildings
 * ------------------------------------------------------------------ */

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  icon: string;
  cat: Category;
  produces?: ResKey;
  branch?: Branch;
  unique?: boolean;
  blurb: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  command: {
    kind: 'command',
    name: 'Command Center',
    icon: '❖',
    cat: 'command',
    unique: true,
    blurb: 'Gates research levels, merge ceilings and island expansion. Max level 80.',
  },
  goldmine: { kind: 'goldmine', name: 'Gold Mine', icon: '⛏', cat: 'economy', produces: 'gold', blurb: 'Produces gold over time.' },
  lumbermill: { kind: 'lumbermill', name: 'Lumber Mill', icon: '🪓', cat: 'economy', produces: 'wood', blurb: 'Produces wood over time.' },
  quarry: { kind: 'quarry', name: 'Quarry', icon: '🪨', cat: 'economy', produces: 'stone', blurb: 'Produces stone over time.' },
  farm: { kind: 'farm', name: 'Farm', icon: '🌾', cat: 'economy', produces: 'food', blurb: 'Produces food for training and for hunting.' },
  oremine: { kind: 'oremine', name: 'Ore Mine', icon: '⚙', cat: 'economy', produces: 'ore', blurb: 'Produces ore for high-tier units.' },
  barracks: { kind: 'barracks', name: 'Barracks', icon: '🛡', cat: 'military', branch: 'army', blurb: 'Trains Army units. Its level raises that branch trainable tier ceiling.' },
  shipyard: { kind: 'shipyard', name: 'Shipyard', icon: '⚓', cat: 'military', branch: 'navy', blurb: 'Trains Navy units.' },
  airbase: { kind: 'airbase', name: 'Air Base', icon: '✈', cat: 'military', branch: 'air', blurb: 'Trains Air units.' },
  research: { kind: 'research', name: 'Research Center', icon: '🔬', cat: 'support', blurb: 'Runs one research project at a time. Everything is gated by it.' },
  repair: { kind: 'repair', name: 'Repair Factory', icon: '🔧', cat: 'support', blurb: 'Cuts troop losses by 4% per level (max 48%).' },
  decor: { kind: 'decor', name: 'Decor Garden', icon: '🌳', cat: 'support', blurb: '+2% training speed per level. Two level-N gardens beat one merged garden.' },
};

export const BUILD_ORDER: BuildingKind[] = [
  'goldmine',
  'lumbermill',
  'quarry',
  'farm',
  'oremine',
  'barracks',
  'shipyard',
  'airbase',
  'research',
  'repair',
  'decor',
];

const COST_BASE: Record<BuildingKind, Partial<Resources>> = {
  command: { gold: 220, wood: 180, stone: 140 },
  goldmine: { gold: 60, wood: 80 },
  lumbermill: { gold: 70, stone: 50 },
  quarry: { gold: 80, wood: 70 },
  farm: { gold: 60, wood: 50 },
  oremine: { gold: 100, wood: 80 },
  barracks: { gold: 110, wood: 120, stone: 50 },
  shipyard: { gold: 130, wood: 140, stone: 70 },
  airbase: { gold: 160, wood: 160, stone: 90, ore: 20 },
  research: { gold: 140, wood: 130, stone: 90 },
  repair: { gold: 120, wood: 110, stone: 120 },
  decor: { gold: 40, wood: 30 },
};

export function costFor(kind: BuildingKind, level: number): Partial<Resources> {
  const m = Math.pow(1.28, Math.max(0, level - 1));
  const base = COST_BASE[kind];
  const out: Partial<Resources> = {};
  for (const k of RES_KEYS) {
    const v = base[k];
    if (v) out[k] = Math.ceil(v * m);
  }
  return out;
}

const TIME_BASE: Record<Category, number> = { command: 30, economy: 9, military: 18, support: 14 };

export function timeFor(kind: BuildingKind, level: number): number {
  const base = TIME_BASE[BUILDINGS[kind].cat];
  return Math.min(4 * 3600, Math.max(3, Math.round(base * Math.pow(1.24, Math.max(0, level - 1)))));
}

const PROD_BASE: Record<ResKey, number> = { gold: 0.9, wood: 1.05, stone: 0.8, food: 1.0, ore: 0.45 };

export function prodFor(kind: BuildingKind, level: number): number {
  const def = BUILDINGS[kind];
  if (!def.produces) return 0;
  return PROD_BASE[def.produces] * Math.pow(Math.max(1, level), 1.2);
}

/* ------------------------------------------------------------------ *
 * Research — the three-tier stair-step
 * ------------------------------------------------------------------ */

export interface TrackDef {
  key: TrackKey;
  name: string;
  icon: string;
  blurb: string;
}

export const TRACKS: TrackDef[] = [
  {
    key: 'construction',
    name: 'Structure Level',
    icon: '🏗',
    blurb: 'New structures are built at this level, and it sets the merge ceiling: merges reach at most 3 levels above it.',
  },
  {
    key: 'merge',
    name: 'Merge Level',
    icon: '🔗',
    blurb: 'Hard cap on how high any structure may be merged. Never more than 3 above Structure Level.',
  },
  {
    key: 'unitForce',
    name: 'Unit Force Combination',
    icon: '🎖',
    blurb: 'Hard cap on troop combination tiers. Never more than 3 above the Merge Level.',
  },
];

export function mergeCapOf(research: Record<TrackKey, number>): number {
  return Math.min(research.merge, research.construction + MERGE_GAP);
}

export function unitCapOf(research: Record<TrackKey, number>): number {
  return Math.min(research.unitForce, mergeCapOf(research) + UNIT_GAP);
}

export function researchCost(track: TrackKey, level: number): Partial<Resources> {
  const base: Record<TrackKey, Partial<Resources>> = {
    construction: { gold: 160, wood: 120 },
    merge: { gold: 200, stone: 140 },
    unitForce: { gold: 240, food: 160, ore: 20 },
  };
  const m = Math.pow(1.42, Math.max(0, level - 1));
  const out: Partial<Resources> = {};
  for (const k of RES_KEYS) {
    const v = base[track][k];
    if (v) out[k] = Math.ceil(v * m);
  }
  return out;
}

export function researchTime(track: TrackKey, level: number): number {
  const base = track === 'unitForce' ? 40 : 30;
  return Math.min(3 * 3600, Math.max(5, Math.round(base * Math.pow(1.28, Math.max(0, level - 1)))));
}

/** Highest research level a track can reach, given what the other tracks allow. */
export function trackCeiling(track: TrackKey, research: Record<TrackKey, number>): number {
  if (track === 'construction') return MAX_TRACK;
  if (track === 'merge') return Math.min(MAX_TRACK, research.construction + MERGE_GAP);
  return Math.min(MAX_TRACK, mergeCapOf(research) + UNIT_GAP);
}

/* ------------------------------------------------------------------ *
 * Troops
 * ------------------------------------------------------------------ */

export interface BranchDef {
  key: Branch;
  name: string;
  kind: BuildingKind;
  icon: string;
  unit: string;
  mul: number;
  blurb: string;
}

export const BRANCHES: BranchDef[] = [
  { key: 'army', name: 'Army', kind: 'barracks', icon: '🛡', unit: 'Infantry', mul: 1, blurb: 'Cheap and sturdy. Holds the line.' },
  { key: 'navy', name: 'Navy', kind: 'shipyard', icon: '⚓', unit: 'Warship', mul: 1.15, blurb: 'More power per unit, slower to train.' },
  { key: 'air', name: 'Air Force', kind: 'airbase', icon: '✈', unit: 'Aircraft', mul: 1.3, blurb: 'Highest power per unit, costs ore.' },
];

export function branchDef(branch: Branch): BranchDef {
  return BRANCHES.find((b) => b.key === branch) ?? BRANCHES[0];
}

export function unitPower(tier: number, mul = 1): number {
  return 8 * Math.pow(Math.max(1, tier), 1.6) * mul;
}

export function unitCost(tier: number): Partial<Resources> {
  const m = Math.pow(Math.max(1, tier), 1.45);
  const out: Partial<Resources> = { food: Math.ceil(18 * m), gold: Math.ceil(10 * m) };
  if (tier >= 4) out.ore = Math.ceil(3 * m);
  return out;
}

export function unitTime(tier: number): number {
  return Math.max(2, Math.round(5 * Math.pow(Math.max(1, tier), 1.25)));
}

/* ------------------------------------------------------------------ *
 * Campaign waves
 * ------------------------------------------------------------------ */

export function wavePower(n: number): number {
  return 42 * Math.pow(1.55, Math.max(0, n - 1));
}

export function waveReward(n: number): Partial<Resources> {
  const m = Math.pow(1.5, Math.max(0, n - 1));
  return {
    gold: Math.ceil(70 * m),
    wood: Math.ceil(60 * m),
    stone: Math.ceil(40 * m),
    food: Math.ceil(30 * m),
  };
}

/** Waves you must have cleared before the Command Center can reach this level. */
export function hqWaveGate(level: number): number {
  return Math.ceil(level * 0.9);
}

/* ------------------------------------------------------------------ *
 * World map — fog of war, monsters, gear
 * ------------------------------------------------------------------ */

export const ZONE_COLS = 9;
export const ZONE_ROWS = 7;

const ZONE_ADJ = ['Sunken', 'Ashen', 'Verdant', 'Fractured', 'Hollow', 'Gilded', 'Stormworn', 'Frostbitten', 'Crimson', 'Wraithen'];
const ZONE_NOUN = ['Ridge', 'Dunes', 'Reach', 'Hollow', 'Marsh', 'Spire', 'Expanse', 'Glade', 'Basin', 'Bluffs'];

function hash(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = Math.abs(h) % 100000;
  return h;
}

function zoneName(col: number, row: number, seed: number): string {
  const h = hash(col, row, seed);
  return `${ZONE_ADJ[h % ZONE_ADJ.length]} ${ZONE_NOUN[(h >> 3) % ZONE_NOUN.length]}`;
}

export function makeZones(seed: number): Zone[] {
  const zones: Zone[] = [];
  const hc = Math.floor(ZONE_COLS / 2);
  const hr = Math.floor(ZONE_ROWS / 2);
  for (let row = 0; row < ZONE_ROWS; row++) {
    for (let col = 0; col < ZONE_COLS; col++) {
      const depth = Math.max(Math.abs(col - hc), Math.abs(row - hr));
      zones.push({
        id: `${col}:${row}`,
        name: zoneName(col, row, seed),
        col,
        row,
        depth,
        revealed: depth === 0,
        hunts: 0,
      });
    }
  }
  return zones;
}

export function zoneNeighbors(z: Zone): string[] {
  return [
    `${z.col + 1}:${z.row}`,
    `${z.col - 1}:${z.row}`,
    `${z.col}:${z.row + 1}`,
    `${z.col}:${z.row - 1}`,
  ];
}

export function zonePower(depth: number): number {
  return 55 * Math.pow(1.7, depth);
}

export function zoneHuntCost(depth: number): Partial<Resources> {
  return { food: Math.ceil(30 * Math.pow(1.45, depth)) };
}

export function zoneScoutCost(depth: number): Partial<Resources> {
  const m = Math.pow(1.4, depth);
  return { gold: Math.ceil(50 * m), wood: Math.ceil(35 * m) };
}

export function zoneScoutTime(depth: number): number {
  return 18 + depth * 16;
}

export function zoneLoot(depth: number): Partial<Resources> {
  const m = Math.pow(1.6, depth);
  return { gold: Math.ceil(90 * m), ore: Math.ceil(10 * m), food: Math.ceil(50 * m) };
}

const GEAR_QUALITY = ['Crude', 'Worn', 'Sturdy', 'Honed', 'Master', 'Fabled', 'Mythic'];
const GEAR_NOUNS: Record<Slot, string[]> = {
  weapon: ['Blade', 'Glaive', 'Maul', 'Lance', 'Carbine'],
  armor: ['Plate', 'Hauberk', 'Aegis', 'Carapace', 'Rig'],
  relic: ['Sigil', 'Idol', 'Core', 'Charm', 'Codex'],
};

export function rollGear(depth: number, rand: () => number): Gear {
  const slots: Slot[] = ['weapon', 'armor', 'relic'];
  const slot = slots[Math.floor(rand() * slots.length) % slots.length];
  const tier = Math.max(1, Math.min(7, 1 + depth + (rand() < 0.3 ? 1 : 0)));
  const mul = Math.pow(tier, 1.35);
  const gear: Gear = {
    id: `g_${Math.floor(rand() * 1e9).toString(36)}`,
    name: `${GEAR_QUALITY[tier - 1]} ${GEAR_NOUNS[slot][Math.floor(rand() * GEAR_NOUNS[slot].length) % GEAR_NOUNS[slot].length]}`,
    slot,
    tier,
    atk: 0,
    gather: 0,
    build: 0,
    prod: 0,
  };
  if (slot === 'weapon') gear.atk = Math.max(1, Math.round(4 * mul));
  if (slot === 'armor') {
    gear.build = Math.max(1, Math.round(3 * mul));
    gear.prod = Math.max(1, Math.round(2 * mul));
  }
  if (slot === 'relic') {
    gear.gather = Math.max(1, Math.round(4 * mul));
    gear.prod = Math.max(1, Math.round(2 * mul));
  }
  return gear;
}

/* ------------------------------------------------------------------ *
 * Heroes
 * ------------------------------------------------------------------ */

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  focus: HeroFocus;
  reqGatherSeconds: number;
  reqKills: number;
  blurb: string;
}

export const HEROES: HeroDef[] = [
  {
    id: 'vane',
    name: 'Ira Vane',
    title: 'Vanguard',
    focus: 'combat',
    reqGatherSeconds: 0,
    reqKills: 0,
    blurb: '+2% battle power per level.',
  },
  {
    id: 'reed',
    name: 'Silas Reed',
    title: 'Pathfinder',
    focus: 'gather',
    reqGatherSeconds: 240,
    reqKills: 3,
    blurb: '+2% gathering yield per level. Joins from time spent gathering and hunting.',
  },
  {
    id: 'holt',
    name: 'Mira Holt',
    title: 'Architect',
    focus: 'build',
    reqGatherSeconds: 1200,
    reqKills: 12,
    blurb: '+1.5% build speed per level. Joins once you have truly worked the frontier.',
  },
];

export const HERO_PER_LEVEL: Record<HeroFocus, number> = { combat: 0.02, gather: 0.02, build: 0.015 };

export function xpNeed(level: number): number {
  return Math.round(60 * Math.pow(Math.max(1, level), 1.5));
}

export function heroUnlocked(def: HeroDef, gatherSeconds: number, kills: number): boolean {
  return gatherSeconds >= def.reqGatherSeconds && kills >= def.reqKills;
}

/* ------------------------------------------------------------------ *
 * Gathering (always available, for every resource)
 * ------------------------------------------------------------------ */

export function gatherRate(hqLevel: number): number {
  return 0.8 + 0.3 * hqLevel;
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function fmt(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) < 1000) return String(v);
  return compact.format(v);
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}
