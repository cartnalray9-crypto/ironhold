import type { GameState, Slot } from '../types';
import { HEROES, HERO_PER_LEVEL, fmt, fmtTime, xpNeed } from '../game/data';
import { equipGear, heroUnlockedState } from '../game/engine';
import { Bar, Note, type Act } from './common';

const SLOTS: Slot[] = ['weapon', 'armor', 'relic'];

export default function Heroes({ s, act }: { s: GameState; act: Act }) {
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Heroes</h2>
          <span className="pill">
            Gathered {fmtTime(s.stats.gatherSeconds)} · {s.stats.kills} kills
          </span>
        </div>
        <Note>
          Heroes grow from the time you spend gathering and the fights you take. The banner's next hero only joins once
          you have put that time in — there is no other way to get them.
        </Note>
        <div className="hero-grid">
          {HEROES.map((def) => {
            const hero = s.heroes.find((h) => h.id === def.id);
            if (!hero) return null;
            const unlocked = heroUnlockedState(s, def.id);
            const need = xpNeed(hero.level);
            return (
              <div className={`hero-card ${unlocked ? '' : 'locked'}`} key={def.id}>
                <div className="hero-top">
                  <b>{def.name}</b>
                  <span className="tag">{def.title}</span>
                </div>
                {unlocked ? (
                  <>
                    <div className="row-line">
                      <span>Level {hero.level}</span>
                      <span className="muted">
                        {fmt(hero.xp)} / {fmt(need)} XP
                      </span>
                    </div>
                    <Bar value={hero.xp} max={need} />
                    <p className="hint">{def.blurb}</p>
                    <p className="hint">
                      Currently <b>+{Math.round(hero.level * HERO_PER_LEVEL[def.focus] * 100)}%</b>{' '}
                      {def.focus === 'combat' ? 'battle power' : def.focus === 'gather' ? 'gathering yield' : 'build speed'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="warn">Not yet joined.</p>
                    <p className="hint">
                      Requires {fmtTime(def.reqGatherSeconds)} total gathering and {def.reqKills} kills.
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Gear</h2>
          <span className="pill">{s.gear.length} recovered</span>
        </div>
        <Note>
          Gear only comes from exploring the frontier and killing what lives there. The deeper the zone, the better the
          find — nothing drops gear from a shop.
        </Note>
        <div className="slot-row">
          {SLOTS.map((slot) => {
            const id = s.equipped[slot];
            const g = s.gear.find((x) => x.id === id);
            return (
              <div className="slot" key={slot}>
                <span className="muted">{slot}</span>
                {g ? <b>{g.name}</b> : <span className="muted">empty</span>}
              </div>
            );
          })}
        </div>
        {s.gear.length === 0 ? (
          <p className="muted">No gear yet. Scout the map, then hunt a monster.</p>
        ) : (
          <div className="gear-list">
            {s.gear.slice(0, 30).map((g) => {
              const on = s.equipped[g.slot] === g.id;
              return (
                <div className={`gear ${on ? 'on' : ''}`} key={g.id}>
                  <div>
                    <b>{g.name}</b>{' '}
                    <span className="tag">
                      T{g.tier} {g.slot}
                    </span>
                  </div>
                  <div className="muted">
                    {g.atk ? `+${g.atk}% power ` : ''}
                    {g.gather ? `+${g.gather}% gather ` : ''}
                    {g.build ? `+${g.build}% build speed ` : ''}
                    {g.prod ? `+${g.prod}% production` : ''}
                  </div>
                  <button
                    className="btn tiny"
                    onClick={() =>
                      act((st) => {
                        equipGear(st, g.id);
                      })
                    }
                  >
                    {on ? 'Unequip' : 'Equip'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
