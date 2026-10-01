// A pickleball drawn as an SVG image for small UI spots (HUD ball counters,
// menu prompt). The holes match the 3D ball: points spread evenly over a
// sphere, drawn as seen from the front, so holes near the rim are squashed
// into thin ovals by perspective. Set once as the CSS variable --pickleball.

const HOLES = 40;
const HOLE_RADIUS = 0.15; // radians, same as the 3D ball
const SIZE = 100;
const R = 46;

function holePoints(): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  // A slight tilt so the pattern doesn't line up with the icon's edges.
  const tilt = 0.5;
  const points: [number, number, number][] = [];
  for (let i = 0; i < HOLES; i++) {
    const y = 1 - ((i + 0.5) / HOLES) * 2;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(golden * i) * r;
    const z = Math.sin(golden * i) * r;
    points.push([x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)]);
  }
  return points;
}

export function pickleballSvg(): string {
  const c = SIZE / 2;
  const holes = holePoints()
    .filter(([, , z]) => z > 0.12) // only holes facing the viewer
    .map(([x, y, z]) => {
      const cx = c + x * R;
      const cy = c - y * R;
      const across = Math.sin(HOLE_RADIUS) * R;
      // Foreshortened toward the rim: the radial axis shrinks with z.
      const along = across * z;
      const angle = (Math.atan2(-y, x) * 180) / Math.PI;
      const shade = (0.55 + 0.45 * z).toFixed(2);
      return `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${along.toFixed(2)}" ry="${across.toFixed(2)}" transform="rotate(${angle.toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})" fill="#3e4a08" fill-opacity="${shade}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
<radialGradient id="b" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#f7ffb0"/><stop offset=".45" stop-color="#dcf43c"/><stop offset="1" stop-color="#8fa814"/></radialGradient>
<radialGradient id="h" cx="35%" cy="28%" r="30%"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="${c}" cy="${c}" r="${R}" fill="url(#b)"/>${holes}
<circle cx="${c}" cy="${c}" r="${R}" fill="url(#h)"/>
<circle cx="${c}" cy="${c}" r="${R - 0.5}" fill="none" stroke="#6f8410" stroke-width="1"/>
</svg>`;
}

/** Makes the icon available to CSS as var(--pickleball). */
export function installPickleballIcon(): void {
  const url = `url("data:image/svg+xml,${encodeURIComponent(pickleballSvg())}")`;
  document.documentElement.style.setProperty('--pickleball', url);
}
