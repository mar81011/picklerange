// Memory Match card art: six pickleball-themed stickers, each on its own card
// color so a pair is easy to spot from across the court.
import { holePoints } from '../ui/pickleballIcon';
import { panelFace } from './gameProps';

type Ctx = CanvasRenderingContext2D;

const INK = '#1a1440';
const LINE = 7;

/** Fills and outlines the current path. */
function paint(ctx: Ctx, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function vertical(ctx: Ctx, y0: number, y1: number, ...stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function horizontal(ctx: Ctx, x0: number, x1: number, ...stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A white streak of reflected light. */
function shine(ctx: Ctx, x: number, y: number, w: number, h: number, rotation = 0): void {
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, rotation, 0, Math.PI * 2);
  ctx.fill();
}

// Each icon is drawn around (0, 0), about 200 units across.

function paddle(ctx: Ctx): void {
  ctx.rotate(0.62);
  // Handle.
  rounded(ctx, -15, 42, 30, 66, 8);
  paint(ctx, horizontal(ctx, -15, 15, '#4b3a78', '#2a2050'));
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  for (let y = 56; y < 102; y += 13) {
    ctx.beginPath();
    ctx.moveTo(-14, y + 5);
    ctx.lineTo(14, y - 3);
    ctx.stroke();
  }
  rounded(ctx, -19, 98, 38, 15, 7);
  paint(ctx, '#ffd23f');
  // Edge guard and face.
  rounded(ctx, -66, -108, 132, 158, [56, 56, 36, 36]);
  paint(ctx, '#20264f');
  rounded(ctx, -54, -96, 108, 134, [46, 46, 26, 26]);
  ctx.fillStyle = vertical(ctx, -96, 38, '#5ff0ff', '#1fa4e8');
  ctx.fill();
  // Racing stripes across the face.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(-70, 2);
  ctx.lineTo(70, -48);
  ctx.lineTo(70, -20);
  ctx.lineTo(-70, 30);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-70, 36);
  ctx.lineTo(70, -14);
  ctx.lineTo(70, -2);
  ctx.lineTo(-70, 48);
  ctx.fill();
  ctx.restore();
  shine(ctx, -24, -70, 18, 9, -0.6);
}

function ball(ctx: Ctx): void {
  const R = 92;
  const body = ctx.createRadialGradient(-30, -36, 8, 0, 0, R * 1.1);
  body.addColorStop(0, '#f7ffb0');
  body.addColorStop(0.5, '#dcf43c');
  body.addColorStop(1, '#8fa814');
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  paint(ctx, body);
  // Same even hole layout as the 3D ball, squashed toward the rim.
  const hole = Math.sin(0.17) * R;
  for (const [x, y, z] of holePoints()) {
    if (z <= 0.12) continue;
    ctx.fillStyle = `rgba(62,74,8,${0.55 + 0.4 * z})`;
    ctx.beginPath();
    ctx.ellipse(x * R, -y * R, hole * z, hole, Math.atan2(-y, x), 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, -44, -56, 22, 11, -0.7);
}

function pickle(ctx: Ctx): void {
  ctx.save();
  ctx.rotate(-0.5);
  ctx.scale(1.14, 0.86);
  ctx.beginPath();
  ctx.moveTo(-92, -6);
  ctx.bezierCurveTo(-98, -58, -40, -66, 0, -60);
  ctx.bezierCurveTo(44, -56, 98, -54, 98, -2);
  ctx.bezierCurveTo(98, 46, 44, 58, 0, 56);
  ctx.bezierCurveTo(-44, 58, -86, 50, -92, -6);
  ctx.closePath();
  paint(ctx, vertical(ctx, -62, 58, '#a5e65a', '#4ea62f', '#2c7a24'));
  // Bumps, clear of the face.
  for (const [x, y] of [[-68, -24], [-68, 18], [-40, -44], [-40, 38], [40, -44], [40, 40], [70, -22], [70, 20]]) {
    ctx.fillStyle = '#2c7a24';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bff07a';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The face stays upright even though the pickle leans.
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(side * 25, -14, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(side * 25 + 3, -12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(side * 25 + 6, -16, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-22, 16);
  ctx.quadraticCurveTo(0, 42, 22, 16);
  ctx.closePath();
  paint(ctx, '#ff4d6d');
}

function star(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function trophy(ctx: Ctx): void {
  const gold = horizontal(ctx, -60, 60, '#b9770e', '#ffe58a', '#f2b705', '#a8690b');
  // Handles go behind the cup.
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 50, -78);
    ctx.bezierCurveTo(side * 112, -86, side * 104, -8, side * 38, -8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 24;
    ctx.stroke();
    ctx.strokeStyle = '#f2b705';
    ctx.lineWidth = 11;
    ctx.stroke();
  }
  // Stem and stand.
  rounded(ctx, -14, 18, 28, 50, 4);
  paint(ctx, gold);
  rounded(ctx, -38, 58, 76, 18, 6);
  paint(ctx, gold);
  rounded(ctx, -58, 72, 116, 30, 8);
  paint(ctx, vertical(ctx, 72, 102, '#5a3fa0', '#2d1d63'));
  rounded(ctx, -24, 80, 48, 13, 3);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  // Cup.
  ctx.beginPath();
  ctx.moveTo(-62, -100);
  ctx.lineTo(62, -100);
  ctx.bezierCurveTo(64, -30, 42, 24, 0, 28);
  ctx.bezierCurveTo(-42, 24, -64, -30, -62, -100);
  ctx.closePath();
  paint(ctx, gold);
  rounded(ctx, -70, -112, 140, 22, 9);
  paint(ctx, horizontal(ctx, -70, 70, '#c98a12', '#fff0a0', '#d9a21b'));
  star(ctx, 0, -42, 34);
  paint(ctx, '#ffffff');
  shine(ctx, -38, -62, 7, 24, 0.1);
}

function sneakerUpper(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-96, 38);
  ctx.lineTo(-102, -46);
  ctx.bezierCurveTo(-90, -68, -56, -68, -40, -50);
  ctx.bezierCurveTo(-20, -30, 12, -8, 44, 0);
  ctx.bezierCurveTo(84, 8, 106, 18, 106, 42);
  ctx.closePath();
}

function sneaker(ctx: Ctx): void {
  ctx.translate(0, 10);
  ctx.rotate(-0.1);
  sneakerUpper(ctx);
  ctx.fillStyle = vertical(ctx, -66, 42, '#ff7a85', '#e0243f');
  ctx.fill();
  // Heel patch, toe cap and a stripe along the side.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-110, -70, 44, 120);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(102, 52, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-58, 8);
  ctx.quadraticCurveTo(-8, 34, 42, 20);
  ctx.stroke();
  ctx.restore();
  sneakerUpper(ctx);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Laces.
  for (const [x, y] of [[-30, -36], [-10, -20], [10, -7], [30, 2]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.95);
    rounded(ctx, -15, -5, 30, 10, 5);
    paint(ctx, '#ffffff');
    ctx.restore();
  }
  // Sole.
  rounded(ctx, -106, 36, 222, 32, 15);
  paint(ctx, '#ffffff');
  ctx.fillStyle = '#3ff5ff';
  ctx.fillRect(-94, 50, 198, 7);
}

function bottle(ctx: Ctx): void {
  ctx.rotate(0.2);
  // Spout and cap.
  rounded(ctx, -13, -116, 26, 26, 6);
  paint(ctx, '#ffd23f');
  rounded(ctx, -34, -98, 68, 26, 7);
  paint(ctx, horizontal(ctx, -34, 34, '#f2f4ff', '#a6b1d6'));
  // Body.
  ctx.beginPath();
  ctx.moveTo(-34, -74);
  ctx.lineTo(34, -74);
  ctx.bezierCurveTo(58, -60, 58, -40, 54, -28);
  ctx.lineTo(54, 94);
  ctx.quadraticCurveTo(54, 110, 38, 110);
  ctx.lineTo(-38, 110);
  ctx.quadraticCurveTo(-54, 110, -54, 94);
  ctx.lineTo(-54, -28);
  ctx.bezierCurveTo(-58, -40, -58, -60, -34, -74);
  ctx.closePath();
  paint(ctx, horizontal(ctx, -56, 56, '#bdf3ff', '#eafcff', '#8fdcf2'));
  // Water inside, up to a wavy line.
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-70, -22);
  ctx.bezierCurveTo(-30, -44, 20, 0, 70, -24);
  ctx.lineTo(70, 120);
  ctx.lineTo(-70, 120);
  ctx.closePath();
  ctx.fillStyle = vertical(ctx, -30, 110, '#35b6ff', '#1560d4');
  ctx.fill();
  ctx.restore();
  // Label with a water drop.
  rounded(ctx, -56, 14, 112, 58, 0);
  paint(ctx, '#ffffff');
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.bezierCurveTo(22, 46, 18, 64, 0, 64);
  ctx.bezierCurveTo(-18, 64, -22, 46, 0, 22);
  ctx.closePath();
  ctx.fillStyle = '#1f8bea';
  ctx.fill();
  shine(ctx, -36, -26, 6, 22);
}

export interface MemoryCard {
  name: string;
  background: string;
  draw: (ctx: Ctx) => void;
}

export const MEMORY_CARDS: readonly MemoryCard[] = [
  { name: 'paddle', background: '#d92b4c', draw: paddle },
  { name: 'ball', background: '#0b8a6a', draw: ball },
  { name: 'pickle', background: '#ffbd2e', draw: pickle },
  { name: 'trophy', background: '#1c2f8f', draw: trophy },
  { name: 'sneaker', background: '#29a8ef', draw: sneaker },
  { name: 'bottle', background: '#e6339a', draw: bottle },
];

/** The icon with a white die-cut edge and a soft shadow, like a sticker. */
function sticker(ctx: Ctx, card: MemoryCard, cx: number, cy: number, scale: number): void {
  const size = Math.ceil(280 * scale);
  const art = document.createElement('canvas');
  art.width = art.height = size;
  const a = art.getContext('2d')!;
  a.translate(size / 2, size / 2);
  a.scale(scale, scale);
  card.draw(a);

  const edge = document.createElement('canvas');
  edge.width = edge.height = size;
  const e = edge.getContext('2d')!;
  e.drawImage(art, 0, 0);
  e.globalCompositeOperation = 'source-in';
  e.fillStyle = '#ffffff';
  e.fillRect(0, 0, size, size);

  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(10,6,40,0.55)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  const border = 11 * scale;
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    ctx.drawImage(edge, x + Math.cos(t) * border, y + Math.sin(t) * border);
    if (i === 0) ctx.shadowColor = 'transparent';
  }
  ctx.restore();
  ctx.drawImage(art, x, y);
}

/** A whole card front. border is the matching player's color, once the pair is won. */
export function drawMemoryFront(ctx: Ctx, w: number, h: number, symbol: number, border: string | null): void {
  const card = MEMORY_CARDS[symbol];
  panelFace(ctx, w, h, card.background, border ?? '#ffffff');
  // A pool of light behind the sticker.
  const glow = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.3)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.roundRect(18, 18, w - 36, h - 36, 34);
  ctx.fill();
  sticker(ctx, card, w / 2, h / 2, (h * 0.8) / 240);
}

/** A card front as an image URL, for the how-to-play pictures. */
export function memoryPicture(symbol: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 198;
  drawMemoryFront(canvas.getContext('2d')!, 256, 198, symbol, null);
  return canvas.toDataURL();
}
