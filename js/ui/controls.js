// Panel controls: knob dials, sliders, buttons and rail-position inputs (spec §3.4). No physics here.
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 70;

const textOf = (label) => (typeof label === 'function' ? label() : label);

// Press-and-hold repeats `action`; Enter/Space trigger it once from the keyboard (unless `keyboard` is false).
function holdRepeat(button, action, { keyboard = true } = {}) {
  let timer = null;
  let interval = null;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(interval);
    timer = null;
    interval = null;
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    stop();
    action();
    timer = setTimeout(() => {
      interval = setInterval(action, REPEAT_INTERVAL);
    }, REPEAT_DELAY);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
  if (!keyboard) return;
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
}

export function createKnob({ label, unit = '', value, min, max, fine, coarse, format = (v) => String(v), onChange, labels }) {
  let current = value;
  let useCoarse = false;
  let enabled = true;
  const el = document.createElement('div');
  el.className = 'control knob';
  el.innerHTML = `
    <div class="control-label"></div>
    <div class="knob-row">
      <button type="button" class="step minus" aria-label="−">−</button>
      <div class="dial" tabindex="0" role="slider">
        <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"></circle><line x1="20" y1="20" x2="20" y2="6"></line></svg>
      </div>
      <button type="button" class="step plus" aria-label="+">+</button>
      <button type="button" class="mode"></button>
    </div>
    <div class="control-value"></div>`;
  const labelEl = el.querySelector('.control-label');
  const valueEl = el.querySelector('.control-value');
  const dial = el.querySelector('.dial');
  const line = el.querySelector('line');
  const mode = el.querySelector('.mode');

  function render() {
    const text = textOf(label);
    labelEl.textContent = text;
    valueEl.textContent = `${format(current)} ${unit}`.trim();
    line.setAttribute('transform', `rotate(${((current - min) / (max - min)) * 300 - 150} 20 20)`);
    dial.setAttribute('aria-label', text);
    dial.setAttribute('aria-valuemin', String(min));
    dial.setAttribute('aria-valuemax', String(max));
    dial.setAttribute('aria-valuenow', String(current));
    dial.setAttribute('aria-valuetext', valueEl.textContent);
    mode.textContent = useCoarse ? labels.coarse() : labels.fine();
  }
  function set(v) {
    const next = Math.min(max, Math.max(min, v));
    if (next === current) return;
    current = next;
    render();
    onChange(current);
  }
  const step = (n) => {
    if (enabled) set(current + n * (useCoarse ? coarse : fine));
  };

  holdRepeat(el.querySelector('.plus'), () => step(1));
  holdRepeat(el.querySelector('.minus'), () => step(-1));
  mode.addEventListener('click', () => {
    useCoarse = !useCoarse;
    render();
  });
  let dragY = null;
  let accumulated = 0;
  dial.addEventListener('pointerdown', (event) => {
    if (!enabled) return;
    dragY = event.clientY;
    accumulated = 0;
    dial.setPointerCapture(event.pointerId);
  });
  dial.addEventListener('pointermove', (event) => {
    if (dragY === null) return;
    accumulated += dragY - event.clientY;
    dragY = event.clientY;
    const steps = Math.trunc(accumulated / 4);
    if (steps !== 0) {
      accumulated -= steps * 4;
      step(steps);
    }
  });
  const endDrag = () => {
    dragY = null;
  };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  dial.addEventListener('keydown', (event) => {
    if (!enabled) return;
    const amount = event.shiftKey ? coarse : fine;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      set(current + amount);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      set(current - amount);
    }
  });
  render();
  return {
    el,
    setValue(v) {
      current = Math.min(max, Math.max(min, v));
      render();
    },
    setEnabled(on) {
      enabled = Boolean(on);
      el.classList.toggle('disabled', !enabled);
      el.querySelectorAll('button').forEach((b) => {
        b.disabled = !enabled;
      });
      dial.tabIndex = enabled ? 0 : -1;
    },
    refresh: render,
  };
}

export function createSlider({ label, unit = '', value, min, max, step, format = (v) => String(v), onChange }) {
  const el = document.createElement('label');
  el.className = 'control slider';
  el.innerHTML = '<span class="control-label"></span><input type="range"><span class="control-value"></span>';
  const input = el.querySelector('input');
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  function render() {
    const text = textOf(label);
    el.querySelector('.control-label').textContent = text;
    input.setAttribute('aria-label', text);
    el.querySelector('.control-value').textContent = `${format(Number(input.value))} ${unit}`.trim();
  }
  input.addEventListener('input', () => {
    render();
    onChange(Number(input.value));
  });
  render();
  return {
    el,
    setValue(v) {
      input.value = String(v);
      render();
    },
    setEnabled(on) {
      input.disabled = !on;
      el.classList.toggle('disabled', !on);
    },
    refresh: render,
  };
}

// `repeat`: pressing and holding repeats onClick; a click that no press started (the keyboard, or click() from a
// script) acts once.
export function createButton({ label, onClick, className = '', repeat = false }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `control button ${className}`.trim();
  const render = () => {
    el.textContent = textOf(label);
  };
  if (repeat) {
    holdRepeat(el, onClick, { keyboard: false });
    el.addEventListener('click', (event) => {
      if (event.detail === 0) onClick();
    });
  } else {
    el.addEventListener('click', () => onClick());
  }
  render();
  return {
    el,
    setEnabled(on) {
      el.disabled = !on;
    },
    setPressed(on) {
      el.setAttribute('aria-pressed', String(Boolean(on)));
      el.classList.toggle('pressed', Boolean(on));
    },
    refresh: render,
  };
}

export function createPositionControl({ label, value, fine, coarse, onChange, labels }) {
  let current = value;
  let useCoarse = false;
  const decimals = fine < 1e-3 ? 1 : 0;
  const el = document.createElement('div');
  el.className = 'control position';
  el.innerHTML = `
    <div class="control-label"></div>
    <div class="position-row">
      <button type="button" class="step minus" aria-label="−">−</button>
      <input type="number" class="position-input" inputmode="decimal">
      <span class="unit">mm</span>
      <button type="button" class="step plus" aria-label="+">+</button>
      <button type="button" class="mode"></button>
    </div>`;
  const input = el.querySelector('input');
  const mode = el.querySelector('.mode');
  input.step = decimals ? '0.5' : '1';
  function render() {
    const text = textOf(label);
    el.querySelector('.control-label').textContent = text;
    input.setAttribute('aria-label', text);
    if (document.activeElement !== input) input.value = (current * 1e3).toFixed(decimals);
    mode.textContent = useCoarse ? labels.coarse() : labels.fine();
  }
  holdRepeat(el.querySelector('.plus'), () => onChange(current + (useCoarse ? coarse : fine)));
  holdRepeat(el.querySelector('.minus'), () => onChange(current - (useCoarse ? coarse : fine)));
  mode.addEventListener('click', () => {
    useCoarse = !useCoarse;
    render();
  });
  input.addEventListener('change', () => {
    const mm = Number(input.value);
    if (Number.isFinite(mm)) onChange(mm / 1e3);
  });
  render();
  return {
    el,
    setValue(v) {
      current = v;
      render();
    },
    setEnabled(on) {
      el.querySelectorAll('button, input').forEach((node) => {
        node.disabled = !on;
      });
    },
    refresh: render,
  };
}
