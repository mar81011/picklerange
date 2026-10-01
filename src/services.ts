import { Leaderboard, LocalStorageStore } from './leaderboard/leaderboard';

export const leaderboard = new Leaderboard(new LocalStorageStore());
