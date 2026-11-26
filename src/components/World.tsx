import { useState } from 'react';
import type { GameState } from '../types';
import {
  ISLANDS,
  ZONE_COLS,
  fmt,
  fmtTime,
  wavePower,
  zoneHuntCost,
  zonePower,
  zoneScoutCost,
  zoneScoutTime,
} from '../game/data';
import {
  attackWave,
  huntZone,
  isZoneReachable,
  powerOf,
  scoutJob,
  startScout,
  troopPower,
} from '../game/engine';
import { Cost, JobRow, Note, type Act } from './common';

export default function World({ s, act }: { s: GameState; act: Act }) {
  const [sel, setSel] = useState('4:3');
  const zone = s.zones.find((z) => z.id === sel) ?? s.zones[0];
  const job = scoutJob(s);
  const mine = powerOf(s);
  const nextWave = s.wavesCleared + 1;
  const charted = s.zones.filter((z) => z.revealed).length;
  const reachable = isZoneReachable(s, zone.id);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Campaign</h2>
          <span className="pill">Wave {nextWave} ahead</span>
        </div>
        <Note>
          Breaking a wave opens one more building plot, and the Command Center cannot outlevel your cleared waves. Power
          is compared with a little luck — losing means troops.
        </Note>
        <div className="meta-row">
          <span className="pill">Cleared {s.wavesCleared}</span>
          <span className="pill">Enemy power {fmt(wavePower(nextWave))}</span>
          <span className="pill">Your power {fmt(mine)}</span>
        </div>
        <div className="form-row">
          <button
            className="btn primary"
            disabled={troopPower(s) <= 0}
            onClick={() =>
              act((st) => {
                attackWave(st);
              })
            }
          >
            Assault Wave {nextWave}
          </button>
          {troopPower(s) <= 0 && <span className="muted">Train troops first.</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Frontier</h2>
          <span className="pill">
            {charted}/{s.zones.length} charted
          </span>
        </div>
        <Note>
          Scout outward from charted land. Deeper zones hide stronger monsters, and they are the only place gear comes
          from.
        </Note>
        <div className="zone-grid" style={{ gridTemplateColumns: `repeat(${ZONE_COLS}, minmax(0, 1fr))` }}>
          {s.zones.map((z) => (
            <button
              key={z.id}
              className={`zone d${z.depth} ${z.revealed ? 'revealed' : ''} ${
                isZoneReachable(s, z.id) ? 'reachable' : ''
              } ${zone.id === z.id ? 'sel' : ''}`}
              onClick={() => setSel(z.id)}
              title={`${z.name} · depth ${z.depth}`}
            >
              {z.revealed ? (z.hunts > 0 ? '⚔' : '☠') : '🌫'}
            </button>
          ))}
        </div>

        <div className="zone-panel">
          <div className="card-head">
            <h3>{zone.name}</h3>
            <span className="pill">Depth {zone.depth}</span>
          </div>
          <div className="meta-row">
            <span className="pill">Monster power {fmt(zonePower(zone.depth))}</span>
            <span className="pill">
              Gear tier {Math.min(7, 1 + zone.depth)}–{Math.min(7, 2 + zone.depth)}
            </span>
            <span className="pill">Hunts {zone.hunts}</span>
          </div>
          {!zone.revealed ? (
            <>
              <p className="hint">
                {reachable ? 'Send scouts to chart this zone.' : 'Chart an adjacent zone first.'}
              </p>
              <div className="form-row">
                <Cost cost={zoneScoutCost(zone.depth)} />
                <span className="muted">{fmtTime(zoneScoutTime(zone.depth))}</span>
                <button
                  className="btn"
                  disabled={!reachable || !!job}
                  onClick={() =>
                    act((st) => {
                      startScout(st, zone.id);
                    })
                  }
                >
                  Scout
                </button>
              </div>
              {job?.zoneId === zone.id && <JobRow job={job} />}
            </>
          ) : (
            <>
              <p className="hint">
                Hunt the monster here for loot{zone.depth > 0 ? ' and a chance at gear' : ''}. Your power {fmt(mine)}.
              </p>
              <div className="form-row">
                <Cost cost={zoneHuntCost(zone.depth)} />
                <button
                  className="btn primary"
                  disabled={troopPower(s) <= 0}
                  onClick={() =>
                    act((st) => {
                      huntZone(st, zone.id);
                    })
                  }
                >
                  Hunt
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Islands</h2>
        <div className="meta-row">
          {ISLANDS.map((isl) => (
            <span className="pill" key={isl.id}>
              {isl.name} · HQ {isl.needHq} / {isl.needWaves} waves
            </span>
          ))}
        </div>
        <Note>
          Three islands, 24 plots each. Waves unlock plots in order; islands two and three also need a stronger Command
          Center.
        </Note>
      </div>
    </div>
  );
}
