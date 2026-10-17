import { test, assert, assertClose } from '../harness.js';
import { niceStep, drawApertureInset, drawPlaneAInset, drawScreenInset } from '../../js/ui/insets.js';
import { renderScreen, gaussianSpotSampler } from '../../js/optics/screen.js';

const makeCanvas = () => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  return c;
};
const pixel = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);

test('insets: scale steps are 1, 2 or 5 × 10^n', () => {
  assertClose(niceStep(6), 1, 1e-12);
  assertClose(niceStep(20), 2, 1e-12);
  assertClose(niceStep(50), 10, 1e-12);
  assertClose(niceStep(0.3), 0.05, 1e-12);
});

test('insets: an iris face shows the beam on the blades and a dark hole without a beam', () => {
  const c = makeCanvas();
  // View half-size = max(2.5·r, 1.6·(offset + radius)) = 3.2 mm → beam centre at x ≈ 80 + 1.5/3.2·80 = 117.5 px.
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beam: { dx: 1.5e-3, dy: 0, radius: 0.5e-3 } });
  const onSpot = pixel(c, 117, 80);
  const far = pixel(c, 20, 20);
  assert(onSpot[1] > far[1] + 100, `green on the blades: ${onSpot} vs ${far}`);
  drawApertureInset(c, { r: 0.5e-3, outer: 0.025, beam: null });
  assert(pixel(c, 80, 80)[1] < 20, 'dark hole without a beam');
});

test('insets: plane A and the screen draw, and fall back to a message without light', () => {
  const c = makeCanvas();
  drawPlaneAInset(c, { holeRadius: 0.5e-3, rings: [{ x: 0, y: 0, radius: 5e-3 }, { x: 0, y: 0, radius: 3e-3 }] });
  drawPlaneAInset(c, null, 'No light');
  const centre = { x: 0, y: 0.1 };
  const shot = renderScreen({ sample: gaussianSpotSampler({ centre, radius: 2e-3 }), centre, size: 10e-3, pixels: 64 });
  drawScreenInset(c, { window: shot }, { x: 3e-3, y: 0.1 });
  const middle = pixel(c, 80, 80);
  assert(middle[1] > 200, `bright spot in the middle: ${middle}`);
  drawScreenInset(c, null, null, 'No light');
});
