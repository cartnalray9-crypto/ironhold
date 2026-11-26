import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';
import { fmt } from '../game/data';
import { hqLevel } from '../game/engine';
import { saveGame } from '../game/save';
import {
  DEVICE,
  PUSH_EVERY,
  loadCloud,
  onCloudUser,
  pushCloud,
  signIn,
  signOutCloud,
  type CloudSave,
  type CloudUser,
} from '../game/cloud';

type SetState = (s: GameState) => void;

/** Two different games (one here, one on the account): the player picks; nothing is replaced silently. */
interface Clash {
  code: string;
  cloud: CloudSave;
}

const sameGame = (a: GameState, b: GameState) => a.createdAt === b.createdAt && a.seed === b.seed;

/**
 * Keeps the game in step with the player's account:
 *  - on sign-in, the newer save of the same game wins; a save only on one side is copied to the other;
 *  - two different games ask the player which to keep;
 *  - while playing, the save goes up at most every 30 s, and right away when the page is hidden or closed;
 *  - coming back to the tab picks up a newer save made on another device.
 */
export function useCloudSync(stateRef: { current: GameState | null }, bootStamp: number, setState: SetState) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState('');
  const [clash, setClashState] = useState<Clash | null>(null);
  const clashRef = useRef<Clash | null>(null);
  const setClash = (c: Clash | null) => {
    clashRef.current = c;
    setClashState(c);
  };
  const ready = useRef(false); // true once this device and the account agree on which save is current
  const synced = useRef(0); // stamp of the save both sides have
  const lastPush = useRef(0);
  const firstAuth = useRef(true);
  const userRef = useRef<CloudUser | null>(null);

  const adopt = (c: CloudSave) => {
    saveGame(c.state);
    setState(c.state);
    synced.current = c.saveAt;
  };

  const push = async (force = false) => {
    const u = userRef.current;
    const s = stateRef.current;
    if (!u || !u.code || !s || !ready.current) return;
    if (!force && (document.hidden || Date.now() - lastPush.current < PUSH_EVERY)) return;
    if (s.updatedAt <= synced.current) return;
    lastPush.current = Date.now();
    try {
      synced.current = await pushCloud(u.code, s);
      setStatus('Saved to your account');
    } catch (e) {
      console.warn('cloud save failed (kept on this device)', e);
      setStatus('Offline: saving on this device, will sync later');
    }
  };

  const sync = async (u: CloudUser | null, boot: boolean) => {
        if (!u) return setStatus('');
        if (!u.code) return setStatus('Could not load your friend code; saving on this device only.');
        setStatus('Syncing…');
        let cloud: CloudSave | null = null;
        try {
          cloud = await loadCloud(u.code);
        } catch (e) {
          console.warn('cloud load failed', e);
          return setStatus('Offline: playing from this device, will sync when back online.');
        }
        const local = stateRef.current;
        // when the page has just opened, compare against when this device last played (before the
        // catch-up tick moved the clock); after a manual sign-in, this device is the one being played
        const localStamp = local ? (boot ? bootStamp : local.updatedAt) : 0;
        if (!cloud && !local) {
          ready.current = true;
          return setStatus('Signed in. Your game will save to your account.');
        }
        if (cloud && !local) {
          adopt(cloud);
          ready.current = true;
          return setStatus('Loaded your saved game.');
        }
        if (!cloud && local) {
          ready.current = true;
          await push(true);
          return;
        }
        if (cloud && local && sameGame(cloud.state, local)) {
          if (cloud.saveAt > localStamp) {
            adopt(cloud);
            setStatus('Loaded your newer save from another device.');
          } else {
            synced.current = 0;
            ready.current = true;
            await push(true);
          }
          ready.current = true;
          return;
        }
        if (cloud) setClash({ code: u.code, cloud });
        setStatus('');
  };

  useEffect(
    () =>
      onCloudUser((u) => {
        const boot = firstAuth.current;
        firstAuth.current = false;
        userRef.current = u;
        setUser(u);
        ready.current = false;
        setClash(null);
        void sync(u, boot);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const id = window.setInterval(() => void push(), 5000);
    const onVis = async () => {
      const u = userRef.current;
      if (document.hidden) return void push(true);
      if (!u || !u.code) return;
      if (!ready.current) return void (clashRef.current ? undefined : sync(u, true)); // first sync failed offline: try again
      try {
        const c = await loadCloud(u.code);
        if (c && c.device !== DEVICE && c.saveAt > synced.current) {
          adopt(c);
          setStatus('Loaded your newer save from another device.');
        }
      } catch {
        /* offline: keep playing */
      }
    };
    const onHide = () => void push(true);
    const onOnline = () => {
      const u = userRef.current;
      if (u && u.code && !ready.current && !clashRef.current) void sync(u, true);
      else void push(true);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('online', onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = async (keep: 'cloud' | 'device') => {
    if (!clash) return;
    if (keep === 'cloud') adopt(clash.cloud);
    else synced.current = 0;
    ready.current = true;
    setClash(null);
    if (keep === 'device') await push(true);
    else setStatus('Loaded your saved game.');
  };

  return { user, status, clash, resolve };
}

function summary(s: GameState) {
  return `${s.name || 'Commander'} · ${s.alliance.name} · CC Lv ${hqLevel(s)} · ${s.wavesCleared} waves · ${fmt(
    s.stats.merges,
  )} merges`;
}

export function ClashDialog({
  clash,
  local,
  onPick,
}: {
  clash: { cloud: CloudSave } | null;
  local: GameState | null;
  onPick: (k: 'cloud' | 'device') => void;
}) {
  if (!clash || !local) return null;
  return (
    <div className="cloud-modal">
      <div className="card cloud-card">
        <h2>Which game do you want to keep?</h2>
        <p className="muted">Your account already has a different Ironhold game than the one on this device.</p>
        <button className="btn primary big" onClick={() => onPick('cloud')}>
          Load my account's game
          <small>{summary(clash.cloud.state)}</small>
          <small>last played {new Date(clash.cloud.saveAt).toLocaleString()}</small>
        </button>
        <button className="btn big" onClick={() => onPick('device')}>
          Keep this device's game
          <small>{summary(local)}</small>
          <small className="warn">replaces the game saved on your account</small>
        </button>
      </div>
    </div>
  );
}

export function AccountChip({ user, status }: { user: CloudUser | null; status: string }) {
  const [err, setErr] = useState('');
  if (!user)
    return (
      <span className="account">
        <button
          className="btn small"
          onClick={() => signIn().catch((e) => setErr(String((e as Error).message || e)))}
          title="Sign in to keep your game on every device"
        >
          Sign in to save
        </button>
        {err && <span className="cloud-status warn">{err}</span>}
      </span>
    );
  return (
    <span className="account">
      {user.photo ? <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : null}
      <span className="who">
        <b>{user.name || user.email}</b>
        {user.code && <span className="muted">Friend code {user.code}</span>}
        {status && <span className="cloud-status">{status}</span>}
      </span>
      <button className="btn small" onClick={() => void signOutCloud()} title="Sign out (your game stays on this device too)">
        Sign out
      </button>
    </span>
  );
}

export function StartSignIn({ user, status }: { user: CloudUser | null; status: string }) {
  const [err, setErr] = useState('');
  if (user) return <p className="okline">{status || `Signed in as ${user.name || user.email}.`}</p>;
  return (
    <div className="start-signin">
      <button
        className="btn big"
        type="button"
        onClick={() => signIn().catch((e) => setErr(String((e as Error).message || e)))}
      >
        Sign in with Google to load your saved game
      </button>
      <p className="muted">Signed in, your progress is kept on your account, so you can switch devices any time.</p>
      {err && <p className="warn">{err}</p>}
    </div>
  );
}
