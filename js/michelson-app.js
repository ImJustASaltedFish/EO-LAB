// Michelson page (michelson.html): input → state → michelsonBench() → 3D table, close-ups, panel and step checks.
import { MI } from './michelson/config.js';
import { randomSeed } from './optics/rng.js';
import { brightPixel } from './optics/screen.js';
import { michelsonBench } from './michelson/bench.js';
import * as S from './michelson/state.js';
import * as F from './michelson/steps.js';
import { tipFor } from './michelson/tips.js';
import { t, getLanguage, setLanguage, onLanguageChange, applyTranslations } from './i18n/index.js';
import { createPanel } from './ui/panel.js';
import { createKnob, createSlider, createButton } from './ui/controls.js';
import { drawApertureInset, drawScreenInset } from './ui/insets.js';
import { showToast } from './ui/toast.js';
import { createClock, formatClock } from './ui/clock.js';
import { webglAvailable } from './scene/webgl.js';

const modeLabels = { fine: () => t('ui.fine'), coarse: () => t('ui.coarse') };
const partLabel = (id, key) => () => `${t(`part.${id}`)} · ${t(key)}`;
const mrad = (v) => (v * 1e3).toFixed(2);

function mirrorKnob(id, axis) {
  const M = MI.mirror;
  return { path: `parts.${id}.${axis}`, label: partLabel(id, `control.mi.${axis}`), unit: 'mrad', format: mrad, min: -M.tiltRange, max: M.tiltRange, fine: M.tiltFine, coarse: M.tiltCoarse };
}

const KNOBS = {
  'bs.rotation': { path: 'parts.bs.rotation', label: partLabel('bs', 'control.mi.rotation'), unit: 'mrad', format: mrad, min: -MI.bs.rotationRange, max: MI.bs.rotationRange, fine: MI.bs.rotationFine, coarse: MI.bs.rotationCoarse },
  'bs.tilt': { path: 'parts.bs.tilt', label: partLabel('bs', 'control.mi.tilt'), unit: 'mrad', format: mrad, min: -MI.bs.tiltRange, max: MI.bs.tiltRange, fine: MI.bs.tiltFine, coarse: MI.bs.tiltCoarse },
  'm1.h': mirrorKnob('m1', 'h'),
  'm1.v': mirrorKnob('m1', 'v'),
  'm2.h': mirrorKnob('m2', 'h'),
  'm2.v': mirrorKnob('m2', 'v'),
  'm1.stage': { path: 'parts.m1.stage', label: partLabel('m1', 'control.mi.stage'), unit: 'mm', format: (v) => (v * 1e3).toFixed(5), min: 0, max: MI.stage.travel, fine: MI.stage.fine, coarse: MI.stage.coarse },
};
const INSET_IDS = ['iris', 'screen'];
const CAMERAS = ['overview', 'source', 'bs', 'screen'];
const CARD_TARGET = { x: 0, y: MI.beamHeight };   // the target paper sits on the card centre, at beam height
// Camera presets in world coordinates (X = table z, Y = height, Z = table x); 'screen' follows the card.
const PRESETS = {
  overview: {
    position: [0.25, 1.05, 1.0], target: [0.2, 0.05, 0], halfWidth: 0.75,
    portrait: { position: [-0.55, 0.8, 0.55], target: [0.25, 0.05, 0], halfWidth: 0 },
  },
  source: { position: [0.15, 0.3, 0.35], target: [-0.08, 0.1, 0], halfWidth: 0.18 },
  bs: { position: [0.5, 0.35, 0.4], target: [0.3, 0.1, 0], halfWidth: 0.2 },
  screen: { position: [0.42, 0.28, 0.2], target: [0.3, 0.1, -0.25], halfWidth: 0.12 },
};

// ---- state ----
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed();
let state = S.createMichelsonState(seed);
let flow = F.createFlow();
let result = michelsonBench(state);
let selectedPart = null;
let scene3d = null;
let tap = null;   // { start, offset } while the table is shaking
const clock = createClock();
const debug = window.eolab ?? (window.eolab = { errors: [] });

const panel = createPanel(document.getElementById('panel'), {
  t,
  onNext: () => {
    if (!F.canAdvance(flow, state, result)) return;
    flow = F.advance(flow, state, performance.now());
    enterStep();
  },
  onHint: () => {
    const guideBefore = F.guideAvailable(flow);
    flow = F.revealHint(flow, currentTip() !== null);
    if (F.guideAvailable(flow) !== guideBefore) buildControls();
    render();
  },
  onRestart: restart,
});

function restart() {
  if (window.confirm(t('ui.restartConfirm'))) location.search = `?seed=${randomSeed()}`;
}

const currentTip = () => tipFor(F.currentStep(flow).id, state, result, flow);

function update(next) {
  if (next !== state) {
    const prev = state;
    state = next;
    const t0 = performance.now();
    result = michelsonBench(state);
    debug.lastBenchMs = performance.now() - t0;
    const detected = F.detectWarnings(flow, prev, state, result);
    flow = F.observe(detected.flow, result);
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
  const [{ createView }, models, { createBeamView }, { createTableInteraction }] = await Promise.all([
    import('./scene/view.js'),
    import('./scene/michelson-models.js'),
    import('./scene/beam.js'),
    import('./scene/table.js'),
  ]);
  const view = createView(document.getElementById('viewport'), { presets: PRESETS });
  const table = models.buildMichelsonTable(view.scene);
  const parts = new Map(S.PART_IDS.map((id) => {
    const model = models.createMichelsonPart(id);
    view.scene.add(model.group);
    return [id, model];
  }));
  const ghosts = new Map(S.PART_IDS.map((id) => {
    const ghost = models.createGhost(id);
    view.scene.add(ghost);
    return [id, ghost];
  }));
  const beam = createBeamView(view.scene);
  createTableInteraction({
    view,
    parts,
    canPick: (id) => F.isPartUnlocked(flow, id),
    onLocked: warnLocked,
    preview: (id, pos) => {
      const { heading } = state.parts[id];
      const snapped = S.snapPosition(id, heading, pos);
      return S.canStand(state, id, snapped, heading) ? snapped : null;
    },
    onDrop: (id, pos) => (pos === null ? renderScene() : update(S.placePart(state, id, pos))),
    onRemove: (id) => update(S.removePart(state, id)),
    onSelect: (id) => {
      selectedPart = id;
      renderScene();
    },
    onTurn: (id, steps) => update(S.turnPart(state, id, steps)),
  });
  view.start();
  return { view, table, parts, ghosts, beam, models };
}

function renderScene() {
  if (!scene3d) return;
  const { table, parts, ghosts, beam, models } = scene3d;
  table.setIris(state.iris.opening);
  for (const id of S.PART_IDS) {
    const part = state.parts[id];
    const model = parts.get(id);
    if (part.placed) {
      model.group.position.set(part.pos.z, 0, part.pos.x);
      model.group.rotation.y = models.yawFor(part.heading);
    } else {
      const slot = models.rackSlot(id);
      model.group.position.set(slot.x, 0, slot.z);
      model.group.rotation.y = 0;
    }
    model.update(part, {
      locked: !F.isPartUnlocked(flow, id),
      selected: selectedPart === id,
      cardImage: id === 'screen' && result.screen?.card ? result.screen.card.image : null,
      target: CARD_TARGET,
    });
  }
  const stepId = F.currentStep(flow).id;
  for (const [id, ghost] of ghosts) {
    const guide = F.guideFor(id, stepId);
    ghost.visible = flow.guideOn && (S.KINDS[id] !== 'lens' || stepId === 'mi4');
    ghost.position.set(guide.pos.z, 0, guide.pos.x);
    ghost.rotation.y = models.yawFor(guide.heading);
  }
  beam.update(result);
}

function applyCamera(name) {
  if (!scene3d) return;
  const id = name === 'bs' || name === 'screen' ? name : null;
  const part = id ? state.parts[id] : null;
  if (part?.placed && id === 'screen') {
    // Look at the card from the side it faces, from above and off to one side (clear of the arm behind the camera).
    const h = S.headingVector(part.heading);
    const side = { x: h.z, z: -h.x };
    PRESETS.screen.target = [part.pos.z, MI.beamHeight, part.pos.x];
    PRESETS.screen.position = [part.pos.z + 0.3 * h.z + 0.18 * side.z, 0.32, part.pos.x + 0.3 * h.x + 0.18 * side.x];
  }
  scene3d.view.setPreset(name, part?.placed ? { x: part.pos.z, y: MI.beamHeight, z: part.pos.x } : undefined);
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

function renderInsets() {
  document.querySelector('.inset-toggles').setAttribute('aria-label', t('ui.insets'));
  for (const id of INSET_IDS) {
    const { figure, toggle, canvas, caption } = insetParts[id];
    const visible = insetVisible.has(id);
    toggle.textContent = t(`inset.${id}`);
    toggle.setAttribute('aria-pressed', String(visible));
    caption.textContent = t(`inset.${id}`);
    figure.hidden = !visible;
    if (!visible) continue;
    if (id === 'iris') {
      const beams = result.iris.spots.map((s) => ({ dx: s.dx, dy: s.dy, radius: s.radius, label: s.label }));
      // The whole source face counts as plate here, so a spot that misses the iris itself still shows.
      drawApertureInset(canvas, { r: state.iris.opening / 2, outer: MI.source.stopHalf, beams });
    } else {
      drawScreenInset(canvas, result.screen?.window ? result.screen : null, { target: CARD_TARGET, noLightText: t('inset.noLight'), pixel: brightPixel });
    }
  }
}

// ---- controls ----
const widgets = new Map();

function controlEnabled(id) {
  const { parts } = state;
  switch (id) {
    case 'bs.rotation':
    case 'bs.tilt': return parts.bs.placed;
    case 'tap': return Boolean(result.screen);
    default: {
      const part = id.split('.')[0];
      return part in parts ? parts[part].placed : true;
    }
  }
}

// Move steps for the panel buttons: one hole, or 1 mm along a lens's own row.
function moveSteps(id) {
  const { heading } = state.parts[id];
  if (S.KINDS[id] !== 'lens' || heading % 2 === 1) return { dz: MI.table.pitch, dx: MI.table.pitch };
  return heading % 4 === 0 ? { dz: MI.lens.slide, dx: MI.table.pitch } : { dz: MI.table.pitch, dx: MI.lens.slide };
}

function placeFromPanel(id) {
  if (!F.isPartUnlocked(flow, id)) {
    warnLocked(id);
    return;
  }
  const guide = F.guideFor(id, F.currentStep(flow).id);
  update(S.placeNear(state, id, guide.pos, guide.heading));
}

function placementGroup(id) {
  const box = document.createElement('div');
  box.className = 'control place-group';
  box.dataset.control = `${id}.place`;
  const label = document.createElement('div');
  label.className = 'control-label';
  const row = document.createElement('div');
  row.className = 'place-row';
  const button = (key, control, onClick) => {
    const widget = createButton({ label: () => t(key), onClick });
    widget.el.dataset.control = `${id}.${control}`;
    return widget;
  };
  const add = button('control.mi.place', 'add', () => placeFromPanel(id));
  const moves = [
    button('control.mi.towardLaser', 'towardLaser', () => update(S.movePartBy(state, id, -moveSteps(id).dz, 0))),
    button('control.mi.awayLaser', 'awayLaser', () => update(S.movePartBy(state, id, moveSteps(id).dz, 0))),
    button('control.mi.back', 'back', () => update(S.movePartBy(state, id, 0, -moveSteps(id).dx))),
    button('control.mi.front', 'front', () => update(S.movePartBy(state, id, 0, moveSteps(id).dx))),
    button('control.mi.turnLeft', 'turnLeft', () => update(S.turnPart(state, id, -1))),
    button('control.mi.turnRight', 'turnRight', () => update(S.turnPart(state, id, 1))),
    button('ui.remove', 'remove', () => update(S.removePart(state, id))),
  ];
  row.append(add.el, ...moves.map((m) => m.el));
  box.append(label, row);
  widgets.set(`${id}.place`, { kind: 'place', id, label, add, moves });
  return [box];
}

const BUTTONS = {
  'laser.power': {
    label: () => `${t('control.laser.power')}: ${state.laser.on ? t('ui.on') : t('ui.off')}`,
    onClick: () => update(S.setLaserOn(state, !state.laser.on)),
  },
  tap: { label: () => t('control.mi.tap'), onClick: () => startTap() },
  guide: {
    label: () => t('control.mi.guide'),
    onClick: () => {
      flow = F.toggleGuide(flow);
      render();
    },
  },
};

function makeControl(id) {
  if (KNOBS[id]) {
    const def = KNOBS[id];
    const widget = createKnob({ ...def, value: S.getValue(state, def.path), labels: modeLabels, onChange: (v) => update(S.setValue(state, def.path, v)) });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: def.path });
    return [widget.el];
  }
  if (id === 'iris.opening') {
    const I = MI.iris;
    const widget = createSlider({
      label: () => `${t('part.source')} · ${t('control.mi.iris')}`, unit: 'mm', value: state.iris.opening, min: I.openingMin, max: I.openingMax,
      step: I.step, format: (v) => (v * 1e3).toFixed(1), onChange: (v) => update(S.setValue(state, 'iris.opening', v)),
    });
    widget.el.dataset.control = id;
    widgets.set(id, { kind: 'value', widget, path: 'iris.opening' });
    return [widget.el];
  }
  if (id.endsWith('.place')) return placementGroup(id.split('.')[0]);
  const widget = createButton(BUTTONS[id]);
  widget.el.dataset.control = id;
  widgets.set(id, { kind: 'button', widget });
  return [widget.el];
}

function buildControls() {
  widgets.clear();
  const { current, earlier } = F.unlockedControls(flow);
  const shown = F.guideAvailable(flow) ? [...current, 'guide'] : current;
  panel.currentControls.replaceChildren(...shown.flatMap(makeControl));
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
    } else if (entry.kind === 'place') {
      const part = state.parts[entry.id];
      const where = part.placed ? ` · ${t('control.mi.position')}: z ${(part.pos.z * 1e3).toFixed(0)} mm, x ${(part.pos.x * 1e3).toFixed(0)} mm` : '';
      entry.label.textContent = `${t(`part.${entry.id}`)}${where}`;
      entry.add.el.hidden = part.placed;
      entry.add.refresh();
      for (const m of entry.moves) {
        m.el.hidden = !part.placed;
        m.refresh();
      }
    } else {
      entry.widget.refresh();
      entry.widget.setEnabled(controlEnabled(id));
      if (id === 'guide') entry.widget.setPressed(flow.guideOn);
    }
  }
}

// ---- tap the table (spec §4.9) ----
function tapPhase(now) {
  const s = (now - tap.start) / 1000;
  if (s > MI.tap.duration) return null;
  return MI.tap.amplitude * Math.exp(-s / MI.tap.decay) * Math.sin(2 * Math.PI * MI.tap.frequency * s + tap.offset);
}

function tapFrame(now) {
  if (!tap) return;
  const phase = tapPhase(now);
  result = michelsonBench(state, { tapPhase: phase ?? 0 });
  renderInsets();
  renderScene();
  if (phase === null) tap = null;
  else requestAnimationFrame(tapFrame);
}

function startTap() {
  const running = tap !== null;
  tap = { start: performance.now(), offset: Math.random() * 2 * Math.PI };
  if (!running) requestAnimationFrame(tapFrame);
}

// ---- panel ----
function readouts() {
  const none = t('readout.none');
  const f = result.fringe;
  const items = [
    { label: t('readout.power'), value: result.laserOn ? `${(result.power * 100).toFixed(1)} %` : none },
    { label: t('readout.mi.contrast'), value: f ? f.contrast.toFixed(2) : none },
    { label: t('readout.mi.spacing'), value: f && f.spacing <= MI.spacingShownMax ? `${(f.spacing * 1e3).toFixed(2)} mm` : none },
  ];
  if (state.parts.lens1.placed || state.parts.lens2.placed) {
    items.push({ label: t('readout.mi.rings'), value: f ? String(Math.floor(f.rings)) : none });
  }
  return items;
}

function summaryLines() {
  const elapsed = clock.seconds();
  return [
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
    isLast: step.id === 'miDone',
    summary: step.id === 'miDone' ? summaryLines() : null,
  });
  const tip = flow.tipOn ? currentTip() : null;
  panel.renderTip(tip ? t(tip.key, tip.params) : null);
  panel.renderReadouts(readouts());
}

function renderProgress() {
  document.querySelector('.progress').replaceChildren(...F.STEPS.map((step, index) => {
    const li = document.createElement('li');
    li.textContent = step.id === 'miStart' ? t('progress.start') : step.id === 'miDone' ? t('progress.done') : F.STEP_LABELS[step.id];
    li.className = index < flow.index ? 'done' : index === flow.index ? 'current' : '';
    if (index === flow.index) li.setAttribute('aria-current', 'step');
    return li;
  }));
}

function renderTimer() {
  document.querySelector('.timer').textContent = formatClock(clock.seconds());
}

function renderStatic() {
  applyTranslations(document);
  document.documentElement.lang = getLanguage() === 'zh-TW' ? 'zh-Hant-TW' : 'en';
  document.title = `EO LAB · ${t('mi.title')}`;
  document.querySelector('.lang-btn').textContent = t('ui.switchLanguage');
  const timer = document.querySelector('.timer');
  timer.title = t('ui.timer');
  timer.setAttribute('aria-label', t('ui.timer'));
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
  if (step.id === 'miDone') {
    clock.stop();
    renderTimer();
  }
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
renderTimer();
setInterval(renderTimer, 1000);
Object.assign(debug, { ready: true, t, seed, getState: () => state, getFlow: () => flow, getResult: () => result });
