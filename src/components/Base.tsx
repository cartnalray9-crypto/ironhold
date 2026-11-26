import { useState } from 'react';
import type { Building, BuildingKind, GameState, ResKey } from '../types';
import {
  BUILDINGS,
  BUILD_ORDER,
  GATHER_TIMES,
  ISLANDS,
  RES_KEYS,
  RES_META,
  TOTAL_PLOTS,
  costFor,
  fmt,
  fmtTime,
  hqWaveGate,
  islandOpen,
  isPlotUnlocked,
  mergeCapOf,
  prodFor,
  timeFor,
} from '../game/data';
import {
  activeBuilders,
  build,
  builderLimit,
  demolishBuilding,
  gatherJobCount,
  gatherYield,
  heroBonus,
  hqLevel,
  mergeBuilding,
  mergeCandidates,
  moveBuilding,
  productionRates,
  startGather,
  upgradeBuilding,
} from '../game/engine';
import { Cost, Note, type Act, type TabKey } from './common';

interface Props {
  s: GameState;
  act: Act;
  island: number;
  setIsland: (n: number) => void;
  selectedUid: string | null;
  setSelectedUid: (uid: string | null) => void;
  setTab: (t: TabKey) => void;
}

export default function Base({ s, act, island, setIsland, selectedUid, setSelectedUid, setTab }: Props) {
  const [buildAt, setBuildAt] = useState<{ island: number; plot: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [armed, setArmed] = useState(false);
  const [gatherSecs, setGatherSecs] = useState(GATHER_TIMES[0]);

  const hq = hqLevel(s);
  const def = ISLANDS[island];
  const rates = productionRates(s);
  const selected = s.buildings.find((b) => b.uid === selectedUid) ?? null;
  const candidates: Building[] = selected ? mergeCandidates(s, selected) : [];
  const mergeCap = mergeCapOf(s.research);
  const buildCost = costFor('goldmine', s.research.construction);

  function clickPlot(plot: number) {
    if (!isPlotUnlocked(s.unlockedPlots, island, plot)) return;
    const b = s.buildings.find((x) => x.island === island && x.plot === plot);
    if (b) {
      if (moving && selected && selected.uid !== b.uid) {
        act((st) => {
          moveBuilding(st, selected.uid, island, plot);
        });
        setMoving(false);
        return;
      }
      setSelectedUid(b.uid);
      setMoving(false);
      setArmed(false);
      return;
    }
    if (moving && selected) {
      act((st) => {
        moveBuilding(st, selected.uid, island, plot);
      });
      setMoving(false);
      return;
    }
    setBuildAt({ island, plot });
  }

  const canBuildHere = buildAt ? isPlotUnlocked(s.unlockedPlots, buildAt.island, buildAt.plot) : false;
  const gatherFull = gatherJobCount(s) >= 2;

  return (
    <section className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Island Command</h2>
          <div className="meta-row">
            <span className="pill">Crews {activeBuilders(s)}/{builderLimit(s)}</span>
            <span className="pill">Plots {Math.min(s.unlockedPlots, TOTAL_PLOTS)}/{TOTAL_PLOTS}</span>
            <span className="pill">HQ Lv {hq}</span>
          </div>
        </div>

        <div className="island-tabs">
          {ISLANDS.map((isl) => {
            const open = islandOpen(s.wavesCleared, hq, isl.id);
            return (
              <button
                key={isl.id}
                className={`island-tab ${island === isl.id ? 'active' : ''}`}
                onClick={() => {
                  setIsland(isl.id);
                  setSelectedUid(null);
                  setMoving(false);
                }}
                title={open ? isl.name : `Needs Command Center Lv ${isl.needHq} and ${isl.needWaves} waves cleared`}
              >
                {isl.name}
                {!open && <span className="lock-tag">🔒</span>}
              </button>
            );
          })}
        </div>

        <div className="island-grid" style={{ gridTemplateColumns: `repeat(${def.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: def.cols * def.rows }, (_, plot) => {
            const unlocked = isPlotUnlocked(s.unlockedPlots, island, plot);
            const b = s.buildings.find((x) => x.island === island && x.plot === plot);
            if (!unlocked) {
              return (
                <div className="plot locked" key={plot} title="Wilderness — clear campaign waves to expand">
                  <span className="ico">🌫</span>
                </div>
              );
            }
            if (!b) {
              return (
                <button
                  className={`plot empty ${moving ? 'move' : ''}`}
                  key={plot}
                  onClick={() => clickPlot(plot)}
                  title="Empty plot — build here"
                >
                  <span className="plus">+</span>
                </button>
              );
            }
            const busy = s.jobs.some((j) => j.type === 'upgrade' && j.buildingUid === b.uid);
            const isSel = selected?.uid === b.uid;
            const isCand = !!selected && candidates.some((c) => c.uid === b.uid);
            return (
              <button
                className={`plot built ${isSel ? 'sel' : ''} ${isCand ? 'cand' : ''} ${busy ? 'busy' : ''}`}
                key={plot}
                onClick={() => clickPlot(plot)}
                title={`${BUILDINGS[b.kind].name} · Level ${b.level}`}
              >
                <span className="ico">{BUILDINGS[b.kind].icon}</span>
                <span className="lv">{b.level}</span>
              </button>
            );
          })}
        </div>

        <Note>
          Tap an empty plot to build, a structure to manage it. Each campaign wave you break unlocks one more plot —
          space is the real limit, so merge deliberately.
        </Note>
      </div>

      {selected && (
        <div className="card detail">
          <div className="card-head">
            <h2>
              {BUILDINGS[selected.kind].icon} {BUILDINGS[selected.kind].name}{' '}
              <span className="pill">Lv {selected.level}</span>
            </h2>
            <button className="btn tiny ghost" onClick={() => setSelectedUid(null)}>
              Close
            </button>
          </div>
          <p className="hint">{BUILDINGS[selected.kind].blurb}</p>
          {BUILDINGS[selected.kind].produces && (
            <p className="kv">
              Producing <b>{fmt(prodFor(selected.kind, selected.level) * 60)}</b> {RES_META[BUILDINGS[selected.kind].produces as ResKey].name} per minute
            </p>
          )}

          <div className="form-row">
            {selected.kind !== 'command' && selected.level >= s.research.construction ? (
              <span className="muted">
                Structure-capped at Lv {s.research.construction}. Merge to go higher.
              </span>
            ) : (
              <>
                <span className="muted">
                  Upgrade to Lv {selected.level + 1} · {fmtTime(timeFor(selected.kind, selected.level + 1))}
                  {heroBonus(s, 'build') > 0 ? ` (hero −${Math.round(heroBonus(s, 'build') * 100)}%)` : ''}
                </span>
                <Cost cost={costFor(selected.kind, selected.level + 1)} />
                <button
                  className="btn primary"
                  onClick={() =>
                    act((st) => {
                      upgradeBuilding(st, selected.uid);
                    })
                  }
                >
                  Upgrade
                </button>
              </>
            )}
          </div>

          {selected.kind === 'command' && selected.level < 80 && (
            <Note>
              Next Command Center level needs {hqWaveGate(selected.level + 1)} campaign waves cleared.
            </Note>
          )}

          {selected.kind !== 'command' && (
            <div className="form-row">
              <span className="muted">
                Merge ceiling Lv {mergeCap} · {candidates.length} matching partner{candidates.length === 1 ? '' : 's'}
              </span>
              <button
                className="btn"
                disabled={!candidates.length || selected.level + 1 > mergeCap}
                onClick={() =>
                  act((st) => {
                    mergeBuilding(st, selected.uid);
                  })
                }
              >
                Merge 2 → Lv {selected.level + 1}
              </button>
            </div>
          )}

          {(selected.kind === 'barracks' || selected.kind === 'shipyard' || selected.kind === 'airbase') && (
            <div className="form-row">
              <button className="btn" onClick={() => setTab('troops')}>
                Training grounds →
              </button>
              <span className="muted">Deployed troops come from this building's level.</span>
            </div>
          )}

          {selected.kind === 'research' && (
            <div className="form-row">
              <button className="btn" onClick={() => setTab('research')}>
                Research Center →
              </button>
            </div>
          )}

          {selected.kind !== 'command' && (
            <div className="form-row">
              <button
                className={`btn tiny ${moving ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setMoving((m) => !m);
                }}
              >
                {moving ? 'Pick a plot…' : 'Relocate'}
              </button>
              <button
                className={`btn tiny ${armed ? 'danger' : 'ghost'}`}
                onClick={() => {
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  act((st) => {
                    demolishBuilding(st, selected.uid);
                  });
                  setSelectedUid(null);
                  setArmed(false);
                }}
              >
                {armed ? 'Confirm dismantle' : 'Dismantle'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Gathering Parties</h2>
          <span className="pill">{gatherJobCount(s)}/2 out</span>
        </div>
        <Note>
          Every resource can be gathered at any point in the game — nothing is locked behind a purchase or a level.
          Time spent gathering is also how your gatherer hero levels up.
        </Note>
        <div className="seg">
          {GATHER_TIMES.map((t) => (
            <button
              key={t}
              className={`seg-btn ${gatherSecs === t ? 'active' : ''}`}
              onClick={() => setGatherSecs(t)}
            >
              {fmtTime(t)}
            </button>
          ))}
        </div>
        <div className="gather-row">
          {RES_KEYS.map((k) => (
            <button
              key={k}
              className="gather-btn"
              disabled={gatherFull}
              onClick={() =>
                act((st) => {
                  startGather(st, k, gatherSecs);
                })
              }
            >
              <span className="ico">{RES_META[k].icon}</span>
              <span>{RES_META[k].name}</span>
              <b>+{fmt(gatherYield(s, gatherSecs))}</b>
            </button>
          ))}
        </div>
        <div className="meta-row">
          {RES_KEYS.map((k) => (
            <span className="pill" key={k}>
              {RES_META[k].icon} {fmt(rates[k] * 3600)}/h
            </span>
          ))}
          <span className="pill">Build cost from Lv {s.research.construction}: {fmt(buildCost.gold ?? 0)}🪙</span>
        </div>
      </div>

      {buildAt && canBuildHere && (
        <div className="modal-backdrop" onClick={() => setBuildAt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-head">
              <h2>Raise a structure</h2>
              <button className="btn tiny ghost" onClick={() => setBuildAt(null)}>
                Close
              </button>
            </div>
            <Note>
              New structures start at your Structure Level (Lv {s.research.construction}). To go above it you merge two
              identical buildings — never buy your way up.
            </Note>
            <div className="build-grid">
              {BUILD_ORDER.map((kind: BuildingKind) => {
                const cost = costFor(kind, s.research.construction);
                const affordable = RES_KEYS.every((k) => s.resources[k] >= (cost[k] ?? 0));
                return (
                  <button
                    key={kind}
                    className={`build-card ${affordable ? '' : 'off'}`}
                    onClick={() =>
                      act((st) => {
                        build(st, kind, buildAt.island, buildAt.plot);
                      })
                    }
                  >
                    <span className="ico">{BUILDINGS[kind].icon}</span>
                    <b>{BUILDINGS[kind].name}</b>
                    <span className="lv-tag">Lv {s.research.construction}</span>
                    <Cost cost={cost} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
