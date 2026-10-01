import { describe, expect, it } from 'vitest';
import { rayThrough } from '../../core/geometry';
import { NET_Z, START_Z, applyHit, createWave, isWaveOver, tick, zombieZ, type WaveOptions, type WaveState, type Zombie } from './logic';

const OPTS: WaveOptions = { count: 3, spawnEveryMs: 1000, speed: [1, 1], bruteChance: 0, boss: false, debounceMs: 250 };
const CAMERA = { x: 0, y: 3.6, z: 3.6 };
const zombie = (over: Partial<Zombie> = {}): Zombie => ({ id: 1, kind: 'walker', x: 0, spawnAt: 0, speed: 1, hp: 1, ...over });
const withZombies = (zombies: Zombie[], over: Partial<WaveState> = {}): WaveState => ({ ...createWave(0, 3), zombies, spawned: zombies.length, ...over });
const aimAt = (z: Zombie, now: number, y = 1) => rayThrough(CAMERA, { x: z.x, y, z: zombieZ(z, now) });

describe('zombie waves', () => {
  it('spawns on the interval up to the wave size', () => {
    let s = createWave(0, 3);
    s = tick(s, OPTS, 0, () => 0.5).state;
    expect(s.spawned).toBe(1);
    s = tick(s, OPTS, 2500, () => 0.5).state;
    expect(s.spawned).toBe(3);
    s = tick(s, OPTS, 9000, () => 0.5).state;
    expect(s.spawned).toBe(3);
  });

  it('walks zombies toward the net and takes a life when one arrives', () => {
    const z = zombie({ speed: 2 });
    expect(zombieZ(z, 0)).toBeCloseTo(START_Z);
    const arriveAt = ((NET_Z - START_Z) / 2) * 1000;
    const { state, arrived } = tick(withZombies([z], { spawned: OPTS.count }), OPTS, arriveAt + 1, () => 0.5);
    expect(arrived.map((a) => a.id)).toEqual([1]);
    expect(state.lives).toBe(2);
    expect(state.zombies).toEqual([]);
  });

  it('kills a walker in one hit and scores it', () => {
    const z = zombie({ x: 1 });
    const { state, result } = applyHit(withZombies([z]), OPTS, aimAt(z, 2000), 2000);
    expect(result).toMatchObject({ kind: 'kill', points: 10 });
    expect(state.kills).toBe(1);
    expect(state.zombies).toEqual([]);
  });

  it('needs two hits for a brute', () => {
    const z = zombie({ kind: 'brute', hp: 2 });
    const first = applyHit(withZombies([z]), OPTS, aimAt(z, 1000), 1000);
    expect(first.result?.kind).toBe('hurt');
    const second = applyHit(first.state, OPTS, aimAt(z, 2000), 2000);
    expect(second.result).toMatchObject({ kind: 'kill', points: 25 });
  });

  it('hits the zombie nearest the player when two line up', () => {
    const far = zombie({ id: 1, spawnAt: 2000 });
    const near = zombie({ id: 2, spawnAt: 0 });
    const { result } = applyHit(withZombies([far, near]), OPTS, aimAt(far, 3000), 3000);
    expect(result?.kind === 'kill' && result.zombie.id).toBe(2);
  });

  it('misses beside or above a zombie', () => {
    const z = zombie();
    expect(applyHit(withZombies([z]), OPTS, rayThrough(CAMERA, { x: 1.5, y: 1, z: zombieZ(z, 0) }), 0).result).toEqual({ kind: 'miss' });
    expect(applyHit(withZombies([z]), OPTS, aimAt(z, 0, 2.5), 0).result).toEqual({ kind: 'miss' });
  });

  it('ends when every zombie is gone or the lives run out', () => {
    expect(isWaveOver(withZombies([], { spawned: 3 }), OPTS)).toBe(true);
    expect(isWaveOver(withZombies([zombie()], { lives: 0 }), OPTS)).toBe(true);
    expect(isWaveOver(withZombies([zombie()]), OPTS)).toBe(false);
  });

  it('sends a slow 5-hit boss last', () => {
    const boss: WaveOptions = { ...OPTS, count: 1, boss: true };
    const s = tick(createWave(0, 3), boss, 1000, () => 0.5).state;
    expect(s.zombies.map((z) => z.kind)).toEqual(['walker', 'boss']);
    expect(s.zombies[1].hp).toBe(5);
  });
});
