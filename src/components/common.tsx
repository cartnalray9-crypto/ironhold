import type { ReactNode } from 'react';
import type { GameState, Job, Resources } from '../types';
import { RES_KEYS, RES_META, fmt, fmtTime } from '../game/data';

export type Act = (fn: (s: GameState) => void) => void;

export type TabKey = 'research' | 'troops' | 'heroes' | 'world' | 'banner';

export function Cost({ cost }: { cost: Partial<Resources> }) {
  const keys = RES_KEYS.filter((k) => (cost[k] ?? 0) > 0);
  if (!keys.length) return <span className="muted">free</span>;
  return (
    <span className="cost">
      {keys.map((k) => (
        <span className="cost-chip" key={k}>
          <span className="ico">{RES_META[k].icon}</span>
          {fmt(cost[k] ?? 0)}
        </span>
      ))}
    </span>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1e-6, max)) * 100));
  return (
    <div className="bar">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function JobRow({ job }: { job: Job }) {
  const now = Date.now();
  const left = Math.max(0, (job.endsAt - now) / 1000);
  const done = Math.max(0, job.duration - left);
  return (
    <div className="job">
      <div className="job-top">
        <span>{job.label}</span>
        <span className="num">{fmtTime(left)}</span>
      </div>
      <Bar value={done} max={job.duration} />
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}
