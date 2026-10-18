// Chapter 1 procedure (handout §4A, Fig. 1-4): steps, checks, hints, warnings (spec §3.5–3.6). Pure logic.
import { CONFIG } from '../optics/config.js';
import { objectiveAlignmentAt } from '../optics/bench.js';

const C = CONFIG.checks;
const W = CONFIG.warnings;
const len = (v) => (v ? Math.hypot(v.x, v.y) : Infinity);
const travelEnds = () => [0, CONFIG.objective.travel];

export const STEPS = Object.freeze([
  {
    id: 'start',
    parts: [],
    controls: ['laser.power'],
    insets: [],
    camera: 'overview',
    checks: [{ id: 'on', test: (s) => s.laser.on }],
    hints: 1,
    questions: [],
  },
  {
    id: 's1',
    parts: ['a1', 'a2'],
    controls: ['a1.z', 'a1.height', 'a1.x', 'a1.opening', 'a2.z', 'a2.height', 'a2.x', 'a2.opening'],
    insets: ['a1', 'a2'],
    camera: 'laser',
    checks: [
      {
        id: 'closed',
        test: (s) => s.parts.a1.onRail && s.parts.a2.onRail
          && s.parts.a1.opening <= C.s1.openingMax && s.parts.a2.opening <= C.s1.openingMax,
      },
      { id: 'positions', test: (s) => s.parts.a1.onRail && s.parts.a2.onRail && s.parts.a1.z <= C.s1.a1MaxZ && s.parts.a2.z >= C.s1.a2MinZ },
      {
        id: 'sameHeight',
        test: (s) => s.parts.a1.onRail && s.parts.a2.onRail && Math.abs(s.parts.a1.height - s.parts.a2.height) <= C.s1.heightTol,
      },
      { id: 'passes', test: (s, r) => len(r.at.a1?.offset) <= C.s1.centreTol && len(r.at.a2?.offset) <= C.s1.centreTol },
    ],
    hints: 4,
    questions: [],
  },
  {
    id: 's2a',
    parts: ['sf', 'screen'],
    controls: ['sf.z', 'sf.height', 'sf.x', 'screen.z', 'screen.mark'],
    insets: ['ring', 'screen'],
    camera: 'filter',
    checks: [
      {
        id: 'mount',
        test: (s) => {
          const { a1, a2, sf } = s.parts;
          return sf.onRail && a1.onRail && a2.onRail && a1.z < sf.z && sf.z < a2.z && sf.z <= C.s2a.sfMaxZ;
        },
      },
      { id: 'centred', test: (s, r) => len(r.at.ring?.offset) <= C.s2a.centreTol },
      { id: 'a2far', test: (s) => s.parts.a2.onRail && s.parts.sf.onRail && s.parts.a2.z - s.parts.sf.z >= C.s2a.a2MinGap },
      {
        id: 'marked',
        test: (s) => s.parts.screen.onRail && s.parts.a2.onRail && s.parts.screen.z > s.parts.a2.z && s.parts.screen.mark !== null,
      },
    ],
    hints: 3,
    questions: [],
  },
  {
    id: 's2b',
    parts: [],
    controls: ['sf.objective', 'sf.focus', 'sf.height', 'sf.x'],
    insets: ['planeA', 'a2'],
    camera: 'filter',
    checks: [
      { id: 'installed', test: (s) => s.parts.sf.objective },
      { id: 'planeA', test: (s) => s.parts.sf.objective && travelEnds().every((f) => objectiveAlignmentAt(s, f).planeA <= C.s2b.planeATol) },
      { id: 'a2centre', test: (s) => s.parts.sf.objective && travelEnds().every((f) => objectiveAlignmentAt(s, f).a2 <= C.s2b.a2CentreTol) },
      { id: 'far', test: (s) => s.parts.sf.focus >= C.s2b.focusMin },
    ],
    hints: 4,
    questions: ['q3'],
  },
  {
    id: 's3',
    parts: [],
    controls: ['sf.pinhole', 'sf.phX', 'sf.phY', 'sf.focus', 'screen.z'],
    insets: ['screen'],
    camera: 'screen',
    checks: [
      { id: 'installed', test: (s) => s.parts.sf.pinhole },
      { id: 'clean', test: (s, r) => (r.pinhole?.transmission ?? 0) >= C.s3.transmissionMin },
      {
        id: 'screenClose',
        test: (s) => {
          const { sf, a2, screen } = s.parts;
          return sf.onRail && a2.onRail && screen.onRail && sf.z < screen.z && screen.z < a2.z
            && screen.z - sf.z <= C.s3.screenMaxDistance;
        },
      },
    ],
    hints: 4,
    questions: ['q1', 'q4', 'q5'],
  },
  {
    id: 's4',
    parts: ['lens'],
    controls: ['a1.z', 'a1.opening', 'lens.z', 'lens.height', 'screen.z'],
    insets: ['screen'],
    camera: 'overview',
    checks: [
      {
        id: 'layout',
        test: (s) => {
          const { a1, a2, sf, lens } = s.parts;
          return a1.onRail && a2.onRail && sf.onRail && lens.onRail && sf.z < a1.z && a1.z < lens.z && lens.z < a2.z;
        },
      },
      { id: 'lensCentred', test: (s, r) => len(r.at.lens?.offset) <= C.s4.lensCentreTol },
      {
        id: 'extent',
        test: (s, r) => {
          const e = r.at.lens?.extent ?? 0;
          return e >= C.s4.extentMin && e <= C.s4.extentMax;
        },
      },
      { id: 'tested', test: (s, r, flow) => s.stats.testTravel - flow.stepStart.testTravel >= C.s4.screenTravelMin },
      {
        id: 'collimated',
        test: (s, r) => {
          const { lens, screen, a2 } = s.parts;
          return lens.onRail && screen.onRail && a2.onRail && lens.z < screen.z && screen.z < a2.z
            && r.stoppedAt === 'screen' && r.divergence?.state === 'collimated';
        },
      },
    ],
    hints: 4,
    questions: ['q2', 'q6'],
  },
  { id: 'done', parts: [], controls: [], insets: ['screen'], camera: 'overview', checks: [], hints: 0, questions: [] },
]);

export const STEP_LABELS = Object.freeze({ start: 'start', s1: '1', s2a: '2a', s2b: '2b', s3: '3', s4: '4', done: 'done' });

export function createFlow() {
  return { index: 0, stepStart: { screenTravel: 0, testTravel: 0, time: 0 }, hintsShown: 0, warningsShown: 0, active: {} };
}

export const currentStep = (flow) => STEPS[flow.index];

export function evaluateChecks(flow, state, result) {
  return STEPS[flow.index].checks.map((c) => ({ id: c.id, pass: Boolean(c.test(state, result, flow)) }));
}

export function canAdvance(flow, state, result) {
  return flow.index < STEPS.length - 1 && evaluateChecks(flow, state, result).every((c) => c.pass);
}

export function advance(flow, state, now = 0) {
  return {
    ...flow,
    index: Math.min(STEPS.length - 1, flow.index + 1),
    stepStart: { screenTravel: state.stats.screenTravel, testTravel: state.stats.testTravel, time: now },
    hintsShown: 0,
    active: {},
  };
}

export function revealHint(flow) {
  return { ...flow, hintsShown: Math.min(STEPS[flow.index].hints, flow.hintsShown + 1) };
}

export function isPartUnlocked(flow, id) {
  return STEPS.slice(0, flow.index + 1).some((s) => s.parts.includes(id));
}

export function lockedPartStepLabel(id) {
  const step = STEPS.find((s) => s.parts.includes(id));
  return step ? STEP_LABELS[step.id] : '';
}

export function unlockedControls(flow) {
  const current = [...STEPS[flow.index].controls];
  const earlier = [...new Set(STEPS.slice(0, flow.index).flatMap((s) => s.controls))].filter((c) => !current.includes(c));
  return { current, earlier };
}

// Warnings (spec §3.6). A warning shows once and re-arms when its condition stops being true.
const stepIs = (flow, ...ids) => ids.includes(STEPS[flow.index].id);
const A2_PLACEMENT = ['onRail', 'z', 'x', 'height'];
const WARNINGS = [
  // Aperture 2 is the alignment reference from step 1 to the end: it must stay where step 1 left it.
  {
    id: 'm3',
    test: (flow, prev, next) => stepIs(flow, 's2a', 's2b', 's3', 's4')
      && A2_PLACEMENT.some((key) => prev.parts.a2[key] !== next.parts.a2[key]),
  },
  { id: 'm4', test: (flow, prev, next, result) => next.parts.sf.objective && result.focusDz < W.m4DzMin },
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
