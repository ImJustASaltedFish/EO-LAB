import { test, assert, assertEqual, assertClose, assertRelClose } from '../harness.js';
import { CONFIG } from '../../js/optics/config.js';
import { createNoise } from '../../js/optics/noise.js';
import {
  toneMap, beamColour, cardPixel, brightPixel, screenWindow, rawBeamSampler, angularSampler,
  expandedPattern, gaussianSpotSampler, renderScreen,
} from '../../js/optics/screen.js';

test('screen: tone map is 0 at 0, 1 at the reference, and monotonic', () => {
  assertClose(toneMap(0), 0, 0);
  assertClose(toneMap(1), 1, 1e-12);
  assertClose(toneMap(0.001), Math.log10(2) / Math.log10(1001), 1e-12);
  assert(toneMap(0.01) < toneMap(0.1) && toneMap(0.1) < toneMap(0.5), 'monotonic');
  assertClose(toneMap(5), 1, 0, 'clamped');
});

test('screen: colours go from black to green to near-white; the card stays dim when unlit', () => {
  assertEqual(beamColour(0).join(), '0,0,0');
  assertEqual(beamColour(1).join(), '230,255,230');
  assertEqual(cardPixel(0).join(), '68,70,72');
  assertEqual(cardPixel(1)[1], 255);
});

test('screen: window size is 2.5× the beam, clamped to 5–150 mm', () => {
  assertClose(screenWindow(10e-3), 25e-3, 1e-12);
  assertClose(screenWindow(0.1e-3), 5e-3, 1e-12);
  assertClose(screenWindow(1), 0.150, 1e-12);
});

test('screen: D4σ of a Gaussian spot equals its 1/e² diameter', () => {
  const centre = { x: 0.2e-3, y: 0.1 };
  const shot = renderScreen({ sample: gaussianSpotSampler({ centre, radius: 1e-3 }), centre, size: 6e-3 });
  assertRelClose(shot.d4sigma, 2e-3, 0.02);
  assertClose(shot.centroid.x, centre.x, 1e-6);
  assertClose(shot.peak, 1, 0.01);
});

test('screen: expanded beam is the magnified input (D4σ = 2·W·D/f0)', () => {
  const W = CONFIG.laser.waistRadius;
  const f0 = CONFIG.objective.focalLength;
  const D = 0.1;
  const centre = { x: 0, y: 0.1 };
  const pattern = expandedPattern({ direction: { x: 0, y: 0 }, angularRadius: W / f0, focalLength: f0, noise: null });
  const sample = angularSampler({ pattern, A: D, B: centre });
  const shot = renderScreen({ sample, centre, size: screenWindow((2 * W * D) / f0) });
  assertRelClose(shot.d4sigma, (2 * W * D) / f0, 0.02);
});

test('screen: raw beam shows the dust noise; a small hole shrinks the spot', () => {
  const centre = { x: 0, y: 0.1 };
  const radius = 0.6e-3;
  const noisy = renderScreen({ sample: rawBeamSampler({ centre, radius, noise: createNoise(3) }), centre, size: 3e-3, pixels: 128 });
  const clean = renderScreen({ sample: rawBeamSampler({ centre, radius, noise: null }), centre, size: 3e-3, pixels: 128 });
  let diff = 0;
  let count = 0;
  for (let i = 0; i < clean.image.length; i++) {
    if (clean.image[i] > Math.exp(-2)) {
      diff += Math.abs(noisy.image[i] / clean.image[i] - 1);
      count += 1;
    }
  }
  assert(diff / count > 0.05, `mean relative noise ${diff / count}`);
  const clipped = renderScreen({
    sample: rawBeamSampler({ centre, radius, noise: null, clips: [{ centre, radius, hole: centre, r: 0.2e-3 }] }),
    centre,
    size: 3e-3,
    pixels: 128,
  });
  assert(clipped.d4sigma < clean.d4sigma * 0.5, 'a small hole shrinks the spot');
});

test('screen: brightPixel lights the card linearly; cardPixel is brightPixel on the log curve', () => {
  assertEqual(brightPixel(0).join(), '68,70,72');
  assertEqual(brightPixel(1)[1], 255);
  assertEqual(cardPixel(0.3).join(), brightPixel(toneMap(0.3)).join());
});
