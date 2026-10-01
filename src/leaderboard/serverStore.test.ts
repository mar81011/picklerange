import { describe, expect, it } from 'vitest';
import { Leaderboard, MemoryStore } from './leaderboard';
import { ServerStore } from './serverStore';

/** A fake lane server: stores posted scores, or fails when down. */
function fakeServer() {
  const rows: { gameId: string; name: string; score: number; level: number | null; at: number }[] = [];
  let up = true;
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (!up) throw new Error('offline');
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      if (body.score <= 0) return new Response('{}', { status: 400 });
      rows.push(body);
      return new Response('{}', { status: 201 });
    }
    const tables: Record<string, unknown[]> = {};
    for (const r of rows) (tables[r.gameId] ??= []).push(r);
    return new Response(JSON.stringify(tables), { status: 200 });
  };
  return { rows, fetcher, setUp: (v: boolean) => (up = v) };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('ServerStore', () => {
  it('sends each new score to the server', async () => {
    const server = fakeServer();
    const store = new ServerStore(new MemoryStore(), memoryStorage(), server.fetcher);
    new Leaderboard(store).submit('bullseye', 'ana', 120, 1000, 2);
    await store.refresh();
    expect(server.rows).toEqual([{ gameId: 'bullseye', name: 'ANA', score: 120, level: 2, at: 1000 }]);
    expect(store.online).toBe(true);
  });

  it('queues scores while offline and sends them once the server is back', async () => {
    const server = fakeServer();
    server.setUp(false);
    const storage = memoryStorage();
    const store = new ServerStore(new MemoryStore(), storage, server.fetcher);
    const board = new Leaderboard(store);
    board.submit('popup', 'bo', 500, 1000);
    await store.refresh();
    expect(store.online).toBe(false);
    // Still shown locally while offline.
    expect(board.top('popup').map((e) => e.name)).toEqual(['BO']);

    // The queue survives a restart (it lives in storage).
    const restarted = new ServerStore(new MemoryStore(), storage, server.fetcher);
    server.setUp(true);
    await restarted.refresh();
    expect(server.rows.map((r) => r.name)).toEqual(['BO']);
    expect(new Leaderboard(restarted).top('popup').map((e) => e.name)).toEqual(['BO']);
  });

  it('shows scores from the server, including ones staff left in place after deletions', async () => {
    const server = fakeServer();
    server.rows.push({ gameId: 'bricks', name: 'CY', score: 90, level: 3, at: 5 });
    const store = new ServerStore(new MemoryStore(), memoryStorage(), server.fetcher);
    await store.refresh();
    expect(store.load('bricks')).toEqual([{ name: 'CY', score: 90, at: 5, level: 3 }]);
    server.rows.length = 0; // staff deleted it
    await store.refresh();
    expect(store.load('bricks')).toEqual([]);
  });

  it('drops a score the server rejects instead of retrying forever', async () => {
    const server = fakeServer();
    const store = new ServerStore(new MemoryStore(), memoryStorage(), server.fetcher);
    store.added('bullseye', { name: 'X', score: 0, at: 1 });
    await store.refresh();
    store.added('bullseye', { name: 'Y', score: 5, at: 2 });
    await store.refresh();
    expect(server.rows.map((r) => r.name)).toEqual(['Y']);
  });
});
