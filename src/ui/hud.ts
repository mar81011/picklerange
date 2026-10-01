// HTML overlay widgets shared by the game screens.
import type { Scope } from '../engine/scope';

export interface HudColumn {
  label: string;
  /** Initial value; columns with value null get a pips row instead of text. */
  value: string | null;
  className?: string;
}

/** Top scoreboard bar. Returns one element per column for updating. */
export function hudBar(scope: Scope, columns: HudColumn[]): HTMLElement[] {
  const bar = scope.el('div', 'panel hud');
  return columns.map((col) => {
    const cell = scope.el('div', '', bar);
    scope.el('div', 'label', cell, col.label);
    if (col.value === null) return scope.el('div', 'pips', cell);
    return scope.el('div', `value display ${col.className ?? ''}`, cell, col.value);
  });
}

/** Sets a HUD value and gives it a little bounce. */
export function setValue(el: HTMLElement, text: string, bump = false): void {
  if (el.textContent === text) return;
  el.textContent = text;
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }
}

/** Fills a pips row: `left` lit balls out of `total`. */
export function setPips(el: HTMLElement, left: number, total: number): void {
  if (el.childElementCount !== total) {
    el.replaceChildren(...Array.from({ length: total }, () => document.createElement('div')));
  }
  [...el.children].forEach((pip, i) => (pip.className = i < total - left ? 'pip used' : 'pip'));
}

/** Big centered message that pops in, holds, and fades out. */
export async function banner(scope: Scope, text: string, cls = '', top = 330, size = 130, holdMs = 900): Promise<void> {
  const el = scope.el('div', `banner display ${cls}`, scope.layer, text);
  el.style.top = `${top}px`;
  el.style.fontSize = `${size}px`;
  await scope.wait(350 + holdMs);
  el.classList.add('out');
  await scope.wait(350);
  el.remove();
}

/**
 * Title card with how-to-play text and a 3-2-1 countdown. Resolves on GO so
 * the game can start accepting hits.
 */
export async function introCard(scope: Scope, title: string, howTo: string, footer?: string, kicker?: string): Promise<void> {
  const card = scope.el('div', 'panel intro-card');
  if (kicker) scope.el('div', 'label neon kicker', card, kicker);
  scope.el('div', 'title display', card, title);
  scope.el('div', 'howto', card, howTo);
  if (footer) scope.el('div', 'goal display neon', card, footer);
  const count = scope.el('div', 'count display neon', card, '');
  await scope.wait(1600);
  for (const n of ['3', '2', '1']) {
    count.textContent = n;
    count.classList.remove('bump');
    void count.offsetWidth;
    count.classList.add('bump');
    await scope.wait(650);
  }
  card.remove();
  void banner(scope, 'GO!', 'neon', 380, 180, 300);
}
