// Cloud sign-in and saves, shared with Werewolf's entertainment site (Firebase project entertainment-71888).
//
// - Sign in with Google, same accounts as the site.
// - Friend code: the same one the site and Game Tracker use (RTDB users/{emailKey}/friend_code,
//   accounts/friend_codes/{CODE}); a new one is made only if the player has none yet.
// - Save: Firestore user/{CODE}/platform/mobile/game/ironhold  { save: "<json>", saveAt, device }
//   (the same place the site's mobile games keep their saves).
//
// The browser save (localStorage) keeps working as before, so the game still plays signed out
// and with no signal. Signed in, the newest save wins: a player can switch devices, or lose a
// device, and pick up where they left off. Nothing here ever starts a new game over an old one.
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import type { GameState } from '../types';
import { SAVE_VERSION } from './data';

const app = initializeApp({
  apiKey: 'AIzaSyDeuNBGHcwU4rFyOcsfGxLHjmEdpADacmc',
  authDomain: 'entertainment-71888.firebaseapp.com',
  databaseURL: 'https://entertainment-71888-default-rtdb.firebaseio.com',
  projectId: 'entertainment-71888',
  storageBucket: 'entertainment-71888.firebasestorage.app',
  messagingSenderId: '660524340277',
  appId: '1:660524340277:web:ef8f4ed04fa985a4f88d7c',
});
const auth = getAuth(app);
const rtdb = getDatabase(app);
const fs = getFirestore(app);

const GAME = 'ironhold';
const PUSH_EVERY = 30_000; // at most one Firestore write per 30 s keeps play inside the free plan

const DEVICE = (() => {
  try {
    let d = localStorage.getItem('ironhold.device');
    if (!d) {
      d = Math.random().toString(36).slice(2, 10);
      localStorage.setItem('ironhold.device', d);
    }
    return d;
  } catch {
    return 'nodevice';
  }
})();

export interface CloudUser {
  name: string;
  email: string;
  photo: string;
  code: string;
}

export const emailKey = (email: string) =>
  String(email).toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
  return s;
}

/** The player's site friend code; made (same format as the site) only if they have none. */
async function ensureFriendCode(user: User): Promise<string> {
  const key = emailKey(user.email ?? '');
  const mine = ref(rtdb, `users/${key}/friend_code`);
  const existing = (await get(mine)).val();
  if (existing) return String(existing).toUpperCase();
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    if ((await get(ref(rtdb, `accounts/friend_codes/${code}`))).exists()) continue;
    await set(ref(rtdb, `accounts/friend_codes/${code}`), key);
    await set(mine, code);
    return code;
  }
  throw new Error('Could not create a friend code');
}

const saveDoc = (code: string) =>
  doc(fs, 'user', code.toUpperCase(), 'platform', 'mobile', 'game', GAME);

export async function signIn(): Promise<void> {
  const p = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, p);
  } catch (e) {
    const c = (e as { code?: string }).code;
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, p);
      return;
    }
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
    if (c === 'auth/unauthorized-domain')
      throw new Error(
        `Sign-in isn't switched on for ${location.hostname} yet (Firebase > Authentication > Settings > Authorized domains).`,
      );
    throw e;
  }
}

export const signOutCloud = () => signOut(auth);

export function onCloudUser(cb: (u: CloudUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user || !user.email) return cb(null);
    let code = '';
    try {
      code = await ensureFriendCode(user);
    } catch (e) {
      console.warn('friend code', e);
    }
    let name = user.displayName ?? '';
    let photo = user.photoURL ?? '';
    try {
      const k = emailKey(user.email);
      const nick = (await get(ref(rtdb, `users/${k}/username`))).val();
      const av = (await get(ref(rtdb, `users/${k}/avatar_url`))).val();
      if (typeof nick === 'string' && nick.trim()) name = nick.trim().slice(0, 20);
      if (typeof av === 'string' && av) photo = av.replace(/^http:\/\//, 'https://');
    } catch {
      /* profile extras are optional */
    }
    cb({ name, email: user.email, photo, code });
  });
}

export interface CloudSave {
  state: GameState;
  saveAt: number;
  device: string;
}

export async function loadCloud(code: string): Promise<CloudSave | null> {
  const d = await getDoc(saveDoc(code));
  if (!d.exists()) return null;
  const v = d.data() as { save?: string; saveAt?: number; device?: string };
  if (!v.save) return null;
  try {
    const st = JSON.parse(v.save) as GameState;
    if (!st || st.version !== SAVE_VERSION || !Array.isArray(st.buildings) || !st.stats) return null;
    return { state: st, saveAt: v.saveAt ?? st.updatedAt ?? 0, device: v.device ?? '' };
  } catch {
    return null;
  }
}

export async function pushCloud(code: string, s: GameState): Promise<number> {
  const saveAt = s.updatedAt || Date.now();
  await setDoc(
    saveDoc(code),
    { save: JSON.stringify(s), saveAt, device: DEVICE, game: 'Ironhold', name: s.name },
    { merge: true },
  );
  return saveAt;
}

export { DEVICE, PUSH_EVERY };
