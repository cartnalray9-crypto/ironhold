import { useState } from 'react';
import type { GameState } from '../types';
import { fmt, fmtTime } from '../game/data';
import {
  SUPPLY_COOLDOWN,
  addAlly,
  alliancePower,
  claimSupply,
  hqLevel,
  inviteLink,
  powerOf,
} from '../game/engine';
import { clearSave } from '../game/save';
import { Note, type Act } from './common';

export default function Banner({ s, act }: { s: GameState; act: Act }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const link = inviteLink(s);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>{s.alliance.name}</h2>
          <span className="pill">Code {s.alliance.code}</span>
        </div>
        <Note>
          A banner is your group of friends on this frontier. Anyone who opens your invite link joins the same banner and
          the same world seed. Send their link back the other way so your roster lists them too. This is asynchronous
          co-op — no accounts, no payments, no server to rent.
        </Note>
        <div className="copy-row">
          <input className="link-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn primary" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy invite link'}
          </button>
        </div>
        <div className="meta-row">
          <span className="pill">Banner power {fmt(alliancePower(s))}</span>
          <span className="pill">Members {s.alliance.members.length + 1}</span>
        </div>
      </div>

      <div className="card">
        <h2>Add a friend</h2>
        <Note>
          Paste the invite link or code a friend sent you. Their card joins your roster, and every 30 minutes they can
          send you a supply drop.
        </Note>
        <form
          className="copy-row"
          onSubmit={(e) => {
            e.preventDefault();
            act((st) => {
              addAlly(st, code);
            });
            setCode('');
          }}
        >
          <input
            className="link-input"
            placeholder="Paste invite link or banner code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!code.trim()}>
            Join banner
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Roster</h2>
          <span className="pill">{s.name} (you)</span>
        </div>
        <div className="member you">
          <b>{s.name}</b>
          <span>HQ {hqLevel(s)}</span>
          <span>{fmt(powerOf(s))} power</span>
        </div>
        {s.alliance.members.length === 0 && <p className="muted">No friends yet — share your invite link.</p>}
        {s.alliance.members.map((m) => {
          const wait = SUPPLY_COOLDOWN - (Date.now() - m.lastSupplyAt);
          return (
            <div className="member" key={m.id}>
              <b>{m.name}</b>
              <span>HQ {m.hq}</span>
              <span>{fmt(m.power)} power</span>
              <button
                className="btn tiny"
                disabled={wait > 0}
                onClick={() =>
                  act((st) => {
                    claimSupply(st, m.id);
                  })
                }
              >
                {wait > 0 ? `Supply in ${fmtTime(wait / 1000)}` : 'Supply drop'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Fair play</h2>
        <ul className="feature-list">
          <li>No VIP tiers, no packages, no currency bundles, no paid boosts. There is no shop at all.</li>
          <li>Power comes from troops, and troops come from time plus the skill of your merge decisions.</li>
          <li>Every resource is gatherable from the first minute; gear only drops from ground you explore.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Danger zone</h2>
        <Note>Start over with a fresh island. This deletes the local save in this browser.</Note>
        <button
          className={`btn tiny ${confirmReset ? 'danger' : 'ghost'}`}
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            clearSave();
            window.location.reload();
          }}
        >
          {confirmReset ? 'Confirm wipe' : 'Reset banner'}
        </button>
      </div>
    </div>
  );
}
