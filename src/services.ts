import { GAMES } from './games';
import { Leaderboard, LocalStorageStore } from './leaderboard/leaderboard';
import { ServerStore } from './leaderboard/serverStore';

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** High scores live in the lane server's SQLite database, with a local copy for offline play. */
export const scoreStore = new ServerStore(
  new LocalStorageStore(),
  browserStorage(),
  (input, init) => fetch(input, init),
  '/api',
  GAMES.filter((g) => g.mode === 'solo').map((g) => g.id),
);
export const leaderboard = new Leaderboard(scoreStore);
