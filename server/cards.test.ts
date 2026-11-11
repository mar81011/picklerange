import { describe, expect, it } from 'vitest';
import { CardStore } from './cards.ts';

const RUN = { gameId: 'bullseye', score: 420, level: 3, stats: 'Reached level 3 of 5', highScore: true };

describe('CardStore', () => {
  it('creates a card with a short code and no name yet', () => {
    const card = new CardStore().create(RUN, 1000);
    expect(card.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    expect(card).toMatchObject({ ...RUN, name: null, at: 1000 });
  });

  it('strips odd characters from the stats line', () => {
    const card = new CardStore().create({ ...RUN, stats: 'Beat all 5 levels! <script>' }, 0);
    expect(card.stats).toBe('Beat all 5 levels! script');
  });

  it('takes a cleaned-up name later', () => {
    const store = new CardStore();
    const { code } = store.create(RUN, 0);
    store.setName(code.toLowerCase(), ' ana! ');
    expect(store.get(code, 1)?.name).toBe('ANA');
  });

  it('expires cards', () => {
    const store = new CardStore({ ttlMs: 100 });
    const { code } = store.create(RUN, 0);
    expect(store.get(code, 99)).toBeDefined();
    expect(store.get(code, 100)).toBeUndefined();
  });

  it('drops the oldest cards past the limit', () => {
    const store = new CardStore({ max: 2 });
    const a = store.create(RUN, 0);
    const b = store.create(RUN, 1);
    const c = store.create(RUN, 2);
    expect(store.get(a.code, 3)).toBeUndefined();
    expect(store.get(b.code, 3)).toBeDefined();
    expect(store.get(c.code, 3)).toBeDefined();
  });
});
