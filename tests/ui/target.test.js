import { test, assert } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { drawTarget } from '../../js/ui/target.js';

// A 200 px view of a 50 mm square of the screen centred on the target: 4 px per mm.
function paper(colour = 'rgb(200,200,200)') {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 200, 200);
  drawTarget(ctx, { centre: { x: 0, y: 0.1 }, left: -0.025, top: 0.125, scale: 4000 });
  return c;
}
// The darkest green value within ±half px of (x, y): printed lines are anti-aliased.
function darkest(c, x, y, half = 1) {
  const d = c.getContext('2d').getImageData(x - half, y - half, 2 * half + 1, 2 * half + 1).data;
  let min = 255;
  for (let i = 1; i < d.length; i += 4) min = Math.min(min, d[i]);
  return min;
}
const green = (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data[1];
const polar = (mm, degrees) => [
  Math.round(100 + 4 * mm * Math.cos((degrees * Math.PI) / 180)),
  Math.round(100 - 4 * mm * Math.sin((degrees * Math.PI) / 180)),
];

test('target: rings every 5 mm, a crosshair and score numbers are printed like ink', () => {
  const step = CONFIG.target.ringStep * 1e3;
  const c = paper();
  assert(darkest(c, ...polar(step, 22.5)) < 120, `ring 1 printed: ${darkest(c, ...polar(step, 22.5))}`);
  assert(darkest(c, ...polar(2 * step, 22.5)) < 120, 'ring 2 printed');
  assert(green(c, ...polar(1.5 * step, 22.5)) > 190, `paper between the rings: ${green(c, ...polar(1.5 * step, 22.5))}`);
  assert(green(c, 100, 70) < 120 && green(c, 130, 100) < 120, 'crosshair through the centre');
  assert(darkest(c, ...polar(1.5 * step, 45), 4) < 150, 'score 9 printed in the second band');
});

test('target: the ink stays visible inside a bright beam', () => {
  const c = paper('rgb(30,255,60)');
  assert(darkest(c, ...polar(CONFIG.target.ringStep * 1e3, 22.5)) < 120, 'ring 1 darkens the green light');
});
