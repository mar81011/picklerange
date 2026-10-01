// Round result, phone-QR name entry, and the high-score table.
import type { App } from '../app';
import type { Scope } from '../engine/scope';
import { gameInfo, type RoundResult } from '../games';
import { cancelNameClaim, checkNameClaim, openNameClaim, type NameClaim } from '../leaderboard/nameClaims';
import { MAX_NAME_LENGTH, sanitizeName } from '../leaderboard/names';
import { leaderboard } from '../services';
import { isTouchDevice } from '../ui/touch';

/** Ignore hits right after the round ends so a late ball doesn't skip this screen. */
const HIT_GRACE_MS = 1500;
const RETURN_TO_MENU_MS = 15000;
/** How long to wait for a phone before saving the score under GUEST_NAME. */
const NAME_WAIT_SECONDS = 45;
const GUEST_NAME = 'GUEST';

export function gameOverScreen(app: App, scope: Scope, result: RoundResult): void {
  const info = gameInfo(result.gameId);
  const dim = scope.el('div', 'layer');
  dim.style.background = 'rgba(5,8,15,0.55)';
  const card = scope.el('div', 'panel card');
  let view = scope.el('div', 'layer', card);
  let saved = false;

  const text = (cls: string, value: string, top: number, size: number, parent = view) => {
    const el = scope.el('div', `center ${cls}`, parent, value);
    el.style.top = `${top}px`;
    el.style.fontSize = `${size}px`;
    return el;
  };

  const newView = () => {
    view.remove();
    view = scope.el('div', 'layer', card);
  };

  const saveScore = (name: string) => {
    if (saved) return;
    saved = true;
    const rank = leaderboard.submit(result.gameId, name, result.score, Date.now(), result.level);
    showLeaderboard(rank);
  };

  const showLeaderboard = (highlightRank: number | null) => {
    newView();
    text('display', 'HIGH SCORES', 50, 100);
    text(`label ${highlightRank ? 'neon' : ''}`, `${info.title}  •  Your score ${result.score}`, 160, 28);
    const rows = scope.el('div', 'board-rows', view);
    const entries = leaderboard.top(result.gameId);
    for (let i = 0; i < 10; i++) {
      const entry = entries[i];
      const cls = ['board-row', !entry && 'empty', i === 0 && entry && 'first', highlightRank === i + 1 && 'me'].filter(Boolean).join(' ');
      const row = scope.el('div', cls, rows);
      scope.el('div', '', row, String(i + 1).padStart(2, '0'));
      scope.el('div', '', row, entry?.name ?? '---');
      scope.el('div', 'lv', row, entry?.level ? `LV ${entry.level}` : '');
      scope.el('div', 'pts', row, entry ? String(entry.score) : '-');
    }
    text('label blink', 'Hit anywhere to continue', 905, 30).style.color = '#fff';

    const shownAt = performance.now();
    scope.onHit(() => {
      if (performance.now() - shownAt >= HIT_GRACE_MS) app.menu();
    });
    scope.after(RETURN_TO_MENU_MS, () => app.menu());
  };

  const promptPhone = (claim: NameClaim) => {
    const qr = scope.el('div', 'qr', view);
    const img = scope.el('img', '', qr);
    img.src = claim.qr;
    img.alt = 'QR code to enter your name';
    const side = scope.el('div', 'qr-text', view);
    for (const [cls, value, size] of [
      ['display neon', 'SCAN TO ADD', 80],
      ['display', 'YOUR NAME', 80],
      ['label', 'Use your phone camera', 28],
      ['label muted', `Code ${claim.code}`, 28],
    ] as const) {
      const el = scope.el('div', cls, side, value);
      el.style.fontSize = `${size}px`;
      el.style.marginBottom = '10px';
      if (cls === 'label') el.style.color = '#fff';
    }
    const countdown = scope.el('div', 'label muted', side);
    Object.assign(countdown.style, { fontSize: '28px', marginTop: '30px' });

    let secondsLeft = NAME_WAIT_SECONDS;
    let checking = false;
    const stop = scope.every(1000, () => tick());
    const tick = () => {
      if (saved) return stop();
      countdown.textContent = `Saves as ${GUEST_NAME} in ${secondsLeft}s`;
      if (secondsLeft-- <= 0) {
        cancelNameClaim(claim.code);
        return saveScore(GUEST_NAME);
      }
      if (checking) return;
      checking = true;
      void checkNameClaim(claim.code).then((status) => {
        checking = false;
        if (saved || !scope.alive || !status) return;
        if (status.name) saveScore(status.name);
        else if (status.expired) saveScore(GUEST_NAME);
      });
    };
    tick();
  };

  /** Fallback when the lane server is not running: staff type the name. */
  const promptKeyboard = () => {
    let typed = '';
    if (isTouchDevice) {
      // Phones: a real text box so the on-screen keyboard opens, plus a SAVE button.
      const input = scope.el('input', 'name-input', view);
      input.maxLength = MAX_NAME_LENGTH;
      input.placeholder = 'NAME';
      input.autocapitalize = 'characters';
      input.enterKeyHint = 'done';
      const save = scope.el('button', 'name-save', view, 'SAVE');
      // Taps here are typing, not ball hits.
      for (const el of [input, save]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('input', () => (typed = input.value.toUpperCase()));
      input.addEventListener('keydown', (e) => e.key === 'Enter' && sanitizeName(typed) !== null && saveScore(typed));
      save.addEventListener('click', () => saveScore(sanitizeName(typed) ?? GUEST_NAME));
      text('label', 'Tap the box to type your name', 730, 30);
    } else {
      promptTypedName((value) => (typed = value));
    }

    // Without a keyboard (e.g. the online demo on a tablet) nobody can press
    // Enter, so save after a while: whatever was typed, or GUEST.
    const countdown = text('label muted', '', 790, 26);
    let secondsLeft = NAME_WAIT_SECONDS;
    const stop = scope.every(1000, () => {
      if (saved) return stop();
      countdown.textContent = `Saves as ${sanitizeName(typed) ?? GUEST_NAME} in ${secondsLeft}s`;
      if (secondsLeft-- <= 0) saveScore(sanitizeName(typed) ?? GUEST_NAME);
    });
  };

  /** Keyboard name entry for the lane PC: letters appear in a big box; Enter saves. */
  const promptTypedName = (onChange: (typed: string) => void) => {
    let typed = '';
    const box = scope.el('div', 'name-box display', view, '_');
    text('label', 'Type your name  •  press Enter', 730, 30);
    const onKey = (event: KeyboardEvent) => {
      if (saved) return;
      if (event.key === 'Enter') {
        if (sanitizeName(typed) !== null) saveScore(typed);
        return;
      }
      if (event.key === 'Backspace') typed = typed.slice(0, -1);
      else if (event.key.length === 1 && typed.length < MAX_NAME_LENGTH) typed = (typed + event.key).toUpperCase();
      box.textContent = typed || '_';
      onChange(typed);
    };
    window.addEventListener('keydown', onKey);
    scope.onDispose(() => window.removeEventListener('keydown', onKey));
  };

  if (!leaderboard.qualifies(result.gameId, result.score)) {
    showLeaderboard(null);
    return;
  }

  text('label', 'Run complete', 60, 30);
  text('display neon score-big', String(result.score), 105, 190);
  text('label', `Points  •  ${result.stats}`, 300, 28).style.color = '#fff';
  text('display pulse', 'NEW HIGH SCORE!', 360, 90);
  const loading = text('label', 'Getting your QR code…', 640, 30);

  void openNameClaim(result.gameId, result.score).then((claim) => {
    if (!scope.alive) {
      if (claim) cancelNameClaim(claim.code);
      return;
    }
    loading.remove();
    if (claim) {
      promptPhone(claim);
      // Release the code if the screen closes before a name arrives.
      scope.onDispose(() => !saved && cancelNameClaim(claim.code));
    } else {
      promptKeyboard();
    }
  });
}
