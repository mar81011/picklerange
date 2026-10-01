// Dev tool: writes the app icons in public/ (icon.svg and PNGs for phones'
// home screens) from the pickleball drawing. Run: node tools/make-icons.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pickleballSvg } from '../src/ui/pickleballIcon.ts';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// The ball inside the middle 70% so "maskable" icons (cropped to a circle or squircle) keep it whole.
const ball = pickleballSvg().replace('<svg ', '<svg x="15" y="15" width="70" height="70" ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0b1530"/>${ball}</svg>`;
writeFileSync(resolve('public/icon.svg'), svg);

const tmp = mkdtempSync(join(tmpdir(), 'picklerange-icons-'));
for (const size of [180, 192, 512]) {
  // Headless Edge can't open tiny windows, so the page draws the icon onto a
  // canvas at the exact size and prints it as a data URL, read via --dump-dom.
  const page = join(tmp, `icon-${size}.html`);
  writeFileSync(page, `<body><script>
const img = new Image();
img.onload = () => {
  const c = document.createElement('canvas');
  c.width = c.height = ${size};
  c.getContext('2d').drawImage(img, 0, 0, ${size}, ${size});
  document.body.textContent = 'PNG:' + c.toDataURL('image/png');
};
img.src = 'data:image/svg+xml,${encodeURIComponent(svg)}';
</script></body>`);
  const dom = execFileSync(EDGE, [
    '--headless=new', '--disable-gpu', '--virtual-time-budget=3000', `--user-data-dir=${join(tmp, 'profile')}`,
    '--dump-dom', pathToFileURL(page).href,
  ]).toString();
  const match = dom.match(/PNG:data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (!match) throw new Error(`No image for size ${size}`);
  writeFileSync(resolve(`public/icon-${size}.png`), Buffer.from(match[1], 'base64'));
  console.log(`public/icon-${size}.png`);
}
