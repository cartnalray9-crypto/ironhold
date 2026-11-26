import { SAVE_VERSION } from './data';
import type { GameState } from '../types';

const KEY = 'ironhold.save.v1';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== SAVE_VERSION || !Array.isArray(parsed.buildings)) return null;
    if (!parsed.stats) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Alliance card / invite code carried in the URL. */
export function urlAllyCode(): string | null {
  try {
    const code = new URL(window.location.href).searchParams.get('ally');
    return code ?? null;
  } catch {
    return null;
  }
}

export function stripAllyFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('ally')) return;
    url.searchParams.delete('ally');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore */
  }
}
