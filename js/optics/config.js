// Every physical constant, range and tolerance used by EO LAB (SI units: m, rad).
// Source of truth: docs/superpowers/specs/2026-10-17-eo-lab-web-experiment-1-design.md
function deepFreeze(value) {
  Object.values(value).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(value);
}

export const CONFIG = deepFreeze({
  wavelength: 532e-9,
  laser: { waistRadius: 0.5e-3, exitHeight: 0.100, exitHeightJitter: 0.003 },   // fixed, level, on the rail centreline
  post: { min: 0.070, max: 0.130, initial: 0.100, fine: 0.05e-3, coarse: 0.5e-3 },
  lateral: { range: 5e-3, startMin: 0.5e-3, startMax: 2e-3, fine: 0.05e-3, coarse: 0.5e-3 },
  iris: { openingMin: 1.0e-3, openingMax: 12.0e-3, openingInitial: 12.0e-3, openingStep: 0.1e-3, plateRadius: 0.025 },
  objective: {
    focalLength: 9.0e-3,
    travel: 6.0e-3,
    focusAt: 1.0e-3,
    startAt: 3.0e-3,
    focusFine: 2e-6,
    focusCoarse: 50e-6,
    surfaceRadii: [15e-3, 22e-3, 34e-3],
  },
  pinhole: { radius: 12.5e-6, range: 0.5e-3, fine: 1e-6, coarse: 10e-6, installOffsetMin: 30e-6, installOffsetMax: 120e-6 },
  mount: { ringRadius: 4e-3, ringOffset: 0.040, fine: 5e-6, coarse: 0.1e-3 },   // fine/coarse: moving the whole spatial filter
  lens: { focalLength: 0.200, diameter: 25.4e-3, clearAperture: 22.9e-3, zFine: 0.5e-3, zCoarse: 5e-3 },
  screen: { size: 0.150, centreHeight: 0.100, zFine: 1e-3, zCoarse: 10e-3, imageSize: 256, cardPixels: 128, cardTexture: 512, windowFactor: 2.5, windowMin: 5e-3, windowMax: 0.150 },
  // Target paper on the screen, centred on the beam axis: rings every 5 mm scoring 10 (centre) to 1, an X ring and a crosshair.
  target: { ringStep: 5e-3, rings: 10, xRadius: 2.5e-3 },
  rail: { zMin: 0.020, zMax: 1.130, beamBlockZ: 1.150, minGap: 0.005, grid: 1e-3, zFine: 1e-3, zCoarse: 10e-3 },
  footprint: { a1: [-0.010, 0.010], a2: [-0.010, 0.010], sf: [-0.060, 0.010], lens: [-0.010, 0.010], screen: [-0.010, 0.015] },
  noise: { count: 24, freqMin: 4e3, freqMax: 15e3, power: 0.04, gridSize: 256, gridSpan: 3 },
  pinholeGrid: { samples: 48, farFieldSamples: 192, farFieldSpan: 3 },
  tone: { k: 1000 },
  stopThreshold: 0.01,
  pinholeStopThreshold: 1e-5,
  checks: {
    s1: { openingMax: 1.5e-3, a1MaxZ: 0.150, a2MinZ: 0.700, centreTol: 0.25e-3, heightTol: 0.25e-3 },
    s2a: { sfMaxZ: 0.300, centreTol: 0.3e-3, a2MinGap: 0.300 },
    s2b: { planeATol: 0.5e-3, a2CentreTol: 1.0e-3, focusMin: 5.5e-3 },
    s3: { transmissionMin: 0.97, screenMaxDistance: 0.300 },
    s4: { lensCentreTol: 0.5e-3, extentMin: 10e-3, extentMax: 22.9e-3, screenTravelMin: 0.200, collimationTol: 2.2e-3 },
  },
  warnings: { m4DzMin: -0.5e-3 },
});

export const DERIVED = Object.freeze({
  laserRayleigh: (Math.PI * CONFIG.laser.waistRadius ** 2) / CONFIG.wavelength,
  focusWaist: (CONFIG.wavelength * CONFIG.objective.focalLength) / (Math.PI * CONFIG.laser.waistRadius),
});
