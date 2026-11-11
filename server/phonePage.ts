// The pages a player sees after scanning a QR code: name entry (a plain HTML
// form, no JavaScript, so it works on any phone browser) and the score card.
import { GAMES } from '../src/games.ts';
import { MAX_NAME_LENGTH } from '../src/leaderboard/names.ts';
import type { Card } from './cards.ts';

const gameTitle = (gameId: string) => GAMES.find((g) => g.id === gameId)?.title ?? gameId;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(body: string, head = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PickleRange Arcade</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at 50% 0%, #1c3486 0%, #0b1220 60%); color: #fff;
  }
  main { width: 100%; max-width: 420px; text-align: center; }
  .brand { font-weight: 900; letter-spacing: .06em; font-size: 28px; }
  .pill { display: inline-block; margin-top: 6px; padding: 4px 16px; border-radius: 999px; background: #d4f53c; color: #0b1220; font-weight: 800; letter-spacing: .3em; font-size: 13px; }
  .card { margin-top: 28px; padding: 28px 22px; border-radius: 22px; background: rgba(11,18,32,.9); border: 1px solid rgba(255,255,255,.12); border-top: 4px solid #d4f53c; }
  .label { color: #9fb0cf; text-transform: uppercase; letter-spacing: .12em; font-size: 13px; font-weight: 700; }
  .score { font-size: 72px; font-weight: 900; color: #d4f53c; line-height: 1; margin: 8px 0 4px; }
  input {
    width: 100%; margin-top: 22px; padding: 16px; border-radius: 14px; border: 2px solid #3a4560; background: #05080f;
    color: #fff; font-size: 24px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: .08em;
  }
  input:focus { outline: none; border-color: #d4f53c; }
  button {
    width: 100%; margin-top: 14px; padding: 16px; border: 0; border-radius: 14px; background: #d4f53c; color: #0b1220;
    font-size: 18px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
  }
  .error { margin-top: 14px; color: #ff8a8a; font-weight: 700; }
  .big { font-size: 26px; font-weight: 900; margin: 10px 0; }
  p { color: #c9d4ea; line-height: 1.5; }
  a.button {
    display: block; margin-top: 18px; padding: 16px; border-radius: 14px; background: #d4f53c; color: #0b1220;
    font-size: 18px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
  }
  a.button.ghost { background: transparent; color: #fff; border: 2px solid #3a4560; }
</style>
${head}
</head>
<body><main>
  <div class="brand">PICKLERANGE</div>
  <div class="pill">ARCADE</div>
  <div class="card">${body}</div>
</main></body>
</html>`;
}

export function namePage(code: string, gameId: string, score: number, error?: string): string {
  const title = gameTitle(gameId);
  return layout(`
    <div class="label">New high score • ${escapeHtml(title)}</div>
    <div class="score">${score}</div>
    <div class="label">points</div>
    <form method="post" action="/n/${escapeHtml(code)}">
      <input name="name" maxlength="${MAX_NAME_LENGTH}" placeholder="YOUR NAME" autocomplete="nickname"
             autocapitalize="characters" autofocus required aria-label="Your name">
      <button type="submit">Add to leaderboard</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}`);
}

/** cardCode, if set, adds a link to the player's score card. */
export function successPage(name: string, cardCode: string | null = null): string {
  return layout(`
    <div class="label">You're on the board</div>
    <div class="big">${escapeHtml(name)}</div>
    <p>Look up at the wall to see your rank.</p>
    ${cardCode ? `<a class="button" href="/c/${escapeHtml(cardCode)}">Get my score card</a>` : ''}`);
}

export function expiredPage(): string {
  return layout(`
    <div class="big">This code has expired</div>
    <p>High-score codes only last a short time. Set another high score to get a new one!</p>`);
}

export function cardExpiredPage(): string {
  return layout(`
    <div class="big">This score card has expired</div>
    <p>Score cards last a few hours. Play another round to get a new one!</p>`);
}

/**
 * The score card: the phone draws it on a canvas and shows it as a picture,
 * which players can press and hold to save (works over plain http, unlike the
 * share sheet), or download with the button.
 */
export function cardPage(card: Card): string {
  const game = GAMES.find((g) => g.id === card.gameId);
  const data = {
    title: gameTitle(card.gameId),
    accent: game?.accent ?? '#d4f53c',
    score: card.score,
    name: card.name,
    stats: card.stats,
    highScore: card.highScore,
    date: new Date(card.at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase(),
  };
  // Inside <script>, "<" must be escaped so a value can never close the tag.
  const json = JSON.stringify(data).replace(/</g, '\u003c');
  const head = `<style>
  @font-face { font-family: "Bebas Neue"; src: url("/fonts/bebas-neue.woff2") format("woff2"); font-display: block; }
  #card { display: block; width: 100%; border-radius: 14px; -webkit-touch-callout: default; }
  .hint { margin: 14px 0 0; font-size: 15px; }
  #share { display: none; }
</style>`;
  return layout(
    `
    <img id="card" alt="Your PickleRange score card">
    <p class="hint">Press and hold the picture to save it, or use the button.</p>
    <a id="download" class="button" download="picklerange-score.png">Download picture</a>
    <button id="share" type="button">Share</button>
    <script>
    const CARD = ${json};
    const W = 1080, H = 1350;

    function pickleball(ctx, x, y, r, color) {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#f4ff9e');
      g.addColorStop(0.55, color);
      g.addColorStop(1, '#6f8a10');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Holes on an even grid, kept inside the rim.
      ctx.fillStyle = 'rgba(40, 52, 6, 0.55)';
      const step = r * 0.42;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const hx = x + dx * step + (dy % 2 ? step / 2 : 0), hy = y + dy * step * 0.9;
          if (Math.hypot(hx - x, hy - y) > r * 0.78) continue;
          ctx.beginPath();
          ctx.arc(hx, hy, r * 0.075, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function fit(ctx, text, maxWidth, size) {
      ctx.font = size + 'px "Bebas Neue", Impact, sans-serif';
      while (ctx.measureText(text).width > maxWidth && size > 20) {
        size -= 4;
        ctx.font = size + 'px "Bebas Neue", Impact, sans-serif';
      }
    }

    function draw() {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, H * 0.9);
      glow.addColorStop(0, CARD.accent + 'aa');
      glow.addColorStop(1, 'rgba(11,18,32,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = CARD.accent;
      ctx.lineWidth = 14;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      fit(ctx, 'PICKLERANGE', 800, 120);
      ctx.fillText('PICKLERANGE', W / 2, 190);
      ctx.fillStyle = '#d4f53c';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 110, 215, 220, 60, 30);
      ctx.fill();
      ctx.fillStyle = '#0b1220';
      ctx.font = '50px "Bebas Neue", Impact, sans-serif';
      ctx.fillText('ARCADE', W / 2, 263);

      ctx.fillStyle = CARD.accent;
      fit(ctx, CARD.title, 900, 130);
      ctx.fillText(CARD.title, W / 2, 430);

      if (CARD.highScore) {
        ctx.fillStyle = '#fff';
        ctx.font = '64px "Bebas Neue", Impact, sans-serif';
        ctx.fillText('★ NEW HIGH SCORE ★', W / 2, 520);
      }

      ctx.shadowColor = '#d4f53c';
      ctx.shadowBlur = 50;
      ctx.fillStyle = '#d4f53c';
      fit(ctx, String(CARD.score), 900, 380);
      ctx.fillText(String(CARD.score), W / 2, 850);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#9fb0cf';
      ctx.font = '56px "Bebas Neue", Impact, sans-serif';
      ctx.fillText('POINTS', W / 2, 920);

      if (CARD.name) {
        ctx.fillStyle = '#fff';
        fit(ctx, CARD.name, 900, 120);
        ctx.fillText(CARD.name, W / 2, 1060);
      }
      ctx.fillStyle = '#c9d4ea';
      fit(ctx, CARD.stats.toUpperCase(), 900, 54);
      ctx.fillText(CARD.stats.toUpperCase(), W / 2, CARD.name ? 1130 : 1060);

      pickleball(ctx, 150, H - 150, 70, '#d4f53c');
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9fb0cf';
      ctx.font = '48px "Bebas Neue", Impact, sans-serif';
      ctx.fillText(CARD.date, W - 90, H - 130);
      return canvas;
    }

    async function show() {
      try { await document.fonts.load('100px "Bebas Neue"'); } catch {}
      const canvas = draw();
      const url = canvas.toDataURL('image/png');
      document.getElementById('card').src = url;
      document.getElementById('download').href = url;
      // The share sheet needs https, so it only appears where the browser allows it.
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'picklerange-score.png', { type: 'image/png' });
        if (!navigator.canShare || !navigator.canShare({ files: [file] })) return;
        const button = document.getElementById('share');
        button.style.display = 'block';
        button.onclick = () => navigator.share({ files: [file], title: 'My PickleRange score' }).catch(() => {});
      }, 'image/png');
    }
    show();
    </script>`,
    head,
  );
}
