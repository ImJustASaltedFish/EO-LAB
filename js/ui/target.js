// The target paper on the observation screen, like an archery or airsoft target: rings every 5 mm scoring 10 (the
// centre) to 1, an inner X ring, a crosshair and the scores. Drawn over the card image with "multiply", like ink on
// paper, so the rings stay visible inside the beam. Used by the screen close-up and the 3D screen card.
import { CONFIG } from '../optics/config.js';

const INK = 'rgb(64,64,64)';   // printed ink reflects about a quarter of what white paper does

// `centre` is the target centre in rail metres on the screen plane; the canvas shows the square whose top-left
// corner is (left, top), at `scale` pixels per metre.
export function drawTarget(ctx, { centre, left, top, scale, lineWidth = 1, font = 9 }) {
  const { ringStep, rings, xRadius } = CONFIG.target;
  const { width, height } = ctx.canvas;
  const cx = (centre.x - left) * scale;
  const cy = (top - centre.y) * scale;
  const crisp = (v) => Math.floor(v + 1e-6) + 0.5;   // through the centre of the pixel holding v, not smeared over two
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const r of [xRadius, ...Array.from({ length: rings }, (_, n) => (n + 1) * ringStep)]) {
    ctx.moveTo(cx + r * scale, cy);
    ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI);
  }
  ctx.moveTo(0, crisp(cy));
  ctx.lineTo(width, crisp(cy));
  ctx.moveTo(crisp(cx), 0);
  ctx.lineTo(crisp(cx), height);
  ctx.stroke();
  // Scores on the diagonals (clear of the crosshair), in the middle of each band; skipped when bands get too thin.
  const band = ringStep * scale;
  if (band >= 1.4 * font) {
    ctx.font = `${font}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let score = 1; score < rings; score++) {
      const r = (rings - score + 0.5) * band / Math.SQRT2;
      for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) ctx.fillText(String(score), cx + sx * r, cy + sy * r);
    }
  }
  ctx.restore();
}
