import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState } from './types';
import { RES_KEYS, RES_META, fmt, fmtTime } from './game/data';
import { addAlly, hqLevel, newGame, powerOf, productionRates, tick } from './game/engine';
import { loadGame, saveGame, stripAllyFromUrl, urlAllyCode } from './game/save';
import Base from './components/Base';
import Research from './components/Research';
import Troops from './components/Troops';
import Heroes from './components/Heroes';
import World from './components/World';
import Banner from './components/Banner';
import type { Act, TabKey } from './components/common';
import { AccountChip, ClashDialog, StartSignIn, useCloudSync } from './components/Account';

const TABS: { key: TabKey; label: string; short: string; icon: string }[] = [
  { key: 'research', label: 'Research', short: 'Tech', icon: '🔬' },
  { key: 'troops', label: 'Troops', short: 'Troops', icon: '🛡' },
  { key: 'heroes', label: 'Heroes', short: 'Heroes', icon: '★' },
  { key: 'world', label: 'Frontier', short: 'Map', icon: '🗺' },
  { key: 'banner', label: 'Banner', short: 'Banner', icon: '⚑' },
];

function Start({ onStart, signin }: { onStart: (name: string) => void; signin: ReactNode }) {
  const [name, setName] = useState('');
  const invited = urlAllyCode() !== null;
  return (
    <div className="start">
      <div className="start-card">
        <div className="brand-mark big">❖</div>
        <h1>Ironhold</h1>
        <p className="sub">Frontier Command · merge, grind, conquer</p>
        <p className="hint">
          Everything is earned. No VIP tiers, no packages, no boosters, no shop of any kind — time on the island and the
          skill of your merge decisions are the only things that make you strong.
        </p>
        <ul className="feature-list">
          <li>Raise structures, then merge two identical ones into the next level. Mismatched levels never combine.</li>
          <li>Three research ceilings gate everything: Structure Level, Merge Level, and Unit Force Combination.</li>
          <li>Train and combine troops, hunt monsters, and break waves to open more island plots.</li>
          <li>Heroes grow from the time you gather and the fights you take. Gear only drops from ground you explore.</li>
        </ul>
        {signin}
        {invited && <p className="okline">You were invited to a banner — you will join it on start.</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(name);
          }}
        >
          <input
            className="name-input"
            placeholder="Commander name"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary big" type="submit">
            Found your banner
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState | null>(() => loadGame());
  const [tab, setTab] = useState<TabKey>('research');
  const [island, setIsland] = useState(0);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const ref = useRef<GameState | null>(null);
  ref.current = state;
  // when this device last played, read before the first catch-up tick moves the clock
  const bootStamp = useRef<number>(-1);
  if (bootStamp.current < 0) bootStamp.current = state?.updatedAt ?? 0;
  const cloud = useCloudSync(ref, bootStamp.current, (s) => {
    ref.current = s;
    setState(s);
  });

  const act: Act = (fn) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      next.updatedAt = Date.now();
      return next;
    });
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        tick(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (ref.current) saveGame(ref.current);
    }, 4000);
    const flush = () => {
      if (ref.current) saveGame(ref.current);
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  const joined = useRef(false);
  useEffect(() => {
    if (joined.current) return;
    joined.current = true;
    const code = urlAllyCode();
    if (!code || !state) return;
    act((st) => {
      addAlly(st, code);
    });
    stripAllyFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) {
    return (
      <Start
        onStart={(name) => setState(newGame(name, urlAllyCode() ?? undefined))}
        signin={<StartSignIn user={cloud.user} status={cloud.status} />}
      />
    );
  }

  const s = state;
  const rates = productionRates(s);
  const jumpToSections = () => {
    document.getElementById('sections')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">❖</div>
          <div>
            <h1>Ironhold</h1>
            <span className="sub">{s.alliance.name}</span>
          </div>
        </div>
        <div className="res-row">
          {RES_KEYS.map((k) => (
            <div className="res-chip" key={k} title={`${RES_META[k].name}: +${fmt(rates[k] * 3600)} per hour`}>
              <span className="ico">{RES_META[k].icon}</span>
              <span className="val">{fmt(s.resources[k])}</span>
              <span className="rate">+{fmt(rates[k] * 3600)}/h</span>
            </div>
          ))}
        </div>
        <div className="topmeta">
          <span className="stat-pill">
            <span className="muted">Power</span> <b>{fmt(powerOf(s))}</b>
          </span>
          <span className="stat-pill">
            <span className="muted">CC</span> <b>Lv {hqLevel(s)}</b>
          </span>
          <span className="stat-pill">
            <span className="muted">Waves</span> <b>{s.wavesCleared}</b>
          </span>
          <AccountChip user={cloud.user} status={cloud.status} />
        </div>
      </header>
      <ClashDialog clash={cloud.clash} local={s} onPick={(k) => void cloud.resolve(k)} />

      <div className="jobs-strip">
        {s.jobs.length === 0 ? (
          <span className="muted">No jobs running — build, research, train or send a gathering party.</span>
        ) : (
          s.jobs.map((j) => (
            <div className="strip-job" key={j.id}>
              <span>{j.label}</span>
              <b>{fmtTime(Math.max(0, (j.endsAt - Date.now()) / 1000))}</b>
            </div>
          ))
        )}
      </div>

      <main className="layout">
        <Base
          s={s}
          act={act}
          island={island}
          setIsland={setIsland}
          selectedUid={selectedUid}
          setSelectedUid={setSelectedUid}
          setTab={setTab}
        />

        <aside className="col-side" id="sections">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'research' && <Research s={s} act={act} />}
          {tab === 'troops' && <Troops s={s} act={act} />}
          {tab === 'heroes' && <Heroes s={s} act={act} />}
          {tab === 'world' && <World s={s} act={act} />}
          {tab === 'banner' && <Banner s={s} act={act} />}

          <div className="card log-card">
            <div className="card-head">
              <h2>Field Log</h2>
              <span className="pill">{s.log.length}</span>
            </div>
            <div className="log-list">
              {s.log.length === 0 && <p className="muted">Nothing yet.</p>}
              {s.log.slice(0, 24).map((e) => (
                <div className={`log-line ${e.tone}`} key={e.id}>
                  <span className="time">
                    {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {e.text}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <footer className="foot">Ironhold · no shop, no VIP, no packages · {cloud.user ? 'saved to your account and this browser' : 'saved in this browser (sign in to keep it on every device)'}</footer>

      <nav className="mobile-nav">
        <button className="mnav-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="ico">🏝</span>
          Base
        </button>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`mnav-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => {
              setTab(t.key);
              jumpToSections();
            }}
          >
            <span className="ico">{t.icon}</span>
            {t.short}
          </button>
        ))}
      </nav>
    </div>
  );
}
