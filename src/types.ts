export type ResKey = 'gold' | 'wood' | 'stone' | 'food' | 'ore';
export type Resources = Record<ResKey, number>;

export type Branch = 'army' | 'navy' | 'air';

export type BuildingKind =
  | 'command'
  | 'goldmine'
  | 'lumbermill'
  | 'quarry'
  | 'farm'
  | 'oremine'
  | 'barracks'
  | 'shipyard'
  | 'airbase'
  | 'research'
  | 'repair'
  | 'decor';

export type Category = 'command' | 'economy' | 'military' | 'support';

export type TrackKey = 'construction' | 'merge' | 'unitForce';

export type Slot = 'weapon' | 'armor' | 'relic';

export type HeroFocus = 'combat' | 'gather' | 'build';

export interface Building {
  uid: string;
  kind: BuildingKind;
  level: number;
  island: number;
  plot: number;
}

export type JobType = 'upgrade' | 'research' | 'train' | 'scout' | 'gather';

export interface Job {
  id: string;
  type: JobType;
  label: string;
  startedAt: number;
  endsAt: number;
  duration: number;
  buildingUid?: string;
  targetLevel?: number;
  track?: TrackKey;
  branch?: Branch;
  tier?: number;
  count?: number;
  zoneId?: string;
  res?: ResKey;
  amount?: number;
}

export interface Hero {
  id: string;
  level: number;
  xp: number;
}

export interface Gear {
  id: string;
  name: string;
  slot: Slot;
  tier: number;
  atk: number;
  gather: number;
  build: number;
  prod: number;
}

export interface Zone {
  id: string;
  name: string;
  col: number;
  row: number;
  depth: number;
  revealed: boolean;
  hunts: number;
}

export interface Ally {
  id: string;
  name: string;
  hq: number;
  power: number;
  joinedAt: number;
  lastSupplyAt: number;
}

export interface LogEntry {
  id: string;
  at: number;
  text: string;
  tone: 'ok' | 'warn' | 'info' | 'epic';
}

export interface GameState {
  version: number;
  name: string;
  seed: number;
  createdAt: number;
  updatedAt: number;
  resources: Resources;
  buildings: Building[];
  unlockedPlots: number;
  research: Record<TrackKey, number>;
  jobs: Job[];
  troops: Record<Branch, Record<string, number>>;
  heroes: Hero[];
  gear: Gear[];
  equipped: Partial<Record<Slot, string>>;
  zones: Zone[];
  wavesCleared: number;
  log: LogEntry[];
  alliance: { code: string; name: string; members: Ally[] };
  stats: {
    kills: number;
    hunts: number;
    merges: number;
    built: number;
    gathered: number;
    gatherSeconds: number;
  };
}
