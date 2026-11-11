# PickleRange Arcade

Projected pickleball arcade games for a single lane: a projector shows the
game on a wall, players hit real pickleballs at it, and a sensor (Kinect, to
be added) reports where each ball hit. Until the sensor is connected, a mouse
click or tap counts as a ball hit.

## Games

1–7 are solo games with 5 levels each; 8–10 are turn-based party games.

1. Bullseye · 2. Pop-Up · 3. Open Court · 4. Brick Breaker · 5. Zombie Court ·
6. Firing Range · 7. Rally Survival · 8. Tic-Tac-Toe · 9. Pickle Darts 301 ·
10. Memory Match

## Running it

```sh
npm install
npm run dev        # game on http://localhost:5173 + lane server on :8787
```

- **F** – fullscreen, **M** – music on/off, number keys – start a game from the menu,
  **S** (on the menu) – show a QR code for the staff page.
- `?camera=max` – bigger court (tall objects near the back may be cut off).
- `?fps` – frame-rate readout. `?level=N` (dev only) – jump to level N.
- For the venue PC, use Chrome or Edge with graphics acceleration on, e.g.
  `--kiosk --autoplay-policy=no-user-gesture-required http://localhost:5173`.

## Scripts

- `npm test` – unit tests for the game rules, leaderboard and name entry.
- `npm run build` – type-check and build.
- `node tools/playtest.mjs menu bullseye:1:20` – headless playthrough with
  screenshots in `.shots/` (needs `npm run dev`).

## How it fits together

- `src/input/hitEvents.ts` – the one contract between sensors and games: a hit
  at a normalized (x, y) on the wall.
- `src/games/` – pure, tested game rules and the per-game level tables
  (`levels.ts`, where difficulty is tuned).
- `src/screens/` – each game's 3D/HTML presentation; `src/engine/` – Three.js
  stage, environments and props; `src/audio/` – generated music and sound effects.
- `server/` – lane server: phone QR name entry for the high-score table.
- `server/scores.ts` – high scores in a SQLite file (`data/picklerange.db`, built into
  Node — free, no install). Backed up at startup and daily to `data/backups/`
  (newest 14 kept). The game keeps a local copy and queues scores while the
  server is unreachable, then sends them.

## Staff page

The lane server must be running (`npm run dev` starts it). Then either:

- on the lane PC, open `http://localhost:5173/staff` (same address as the game;
  `http://localhost:8787/staff` works too), or
- on a phone on the venue Wi-Fi, press **S** on the game menu and scan the QR
  code (or open `http://<lane-pc-ip>:8787/staff`; the address is printed when the
  lane server starts).

Enter the PIN, which is printed when the lane server starts and stored in
`data/staff-pin.txt` (or set `PICKLERANGE_STAFF_PIN`). From there you can view
and delete single scores, make a backup, and **reset the leaderboards** (all
games or one game, e.g. for a new venue). A reset asks you to type DELETE and
saves a `…-before-reset.db` backup first; the wall picks up the change within a
minute.

## Score cards and how-to pictures

- At the end of every solo run the high-score screen shows a **score card** QR. It
  opens a picture of the score on the player's phone (name, game, level, date) to
  save or download and share. A player who enters a name by phone also gets a
  "Get my score card" button there. Cards are kept in memory for 6 hours. Phones
  must be on the venue Wi-Fi, as with name entry; the online demo shows no card.
- Level 1 of each game (and each party game) shows pictures of what to hit, what
  it scores and what to avoid (`src/ui/howToPlay.ts`). Point values come from the
  game rules, so they stay correct after retuning.

## Online demo (Vercel)

`vercel.json` deploys the games as a static site. Vercel has no lane server,
so the demo saves scores in the visitor's browser and asks for names on the
keyboard (auto-saving as GUEST after 45 s). The venue runs the full local setup.

3D models in `public/models` are CC0 by Quaternius (see `CREDITS.md`).
