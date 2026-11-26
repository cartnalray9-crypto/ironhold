import type { GameState } from '../types';
import {
  MERGE_GAP,
  TRACKS,
  UNIT_GAP,
  fmtTime,
  mergeCapOf,
  researchCost,
  researchTime,
  trackCeiling,
  unitCapOf,
} from '../game/data';
import { hqLevel, researchJob, startResearch } from '../game/engine';
import { Cost, JobRow, Note, type Act } from './common';

export default function Research({ s, act }: { s: GameState; act: Act }) {
  const job = researchJob(s);
  const hq = hqLevel(s);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Three-tier progression</h2>
          <span className="pill">HQ Lv {hq}</span>
        </div>
        <div className="chain">
          <div>
            <span className="muted">Structure</span>
            <b>Lv {s.research.construction}</b>
          </div>
          <span className="arrow">→</span>
          <div>
            <span className="muted">Merge ceiling</span>
            <b>Lv {mergeCapOf(s.research)}</b>
          </div>
          <span className="arrow">→</span>
          <div>
            <span className="muted">Troop tier ceiling</span>
            <b>Tier {unitCapOf(s.research)}</b>
          </div>
        </div>
        <Note>
          New structures are built at the Structure Level. Merging can push a structure at most {MERGE_GAP} levels above
          that, and the Merge Level track caps it further. Troop combination follows the same stair-step:
          merge ceiling + {UNIT_GAP}. Nothing here can be purchased.
        </Note>
      </div>

      {TRACKS.map((t) => {
        const level = s.research[t.key];
        const target = level + 1;
        const ceiling = trackCeiling(t.key, s.research);
        const blockedByCeiling = target > ceiling;
        const blockedByHq = hq < target;
        const running = job?.track === t.key;
        return (
          <div className="card" key={t.key}>
            <div className="card-head">
              <h2>
                {t.icon} {t.name}
              </h2>
              <span className="pill">Level {level}</span>
            </div>
            <Note>{t.blurb}</Note>
            <div className="form-row">
              <Cost cost={researchCost(t.key, target)} />
              <span className="muted">{fmtTime(researchTime(t.key, target))}</span>
              <span className="muted">Needs HQ Lv {target}</span>
              <button
                className="btn primary"
                disabled={!!job || blockedByCeiling || blockedByHq}
                onClick={() =>
                  act((st) => {
                    startResearch(st, t.key);
                  })
                }
              >
                Research Lv {target}
              </button>
            </div>
            {blockedByCeiling && <p className="warn">Capped at Level {ceiling} by the stair-step rule.</p>}
            {!blockedByCeiling && blockedByHq && (
              <p className="warn">Command Center must reach Level {target} first.</p>
            )}
            {running && job && <JobRow job={job} />}
          </div>
        );
      })}
    </div>
  );
}
