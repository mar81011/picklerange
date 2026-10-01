// The page a player sees after scanning the QR code. Plain HTML form, no
// JavaScript, so it works on any phone browser.
import { MAX_NAME_LENGTH } from '../src/leaderboard/names.ts';

const GAME_TITLES: Record<string, string> = { bullseye: 'Bullseye' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(body: string): string {
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
</style>
</head>
<body><main>
  <div class="brand">PICKLERANGE</div>
  <div class="pill">ARCADE</div>
  <div class="card">${body}</div>
</main></body>
</html>`;
}

export function namePage(code: string, gameId: string, score: number, error?: string): string {
  const title = GAME_TITLES[gameId] ?? gameId;
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

export function successPage(name: string): string {
  return layout(`
    <div class="label">You're on the board</div>
    <div class="big">${escapeHtml(name)}</div>
    <p>Look up at the wall to see your rank.</p>`);
}

export function expiredPage(): string {
  return layout(`
    <div class="big">This code has expired</div>
    <p>High-score codes only last a short time. Set another high score to get a new one!</p>`);
}
