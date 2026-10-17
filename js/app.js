// Experiment 1 page (laser.html): input → state → bench() → 3D scene, close-ups, panel and step checks.
import { CONFIG } from './optics/config.js';
import { randomSeed } from './optics/rng.js';
import { bench } from './optics/bench.js';
import * as S from './lab/state.js';
import * as F from './lab/steps.js';
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';
import { createPanel } from './ui/panel.js';
import { createKnob, createSlider, createButton, createPositionControl } from './ui/controls.js';
import { drawApertureInset, drawPlaneAInset, drawScreenInset } from './ui/insets.js';
import { showToast } from './ui/toast.js';
import { webglAvailable } from './scene/webgl.js';

const { laser: L, post: P, objective: O, pinhole: PH, iris: I } = CONFIG;
const modeLabels = { fine: () => t('ui.fine'), coarse: () => t('ui.coarse') };
const partLabel = (id, key) => () => `${t(`part.${id}`)} · ${t(key)}`;
const fixed = (digits, factor) => (v) => (v * factor).toFixed(digits);

function heightKnob(id) {
  return { path: `parts.${id}.height`, label: partLabel(id, 'control.height'), unit: 'mm', format: fixed(2, 1e3), min: P.min, max: P.max, fine: P.fine, coarse: P.coarse };
}
function decentreKnob(key) {
  return { path: `parts.sf.${key}`, label: () => t(`control.sf.${key}`), unit: 'µm', format: fixed(0, 1e6), min: -O.decentreRange, max: O.decentreRange, fine: O.decentreFine, coarse: O.decentreCoarse };
}
function pinholeKnob(key) {
  return { path: `parts.sf.${key}`, label: () => t(`control.sf.${key}`), unit: 'µm', format: fixed(0, 1e6), min: -PH.range, max: PH.range, fine: PH.fine, coarse: PH.coarse };
}

const KNOBS = {
  'laser.pitch': { path: 'laser.pitch', label: () => t('control.laser.pitch'), unit: 'mrad', format: fixed(2, 1e3), min: -L.knobRange, max: L.knobRange, fine: L.knobFine, coarse: L.knobCoarse },
  'laser.yaw': { path: 'laser.yaw', label: () => t('control.laser.yaw'), unit: 'mrad', format: fixed(2, 1e3), min: -L.knobRange, max: L.knobRange, fine: L.knobFine, coarse: L.knobCoarse },
  'a1.height': heightKnob('a1'),
  'a2.height': heightKnob('a2'),
  'sf.height': heightKnob('sf'),
  'lens.height': heightKnob('lens'),
  'sf.objX': decentreKnob('objX'),
  'sf.objY': decentreKnob('objY'),
  'sf.focus': { path: 'parts.sf.focus', label: () => t('control.sf.focus'), unit: 'mm', format: fixed(3, 1e3), min: 0, max: O.travel, fine: O.focusFine, coarse: O.focusCoarse },
  'sf.phX': pinholeKnob('phX'),
  'sf.phY': pinholeKnob('phY'),
};
const SLIDERS = {
  'a1.opening': { path: 'parts.a1.opening', label: partLabel('a1', 'control.opening') },
  'a2.opening': { path: 'parts.a2.opening', label: partLabel('a2', 'control.opening') },
};
const PLACE_DEFAULTS = { a1: 0.05, a2: 0.9, sf: 0.2, lens: 0.45, screen: 1.0 };
const Z_STEPS = { a1: CONFIG.rail, a2: CONFIG.rail, sf: CONFIG.rail, lens: CONFIG.lens, screen: CONFIG.screen };
const INSET_IDS = ['a1', 'a2', 'ring', 'planeA', 'screen'];
const CAMERAS = ['overview', 'laser', 'filter', 'screen'];

// ---- state ----
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed();
let state = S.createInitialState(seed);
let flow = F.createFlow();
let result = bench(state);
let selectedPart = null;
let scene3d = null;
const startedAt = performance.now();
const debug = window.eolab ?? (window.eolab = { errors: [] });

const panel = createPanel(document.getElementById('panel'), {
  t,
  onNext: () => {
    if (!F.canAdvance(flow, state, result)) return;
    flow = F.advance(flow, state, performance.now());
    enterStep();
  },
  onHint: () => {
    flow = F.revealHint(flow);
    renderPanel();
  },
  onRestart: restart,
});

function restart() {
  if (window.confirm(t('ui.restartConfirm'))) location.search = `?seed=${randomSeed()}`;
}

function update(next) {
  if (next !== state) {
    const prev = state;
    state = next;
    const t0 = performance.now();
    result = bench(state);
    debug.lastBenchMs = performance.now() - t0;
    const detected = F.detectWarnings(flow, prev, state, result);
    flow = detected.flow;
    detected.shown.forEach((id) => showToast(t(`warning.${id}`)));
  }
  render();
}

function warnLocked(id) {
  flow = { ...flow, warningsShown: flow.warningsShown + 1 };
  showToast(t('warning.m5', { step: F.lockedPartStepLabel(id) }));
}

// ---- 3D scene (optional: the page still works without WebGL) ----
async function createScene3d() {
  const [{ createView }, models, { createBeamView }, { createInteraction }] = await Promise.all([
    import('./scene/view.js'),
    import('./scene/models.js'),
    import('./scene/beam.js'),
    import('./scene/interact.js'),
  ]);
  const view = createView(document.getElementById('viewport'));
  const benchModel = models.buildBench(view.scene);
  const parts = new Map(S.PART_IDS.map((id) => {
    const model = models.createPartModel(id);
    view.scene.add(model.group);
    return [id, model];
  }));
  const beam = createBeamView(view.scene);
  createInteraction({
    view,
    parts,
    canPick: (id) => F.isPartUnlocked(flow, id),
    onLocked: warnLocked,
    onDrop: (id, z) => (z === null ? renderScene() : update(S.placePart(state, id, z))),
    onRemove: (id) => update(S.removePart(state, id)),
    onSelect: (id) => {
      selectedPart = id;
      renderScene();
    },
  });
  view.start();
  return { view, benchModel, parts, beam, rackSlot: models.rackSlot };
}

function renderScene() {
  if (!scene3d) return;
  const { benchModel, parts, beam, rackSlot } = scene3d;
  benchModel.laser.update({ height: state.hidden.laserHeight, pitch: state.laser.pitch, yaw: state.laser.yaw });
  for (const id of S.PART_IDS) {
    const part = state.parts[id];
    const model = parts.get(id);
    if (part.onRail) {
      model.group.position.set(part.z, 0, 0);
    } else {
      const slot = rackSlot(id);
      model.group.position.set(slot.x, 0, slot.z);
    }
    model.update(part, {
      locked: !F.isPartUnlocked(flow, id),
      selected: selectedPart === id,
      cardImage: id === 'screen' && result.screen ? result.screen.card.image : null,
    });
  }
  beam.update(result);
}

function applyCamera(name) {
  if (!scene3d) return;
  const { sf, screen } = state.parts;
  const focus = name === 'filter' && sf.onRail ? sf.z : name === 'screen' && screen.onRail ? screen.z : undefined;
  scene3d.view.setPreset(name, focus);
}

function buildCameraButtons() {
  document.getElementById('camera-presets').replaceChildren(...CAMERAS.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.camera = name;
    button.addEventListener('click', () => applyCamera(name));
    return button;
  }));
}

// ---- close-ups ----
const insetVisible = new Set();
const insetParts = {};

function buildInsets() {
  const host = document.getElementById('insets');
  const toggles = document.createElement('div');
  toggles.className = 'inset-toggles';
  toggles.setAttribute('role', 'group');
  host.append(toggles);
  for (const id of INSET_IDS) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.inset = id;
    toggle.addEventListener('click', () => {
      if (insetVisible.has(id)) insetVisible.delete(id);
      else insetVisible.add(id);
      renderInsets();
    });
    toggles.append(toggle);
    const figure = document.createElement('figure');
    figure.className = 'inset';
    figure.hidden = true;
    figure.innerHTML = '<figcaption></figcaption><canvas width="160" height="160"></canvas>';
    host.append(figure);
    insetParts[id] = { figure, toggle, canvas: figure.querySelector('canvas'), caption: figure.querySelector('figcaption') };
  }
}

function faceBeam(face) {
  return face ? { dx: face.dx, dy: face.dy, radius: face.radius } : null;
}

function renderInsets() {
  const noLight = t('inset.noLight');
  document.querySelector('.inset-toggles').setAttribute('aria-label', t('ui.insets'));
  for (const id of INSET_IDS) {
    const { figure, toggle, canvas, caption } = insetParts[id];
    const visible = insetVisible.has(id);
    toggle.textContent = t(`inset.${id}`);
    toggle.setAttribute('aria-pressed', String(visible));
    caption.textContent = t(`inset.${id}`);
    figure.hidden = !visible;
    if (!visible) continue;
    if (id === 'a1' || id === 'a2') {
      drawApertureInset(canvas, { r: state.parts[id].opening / 2, outer: I.plateRadius, beam: faceBeam(result.irisFaces[id]) });
    } else if (id === 'ring') {
      drawApertureInset(canvas, { r: CONFIG.mount.ringRadius, outer: 0.012, beam: faceBeam(result.irisFaces.ring) });
    } else if (id === 'planeA') {
      drawPlaneAInset(canvas, result.planeA, noLight);
    } else {
      const mark = state.parts.screen.mark;
      drawScreenInset(canvas, result.screen, mark ? { x: mark.x, y: CONFIG.screen.centreHeight + mark.y } : null, noLight);
    }
  }
}

// ---- controls ----
const widgets = new Map();

function controlEnabled(id) {
  const { parts } = state;
  const sf = parts.sf;
  switch (id) {
    case 'sf.objective': return sf.onRail && !sf.objective;
    case 'sf.pinhole': return sf.onRail && sf.objective && !sf.pinhole;
    case 'sf.objX':
    case 'sf.objY':
    case 'sf.focus': return sf.objective;
    case 'sf.phX':
    case 'sf.phY': return sf.pinhole;
    case 'screen.mark': return parts.screen.onRail && Boolean(result.at.screen);
    case 'a2.remove': return parts.a2.onRail;
    default: {
      const part = id.split('.')[0];
      return part in parts ? parts[part].onRail : true;
    }
  }
}

function positionGroup(id) {
  const steps = Z_STEPS[id];
  const place = createButton({
    label: partLabel(id, 'ui.place'),
    onClick: () => {
      if (!F.isPartUnlocked(flow, id)) {
        warnLocked(id);
        return;
      }
      const z = S.nearestFreeZ(state, id, PLACE_DEFAULTS[id]);
      if (z !== null) update(S.placePart(state, id, z));
    },
  });
  const position = createPositionControl({
    label: partLabel(id, 'control.z'),
    value: state.parts[id].z,
    fine: steps.zFine,
    coarse: steps.zCoarse,
    labels: modeLabels,
    onChange: (z) => update(S.placePart(state, id, z)),
  });
  const remove = createButton({ label: partLabel(id, 'ui.remove'), onClick: () => update(S.removePart(state, id)) });
  place.el.dataset.control = `${id}.place`;
  position.el.dataset.control = `${id}.z`;
  remove.el.dataset.control = `${id}.unplace`;
  widgets.set(`${id}.z`, { kind: 'position', id, place, position, remove });
  return [place.el, position.el, remove.el];
}

const BUTTONS = {
  'laser.power': {
    label: () => `${t('control.laser.power')}: ${state.laser.on ? t('ui.on') : t('ui.off')}`,
    onClick: () => update(S.setLaserOn(state, !state.laser.on)),
  },
  'sf.objective': {
    label: () => (state.parts.sf.objective ? t('control.installed') : t('control.sf.objective')),
    onClick: () => update(S.installObjective(state, result.at.ring ?? { x: 0, y: state.parts.sf.height })),
  },
  'sf.pinhole': {
    label: () => (state.parts.sf.pinhole ? t('control.installed') : t('control.sf.pinhole')),
    onClick: () => {
      if (result.at.objective) update(S.installPinhole(state, result.at.objective.focusCentre));
    },
  },
  'screen.mark': {
    label: () => t('control.screen.mark'),
    onClick: () => {
      if (result.at.screen) update(S.markScreen(state, result.at.screen));
    },
  },
  'a2.remove': { label: partLabel('a2', 'ui.remove'), onClick: () => update(S.removePart(state, 'a2')) },
};

function makeControl(id) {
  if (KNOBS[id]) {
    const def = KNOBS[id];
    const widget = createKnob({ ...def, value: S.getValue(state, def.path), labels: modeLabels, onChange: (v) => update(S.setValue(state, def.path, v)) });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (SLIDERS[id]) {
    const def = SLIDERS[id];
    const widget = createSlider({
      label: def.label, unit: 'mm', value: S.getValue(state, def.path), min: I.openingMin, max: I.openingMax,
      step: I.openingStep, format: fixed(1, 1e3), onChange: (v) => update(S.setValue(state, def.path, v)),
    });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (id.endsWith('.z')) return positionGroup(id.split('.')[0]);
  const widget = createButton(BUTTONS[id]);
  widget.el.dataset.control = id;
  widgets.set(id, { kind: 'button', widget });
  return [widget.el];
}

function buildControls() {
  widgets.clear();
  const { current, earlier } = F.unlockedControls(flow);
  panel.currentControls.replaceChildren(...current.flatMap(makeControl));
  panel.earlierControls.replaceChildren(...earlier.flatMap(makeControl));
  panel.setMoreVisible(earlier.length > 0);
  refreshControls();
}

function refreshControls() {
  for (const [id, entry] of widgets) {
    if (entry.kind === 'value') {
      entry.widget.setValue(S.getValue(state, entry.path));
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
    } else if (entry.kind === 'position') {
      const part = state.parts[entry.id];
      entry.place.el.hidden = part.onRail;
      entry.position.el.hidden = !part.onRail;
      entry.remove.el.hidden = !part.onRail;
      entry.position.setValue(part.z);
      entry.place.refresh();
      entry.remove.refresh();
    } else {
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
    }
  }
}

// ---- panel ----
function readouts() {
  const none = t('readout.none');
  const d = result.divergence;
  return [
    { label: t('readout.power'), value: result.laserOn ? `${(result.powerAtScreen * 100).toFixed(1)} %` : none },
    { label: t('readout.pinhole'), value: result.pinhole ? `${(result.pinhole.transmission * 100).toFixed(1)} %` : none },
    { label: t('readout.diameter'), value: result.screen ? `${(result.screen.d4sigma * 1e3).toFixed(1)} mm` : none },
    { label: t('readout.divergence'), value: d ? `${(d.theta * 1e3).toFixed(2)} mrad · ${t(`readout.${d.state}`)}` : none },
  ];
}

function summaryLines() {
  const predicted = (CONFIG.lens.focalLength / O.focalLength) * 2 * L.waistRadius;
  const elapsed = (performance.now() - startedAt) / 1000;
  return [
    t('step.done.measured', {
      measured: result.screen ? (result.screen.d4sigma * 1e3).toFixed(1) : t('readout.none'),
      predicted: (predicted * 1e3).toFixed(1),
    }),
    t('step.done.time', { minutes: Math.floor(elapsed / 60), seconds: Math.floor(elapsed % 60) }),
    t('step.done.warnings', { count: flow.warningsShown }),
  ];
}

function renderPanel() {
  const step = F.currentStep(flow);
  panel.renderStep({
    stepId: step.id,
    checks: F.evaluateChecks(flow, state, result),
    hintsShown: flow.hintsShown,
    hintCount: step.hints,
    questions: step.questions,
    canAdvance: F.canAdvance(flow, state, result),
    isLast: step.id === 'done',
    summary: step.id === 'done' ? summaryLines() : null,
  });
  panel.renderReadouts(readouts());
}

function renderProgress() {
  document.querySelector('.progress').replaceChildren(...F.STEPS.map((step, index) => {
    const li = document.createElement('li');
    li.textContent = step.id === 'start' ? t('progress.start') : step.id === 'done' ? t('progress.done') : F.STEP_LABELS[step.id];
    li.className = index < flow.index ? 'done' : index === flow.index ? 'current' : '';
    if (index === flow.index) li.setAttribute('aria-current', 'step');
    return li;
  }));
}

function renderStatic() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = `EO LAB · ${t('app.exp1Short')}`;
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.textContent = t(`ui.camera.${button.dataset.camera}`);
  });
  panel.renderLabels();
}

function render() {
  const t0 = performance.now();
  renderScene();
  renderInsets();
  renderPanel();
  refreshControls();
  renderProgress();
  debug.lastRenderMs = performance.now() - t0;
}

function enterStep() {
  const step = F.currentStep(flow);
  insetVisible.clear();
  step.insets.forEach((id) => insetVisible.add(id));
  buildControls();
  applyCamera(step.camera);
  render();
}

// ---- boot ----
document.querySelector('.lang-btn').addEventListener('click', () => setLanguage(getLanguage() === 'zh-TW' ? 'en' : 'zh-TW'));
document.querySelector('.restart-btn').addEventListener('click', restart);
onLanguageChange(() => {
  panel.invalidate();
  renderStatic();
  render();
});
buildInsets();
buildCameraButtons();
if (webglAvailable()) {
  try {
    scene3d = await createScene3d();
  } catch (error) {
    debug.errors.push(`3D view failed: ${error.message}`);
    document.querySelector('.nowebgl').hidden = false;
  }
} else {
  document.querySelector('.nowebgl').hidden = false;
}
renderStatic();
enterStep();
Object.assign(debug, { ready: true, t, seed, getState: () => state, getFlow: () => flow, getResult: () => result });
