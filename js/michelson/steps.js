// Michelson procedure (handout 實驗十六 §4 steps 3, 4 and 6, the way the lab does them): steps, checks, hints,
// card trials and warnings (spec §3.5–3.7). Pure logic.
import { MI } from './config.js';
import { atStageEdge } from './state.js';

const C = MI.checks;

// How far the reflected beam is off a hole row across the table: horizontally (from ±x) and from level.
export function reflectedErrors(direction) {
  return { horizontal: Math.atan2(Math.abs(direction.z), Math.abs(direction.x)), vertical: Math.abs(Math.asin(direction.y)) };
}

// One lens in each arm, each a different lens, each centred on its beam.
function lensPerArm(r) {
  const { T, R } = r.arms;
  if (!T?.mirror || !R?.mirror || T.lenses.length !== 1 || R.lenses.length !== 1) return false;
  return T.lenses[0].id !== R.lenses[0].id && [T, R].every((arm) => arm.lenses[0].offset <= C.mi4.lensCentreTol);
}

const fringe = (r, test) => r.fringe !== null && test(r.fringe);

export const STEPS = Object.freeze([
  {
    id: 'miStart',
    parts: [],
    controls: ['laser.power'],
    insets: ['iris'],
    camera: 'source',
    checks: [{ id: 'on', test: (s) => s.laser.on }],
    hints: 1,
    questions: [],
  },
  {
    id: 'mi1',
    parts: ['bs', 'screen'],
    controls: ['iris.opening', 'bs.place', 'bs.rotation', 'bs.tilt', 'screen.place'],
    insets: ['iris', 'screen'],
    camera: 'bs',
    checks: [
      { id: 'irisClosed', test: (s) => s.iris.opening <= C.mi1.irisClosedMax },
      { id: 'bsOnBeam', test: (s, r) => r.bsHit !== null && r.bsHit.offset <= C.mi1.bsCentreTol },
      {
        id: 'along',
        test: (s, r) => {
          if (!r.reflected) return false;
          const e = reflectedErrors(r.reflected);
          return e.horizontal <= C.mi1.angleTol && e.vertical <= C.mi1.angleTol;
        },
      },
      { id: 'cardTested', test: (s, r, flow) => flow.trials.max - flow.trials.min >= C.mi1.cardSpan },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 'mi2',
    parts: ['m1', 'm2'],
    controls: ['m1.place', 'm1.h', 'm1.v', 'm2.place', 'm2.h', 'm2.v'],
    insets: ['iris', 'screen'],
    camera: 'overview',
    checks: [
      {
        id: 'onBeams',
        test: (s, r) => {
          const { T, R } = r.arms;
          return Boolean(T?.mirror && R?.mirror) && T.mirror !== R.mirror
            && T.offset <= C.mi2.mirrorCentreTol && R.offset <= C.mi2.mirrorCentreTol;
        },
      },
      // Each mirror 300 mm (12 holes) from the beam splitter, which also makes the two arms equal.
      { id: 'armLength', test: (s, r) => [r.arms.T, r.arms.R].every((arm) => arm?.mirror && Math.abs(arm.length - C.mi2.armLength) <= C.mi2.armTol) },
      {
        id: 'returned',
        test: (s, r) => s.iris.opening <= C.mi1.irisClosedMax
          && ['m1', 'm2'].every((m) => r.iris.spots.some((p) => p.mirror === m && Math.hypot(p.dx, p.dy) <= C.mi2.returnTol)),
      },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 'mi3',
    parts: [],
    controls: ['iris.opening', 'screen.place', 'm1.h', 'm1.v', 'm1.stage', 'tap'],
    insets: ['screen'],
    camera: 'screen',
    checks: [
      { id: 'irisOpen', test: (s) => s.iris.opening >= C.mi3.irisOpenMin },
      { id: 'screenOut', test: (s, r) => r.fringe !== null },
      { id: 'overlap', test: (s, r) => fringe(r, (f) => f.overlap <= C.mi3.overlapTol) },
      { id: 'visible', test: (s, r) => fringe(r, (f) => f.contrast >= C.mi3.contrastMin) },
      { id: 'spacing', test: (s, r) => fringe(r, (f) => f.spacing >= C.mi3.spacingMin && f.spacing <= C.mi3.spacingMax) },
    ],
    hints: 4,
    questions: ['mi1', 'mi2', 'mi4'],
  },
  {
    id: 'mi4',
    parts: ['lens1', 'lens2'],
    controls: ['lens1.place', 'lens2.place', 'tap'],
    insets: ['screen'],
    camera: 'overview',
    checks: [
      { id: 'lensesIn', test: (s, r) => lensPerArm(r) },
      {
        id: 'focusOnMirror',
        test: (s, r) => lensPerArm(r)
          && [r.arms.T, r.arms.R].every((arm) => Math.abs(arm.lenses[0].toMirror - MI.lens.focalLength) <= C.mi4.focusTol),
      },
      { id: 'rings', test: (s, r) => fringe(r, (f) => f.rings >= C.mi4.ringsMin && f.centred) },
    ],
    hints: 4,
    questions: ['mi3', 'mi5'],
  },
  { id: 'miDone', parts: [], controls: [], insets: ['screen'], camera: 'overview', checks: [], hints: 0, questions: [] },
]);

export const STEP_LABELS = Object.freeze({ miStart: 'start', mi1: '1', mi2: '2', mi3: '3', mi4: '4', miDone: 'done' });

const noTrials = () => ({ min: Infinity, max: -Infinity });

export function createFlow() {
  return { index: 0, stepStart: { time: 0 }, hintsShown: 0, tipOn: false, guideOn: false, warningsShown: 0, active: {}, trials: noTrials() };
}

export const currentStep = (flow) => STEPS[flow.index];

export function evaluateChecks(flow, state, result) {
  return currentStep(flow).checks.map((c) => ({ id: c.id, pass: Boolean(c.test(state, result, flow)) }));
}

export function canAdvance(flow, state, result) {
  return flow.index < STEPS.length - 1 && evaluateChecks(flow, state, result).every((c) => c.pass);
}

export function advance(flow, state, now = 0) {
  return {
    ...flow,
    index: Math.min(STEPS.length - 1, flow.index + 1),
    stepStart: { time: now },
    hintsShown: 0,
    tipOn: false,
    guideOn: false,
    active: {},
    trials: noTrials(),
  };
}

// The first press shows the tip about what is wrong now (when there is one); later presses show the hints in order.
export function revealHint(flow, hasTip) {
  if (hasTip && !flow.tipOn) return { ...flow, tipOn: true };
  return { ...flow, hintsShown: Math.min(currentStep(flow).hints, flow.hintsShown + 1) };
}

export const guideAvailable = (flow) => currentStep(flow).hints > 0 && flow.hintsShown >= currentStep(flow).hints;

export const toggleGuide = (flow) => ({ ...flow, guideOn: !flow.guideOn });

// Where the layout guide (and the panel's Place button) puts a part: in step 1 the screen is the alignment card.
export function guideFor(id, stepId) {
  return id === 'screen' && stepId === 'mi1' ? MI.guide.card : MI.guide[id];
}

// Where the panel's Place button puts a part: mirrors and lenses short of where they belong (students move them on),
// the beam splitter and the screen on the layout guide.
export function placeFor(id, stepId) {
  return MI.place[id] ?? guideFor(id, stepId);
}

export function isPartUnlocked(flow, id) {
  return STEPS.slice(0, flow.index + 1).some((s) => s.parts.includes(id));
}

export function lockedPartStepLabel(id) {
  const step = STEPS.find((s) => s.parts.includes(id));
  return step ? STEP_LABELS[step.id] : '';
}

export function unlockedControls(flow) {
  const current = [...currentStep(flow).controls];
  const earlier = [...new Set(STEPS.slice(0, flow.index).flatMap((s) => s.controls))].filter((c) => !current.includes(c));
  return { current, earlier };
}

// Step 1: remember how far along the reflected beam the card has caught it.
export function observe(flow, result) {
  if (currentStep(flow).id !== 'mi1' || !result.cardOn) return flow;
  const d = result.cardOn.distance;
  if (d >= flow.trials.min && d <= flow.trials.max) return flow;
  return { ...flow, trials: { min: Math.min(flow.trials.min, d), max: Math.max(flow.trials.max, d) } };
}

// Warnings (spec §3.7). A warning shows once and re-arms when its condition stops being true.
const bsChanged = (a, b) => ['placed', 'heading', 'rotation', 'tilt'].some((k) => a[k] !== b[k]) || a.pos.x !== b.pos.x || a.pos.z !== b.pos.z;
const WARNINGS = [
  { id: 'miBs', test: (flow, prev, next) => flow.index > STEPS.findIndex((s) => s.id === 'mi1') && bsChanged(prev.parts.bs, next.parts.bs) },
  { id: 'miStage', test: (flow, prev, next) => next.parts.m1.placed && atStageEdge(next) },
];

export function detectWarnings(flow, prev, next, result) {
  const active = { ...flow.active };
  const shown = [];
  for (const w of WARNINGS) {
    const on = Boolean(w.test(flow, prev, next, result));
    if (on && !active[w.id]) shown.push(w.id);
    active[w.id] = on;
  }
  return { flow: { ...flow, active, warningsShown: flow.warningsShown + shown.length }, shown };
}
