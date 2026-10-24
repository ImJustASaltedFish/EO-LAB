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
  // Ready source on row x = 0, as Experiment 1 leaves it: laser, spatial filter, Aperture 1 (the only iris, halfway
  // between the pinhole and the lens) and the f = 200 mm lens (Experiment 1's lens, CONFIG.lens), one focal length
  // after the pinhole. waistRadius: the collimated beam. Parts keep out of its strip.
  source: { waistRadius: 11.1e-3, laserZ: -0.320, pinholeZ: -0.270, a1Z: -0.170, lensZ: -0.070, keepOutZ: 0.000, keepOutHalfWidth: 0.040, stopHalf: 0.060 },
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
  // Hand errors (degrees), drawn once per run with a random sign. Mirrors at most 0.6° off, so the light they send
  // back along a 300 mm arm still passes the 45° beam splitter (18 mm wide seen along the arm) and reaches Aperture 1.
  errors: { bsHeading: [0.5, 2], bsTilt: [0.1, 0.5], mirrorTilt: [0.2, 0.6] },
  trace: { maxInteractions: 8, minPower: 0.01, minSpot: 50e-6 },
  checks: {
    mi1: { irisClosedMax: 1.5e-3, bsCentreTol: 2e-3, angleTol: 1e-3, cardSpan: 0.150 },
    mi2: { mirrorCentreTol: 3e-3, armLength: 0.300, armTol: 12.5e-3, returnTol: 0.5e-3 },   // armTol: each arm, half a hole
    mi3: { irisOpenMin: 8e-3, overlapTol: 1e-3, contrastMin: 0.5, spacingMin: 1e-3, spacingMax: 5e-3 },
    mi4: { lensCentreTol: 1e-3, focusTol: 10e-3, ringsMin: 3 },
  },
  spacingShownMax: 0.050,
  tap: { amplitude: 3 * Math.PI, decay: 0.4, frequency: 12, duration: 1.5 },
  // Layout guide (spec §3.6): positions (m) and headings (45° steps; 0 = +z, 2 = +x, 4 = −z, 6 = −x).
  guide: {
    bs: { pos: { x: 0, z: 0.300 }, heading: 3 },
    m1: { pos: { x: 0, z: 0.600 }, heading: 4 },
    m2: { pos: { x: 0.300, z: 0.300 }, heading: 6 },
    screen: { pos: { x: -0.250, z: 0.300 }, heading: 2 },
    card: { pos: { x: 0.100, z: 0.300 }, heading: 6 },   // step 1: the screen as the alignment card on the reflected row
    lens1: { pos: { x: 0, z: 0.500 }, heading: 0 },
    lens2: { pos: { x: 0.200, z: 0.300 }, heading: 2 },
  },
  // Where the panel's Place button puts mirrors and lenses: 150 mm from the beam splitter, on their rows; students
  // move them on to 300 mm (mirrors) and about 200 mm (lenses) themselves.
  place: {
    m1: { pos: { x: 0, z: 0.450 }, heading: 4 },
    m2: { pos: { x: 0.150, z: 0.300 }, heading: 6 },
    lens1: { pos: { x: 0, z: 0.450 }, heading: 0 },
    lens2: { pos: { x: 0.150, z: 0.300 }, heading: 2 },
  },
});
