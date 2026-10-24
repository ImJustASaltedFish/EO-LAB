// Every Michelson constant, range and tolerance (SI units: m, rad).
// Source of truth: docs/superpowers/specs/2026-10-24-eo-lab-web-michelson-design.md
function deepFreeze(value) {
  Object.values(value).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(value);
}

export const MI = deepFreeze({
  wavelength: 532e-9,
  beamHeight: 0.100,
  // Breadboard: z along the source beam, x across (+x toward the front edge); M6 holes every 25 mm.
  table: { zMin: -0.500, zMax: 0.900, xMin: -0.450, xMax: 0.450, pitch: 0.025, holeZ0: -0.475, holeX0: -0.425 },
  // Ready source on row x = 0: laser, spatial filter, f = 200 mm lens, iris (the exit). Parts keep out of its strip.
  source: { waistRadius: 11.1e-3, laserZ: -0.320, pinholeZ: -0.270, lensZ: -0.070, irisZ: -0.025, keepOutZ: 0.000, keepOutHalfWidth: 0.040, stopHalf: 0.060 },
  iris: { openingMin: 1.0e-3, openingMax: 12.0e-3, openingInitial: 12.0e-3, step: 0.1e-3, plateRadius: 0.025 },
  bs: { R: 0.5, T: 0.5, radius: 12.7e-3, mountHalf: 0.020, rotationRange: 50e-3, rotationFine: 0.05e-3, rotationCoarse: 1e-3, tiltRange: 20e-3, tiltFine: 0.05e-3, tiltCoarse: 1e-3 },
  mirror: { radius: 12.7e-3, mountHalf: 0.020, tiltRange: 25e-3, tiltFine: 0.02e-3, tiltCoarse: 0.5e-3 },
  stage: { travel: 25e-3, initial: 12.5e-3, fine: 0.05e-6, coarse: 10e-6 },
  lens: { focalLength: 0.100, radius: 24e-3, mountHalf: 0.030, slide: 1e-3 },
  screen: { size: 0.150 },
  coherenceLength: 0.030,
  // Footprint rectangles [along the heading, across] in metres; two footprints keep minGap apart.
  footprints: { bs: [0.040, 0.040], m1: [0.060, 0.050], m2: [0.040, 0.040], screen: [0.020, 0.160], lens1: [0.020, 0.070], lens2: [0.020, 0.070] },
  minGap: 0.005,
  // Hand errors (degrees), drawn once per run with a random sign.
  errors: { bsHeading: [0.5, 2], bsTilt: [0.1, 0.5], mirrorTilt: [0.2, 1] },
  trace: { maxInteractions: 8, minPower: 0.01, minSpot: 50e-6 },
  checks: {
    mi1: { irisClosedMax: 1.5e-3, bsCentreTol: 2e-3, angleTol: 1e-3, cardSpan: 0.150 },
    mi2: { mirrorCentreTol: 3e-3, armTol: 12.5e-3, returnTol: 0.5e-3 },
    mi3: { irisOpenMin: 8e-3, overlapTol: 1e-3, contrastMin: 0.5, spacingMin: 1e-3, spacingMax: 5e-3 },
    mi4: { lensCentreTol: 1e-3, focusTol: 10e-3, ringsMin: 3 },
  },
  spacingShownMax: 0.050,
  tap: { amplitude: 3 * Math.PI, decay: 0.4, frequency: 12, duration: 1.5 },
  // Layout guide (spec §3.6): positions (m) and headings (45° steps; 0 = +z, 2 = +x, 4 = −z, 6 = −x).
  guide: {
    bs: { pos: { x: 0, z: 0.300 }, heading: 3 },
    m1: { pos: { x: 0, z: 0.500 }, heading: 4 },
    m2: { pos: { x: 0.200, z: 0.300 }, heading: 6 },
    screen: { pos: { x: -0.250, z: 0.300 }, heading: 2 },
    card: { pos: { x: 0.100, z: 0.300 }, heading: 6 },   // step 1: the screen as the alignment card on the reflected row
    lens1: { pos: { x: 0, z: 0.400 }, heading: 0 },
    lens2: { pos: { x: 0.100, z: 0.300 }, heading: 2 },
  },
});
