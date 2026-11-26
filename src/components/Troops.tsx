import { useState } from 'react';
import type { Branch, GameState } from '../types';
import { BRANCHES, BUILDINGS, fmt, fmtTime, unitCost, unitPower, unitTime } from '../game/data';
import {
  combineTroops,
  maxBranchLevel,
  powerOf,
  scaleCost,
  trainJob,
  trainTierCap,
  trainTroops,
  trainingSpeedBonus,
  troopPower,
  troopTiers,
} from '../game/engine';
import { Cost, JobRow, Note, type Act } from './common';

interface Form {
  tier: number;
  count: number;
}

export default function Troops({ s, act }: { s: GameState; act: Act }) {
  const [form, setForm] = useState<Record<Branch, Form>>({
    army: { tier: 1, count: 10 },
    navy: { tier: 1, count: 5 },
    air: { tier: 1, count: 5 },
  });

  const setBranch = (key: Branch, patch: Partial<Form>) => {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  };

  return (
    <div className="stack">
      {BRANCHES.map((b) => {
        const cap = trainTierCap(s, b.key);
        const level = maxBranchLevel(s, b.key);
        const job = trainJob(s, b.key);
        const tier = Math.min(form[b.key].tier, Math.max(1, cap));
        const count = Math.max(1, form[b.key].count);
        const cost = scaleCost(unitCost(tier), count);
        const seconds = Math.max(2, Math.round(unitTime(tier) * count * (1 - trainingSpeedBonus(s))));
        const tiers = troopTiers(s, b.key);

        return (
          <div className="card" key={b.key}>
            <div className="card-head">
              <h2>
                {b.icon} {b.name}
              </h2>
              <span className="pill">
                {BUILDINGS[b.kind].name} Lv {level}
              </span>
            </div>
            <Note>
              {b.blurb} Tier ceiling: <b>Tier {cap}</b> — set by this building's level + 3, capped by Unit Force
              Combination research.
            </Note>

            {level === 0 ? (
              <p className="warn">No {BUILDINGS[b.kind].name} yet — raise one on an island plot.</p>
            ) : (
              <>
                <div className="form-row">
                  <label>
                    Tier
                    <select value={tier} onChange={(e) => setBranch(b.key, { tier: Number(e.target.value) })}>
                      {Array.from({ length: Math.max(1, cap) }, (_, i) => i + 1).map((t) => (
                        <option key={t} value={t}>
                          Tier {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Count
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={count}
                      onChange={(e) => setBranch(b.key, { count: Number(e.target.value) })}
                    />
                  </label>
                  <span className="muted">{fmtTime(seconds)}</span>
                  <Cost cost={cost} />
                  <button
                    className="btn primary"
                    disabled={!!job}
                    onClick={() =>
                      act((st) => {
                        trainTroops(st, b.key, tier, count);
                      })
                    }
                  >
                    Train
                  </button>
                </div>
                {job && <JobRow job={job} />}

                {tiers.length === 0 ? (
                  <p className="muted">No {b.unit} in the field yet.</p>
                ) : (
                  <div className="stack-list">
                    {tiers.map((t) => {
                      const n = s.troops[b.key][String(t)] ?? 0;
                      const canCombine = n >= 2 && t + 1 <= cap;
                      return (
                        <div className="row-line" key={t}>
                          <span className="tag">Tier {t}</span>
                          <span>
                            {fmt(n)}× {b.unit}
                          </span>
                          <span className="muted">{fmt(n * unitPower(t, b.mul))} power</span>
                          <button
                            className="btn tiny"
                            disabled={!canCombine}
                            onClick={() =>
                              act((st) => {
                                combineTroops(st, b.key, t);
                              })
                            }
                          >
                            Combine 2 → T{t + 1}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <div className="card">
        <div className="card-head">
          <h2>Army totals</h2>
          <span className="pill">{fmt(powerOf(s))} power</span>
        </div>
        <Note>
          Battle power {fmt(powerOf(s))} — troop power {fmt(troopPower(s))} raised by hero and gear bonuses. Combining
          two units of the same tier makes one unit of the next tier; it is never instant power you can buy, only time
          you convert.
        </Note>
      </div>
    </div>
  );
}
