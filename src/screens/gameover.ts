// Round result, phone-QR name entry, the high-score table, and a QR for the
// player's score card (a picture of their score to save on their phone).
// PLAY AGAIN / MENU targets at the bottom of the card leave at any time; they
// are targets rather than "hit anywhere" so a stray ball can't skip name entry.
import type { App } from '../app';
import type { Scope } from '../engine/scope';
import { gameInfo, type RoundResult } from '../games';
import { cancelNameClaim, checkNameClaim, openNameClaim, type NameClaim } from '../leaderboard/nameClaims';
import { MAX_NAME_LENGTH, sanitizeName } from '../leaderboard/names';
import { openScoreCard, type ScoreCard } from '../leaderboard/scoreCards';
import { leaderboard } from '../services';
import { isTouchDevice } from '../ui/touch';
import { elementAt, elementCenter } from './common';

/** Ignore hits right after the targets appear so a late ball from the round can't pick one. */
const HIT_GRACE_MS = 1500;
const RETURN_TO_MENU_MS = 15000;
/** Longer when a score-card QR is up, so there's time to get a phone out. */
const RETURN_TO_MENU_WITH_CARD_MS = 30000;
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
  const qualifies = leaderboard.qualifies(result.gameId, result.score);
  const cardReady = openScoreCard(result, qualifies);

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

  /** show = false when the player is leaving (PLAY AGAIN / MENU) instead of waiting for the table. */
  const saveScore = (name: string, show = true) => {
    if (saved) return;
    saved = true;
    const rank = leaderboard.submit(result.gameId, name, result.score, Date.now(), result.level);
    if (show) showLeaderboard(rank);
  };

  /**
   * PLAY AGAIN / MENU targets at the bottom of the current view. beforeLeave
   * runs first, e.g. to save the score as GUEST when name entry is skipped.
   */
  let leaving = false;
  const addChoices = (beforeLeave?: () => void) => {
    const row = scope.el('div', 'end-choices', view);
    const again = scope.el('div', 'end-choice again display', row, 'PLAY AGAIN');
    const menu = scope.el('div', 'end-choice display', row, 'MENU');
    const targets = [again, menu];
    app.debugAimScreen = (key) => elementCenter(app.stage, key === 'menu' ? menu : again);
    const shownAt = performance.now();
    scope.onHit((hit) => {
      if (leaving || performance.now() - shownAt < HIT_GRACE_MS) return;
      const index = elementAt(app.stage, hit.x, hit.y, targets);
      if (index < 0) return;
      leaving = true;
      targets[index].classList.add('chosen');
      app.world.cheer(0.6);
      beforeLeave?.();
      scope.after(450, () => (index === 0 ? app.play(result.gameId) : app.menu()));
    });
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
    addChoices();

    const shownAt = performance.now();
    let leaveAt = shownAt + RETURN_TO_MENU_MS;
    const stop = scope.every(500, () => {
      if (performance.now() >= leaveAt) {
        stop();
        app.menu();
      }
    });
    void cardReady.then((scoreCard) => {
      if (!scoreCard || !scope.alive) return;
      showCardQr(scoreCard);
      leaveAt = shownAt + RETURN_TO_MENU_WITH_CARD_MS;
    });
  };

  /** Side panel next to the high scores: scan to get your score card. */
  const showCardQr = (scoreCard: ScoreCard) => {
    const panel = scope.el('div', 'panel card-qr');
    scope.el('div', 'display neon', panel, 'YOUR SCORE CARD');
    const qr = scope.el('div', 'qr-box', panel);
    const img = scope.el('img', '', qr);
    img.src = scoreCard.qr;
    img.alt = 'QR code for your score card';
    scope.el('div', 'label', panel, 'Scan to save & share');
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
    addChoices(() => {
      if (saved) return;
      cancelNameClaim(claim.code);
      saveScore(GUEST_NAME, false);
    });

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
    addChoices(() => saveScore(sanitizeName(typed) ?? GUEST_NAME, false));
  };

  /** Keyboard name entry for the lane PC: letters appear in a big box; Enter saves. */
  const promptTypedName = (onChange: (typed: string) => void) => {
    let typed = '';
    const box = scope.el('div', 'name-box display', view, '_');
    text('label', 'Type your name  •  press Enter', 730, 30);
    const onKey = (event: KeyboardEvent) => {
      if (saved) return;
      // Typed letters are the name, not shortcuts (M = music, F = fullscreen).
      event.stopImmediatePropagation();
      if (event.key === 'Enter') {
        if (sanitizeName(typed) !== null) saveScore(typed);
        return;
      }
      if (event.key === 'Backspace') typed = typed.slice(0, -1);
      else if (event.key.length === 1 && typed.length < MAX_NAME_LENGTH) typed = (typed + event.key).toUpperCase();
      box.textContent = typed || '_';
      onChange(typed);
    };
    // Capture phase, so this runs before the global shortcut keys and can stop them.
    window.addEventListener('keydown', onKey, { capture: true });
    scope.onDispose(() => window.removeEventListener('keydown', onKey, { capture: true }));
  };

  if (!qualifies) {
    showLeaderboard(null);
    return;
  }

  text('label', 'Run complete', 60, 30);
  text('display neon score-big', String(result.score), 105, 190);
  text('label', `Points  •  ${result.stats}`, 300, 28).style.color = '#fff';
  text('display pulse', 'NEW HIGH SCORE!', 360, 90);
  const loading = text('label', 'Getting your QR code…', 640, 30);

  void cardReady.then((scoreCard) => openNameClaim(result.gameId, result.score, scoreCard?.code)).then((claim) => {
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
