import { describe, expect, it } from 'vitest';
import { ClaimStore } from './claims.ts';

describe('ClaimStore', () => {
  it('creates a 6-character code from the unambiguous alphabet', () => {
    const claim = new ClaimStore().create('bullseye', 205, 0);
    expect(claim.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    expect(claim).toMatchObject({ gameId: 'bullseye', score: 205, name: null });
  });

  it('never hands out the same live code twice', () => {
    // First two draws collide, then the RNG moves on.
    const draws = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const store = new ClaimStore({ random: () => draws.shift() ?? 0.9 });
    const a = store.create('bullseye', 1, 0);
    const b = store.create('bullseye', 2, 0);
    expect(a.code).not.toBe(b.code);
  });

  it('records a cleaned-up name once', () => {
    const store = new ClaimStore();
    const { code } = store.create('bullseye', 205, 0);

    const first = store.submit(code, '  joseph! ', 1000);
    expect(first).toMatchObject({ ok: true, claim: { name: 'JOSEPH' } });
    expect(store.get(code)?.name).toBe('JOSEPH');

    expect(store.submit(code, 'someone else', 2000)).toEqual({ ok: false, error: 'already_named' });
    expect(store.get(code)?.name).toBe('JOSEPH');
  });

  it('accepts codes typed in lowercase', () => {
    const store = new ClaimStore();
    const { code } = store.create('bullseye', 205, 0);
    expect(store.submit(code.toLowerCase(), 'ana', 0).ok).toBe(true);
  });

  it('rejects names with nothing usable in them', () => {
    const store = new ClaimStore();
    const { code } = store.create('bullseye', 205, 0);
    expect(store.submit(code, '!!!', 0)).toEqual({ ok: false, error: 'invalid_name' });
    expect(store.get(code)?.name).toBeNull();
  });

  it('rejects unknown, expired and cancelled codes', () => {
    const store = new ClaimStore({ ttlMs: 1000 });
    expect(store.submit('NOPE22', 'ana', 0)).toEqual({ ok: false, error: 'not_found' });

    const expiring = store.create('bullseye', 1, 0);
    expect(store.submit(expiring.code, 'ana', 1000)).toEqual({ ok: false, error: 'expired' });

    const cancelled = store.create('bullseye', 1, 0);
    store.cancel(cancelled.code);
    expect(store.submit(cancelled.code, 'ana', 10)).toEqual({ ok: false, error: 'not_found' });
  });

  it('drops expired claims when new ones are created', () => {
    const store = new ClaimStore({ ttlMs: 1000 });
    const old = store.create('bullseye', 1, 0);
    store.create('bullseye', 2, 5000);
    expect(store.get(old.code)).toBeUndefined();
  });
});
