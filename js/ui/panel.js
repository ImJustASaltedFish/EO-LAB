// Side panel: step card (title, body, checklist, hints, think cards, next), controls host and readouts (spec §3.2).
export function createPanel(root, { t, onNext, onHint, onRestart }) {
  root.innerHTML = `
    <button type="button" class="sheet-handle"></button>
    <section class="step-card" aria-live="polite">
      <h2 class="step-title"></h2>
      <p class="step-body"></p>
      <h3 class="checklist-title"></h3>
      <ul class="checklist"></ul>
      <button type="button" class="hint-btn"></button>
      <ol class="hints"></ol>
      <div class="think"></div>
      <div class="summary" hidden></div>
      <button type="button" class="summary-restart" hidden></button>
      <button type="button" class="next-btn"></button>
    </section>
    <section class="controls-card">
      <h3 class="controls-title"></h3>
      <div class="controls-current"></div>
      <details class="controls-more"><summary class="controls-more-title"></summary><div class="controls-earlier"></div></details>
    </section>
    <section class="readouts-card">
      <h3 class="readouts-title"></h3>
      <dl class="readouts"></dl>
    </section>`;
  const q = (selector) => root.querySelector(selector);
  q('.next-btn').addEventListener('click', () => onNext());
  q('.hint-btn').addEventListener('click', () => onHint());
  q('.summary-restart').addEventListener('click', () => onRestart());
  const sheetStates = ['', 'full', 'collapsed'];
  let sheet = 0;
  q('.sheet-handle').addEventListener('click', () => {
    root.classList.remove('full', 'collapsed');
    sheet = (sheet + 1) % sheetStates.length;
    if (sheetStates[sheet]) root.classList.add(sheetStates[sheet]);
  });

  let shownStep = null;
  let shownHints = -1;

  function renderLabels() {
    q('.checklist-title').textContent = t('ui.checklist');
    q('.controls-title').textContent = t('ui.controls');
    q('.controls-more-title').textContent = t('ui.moreControls');
    q('.readouts-title').textContent = t('ui.readouts');
    q('.sheet-handle').textContent = t('ui.sheet');
    q('.summary-restart').textContent = t('step.done.restart');
  }

  function renderStep({ stepId, checks, hintsShown, hintCount, questions, canAdvance, isLast, summary = null }) {
    renderLabels();
    q('.step-title').textContent = t(`step.${stepId}.title`);
    q('.step-body').textContent = t(`step.${stepId}.body`);
    q('.checklist-title').hidden = checks.length === 0;
    q('.checklist').replaceChildren(...checks.map((c) => {
      const li = document.createElement('li');
      li.className = c.pass ? 'pass' : 'fail';
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = c.pass ? '✓' : '✗';
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = t(`step.${stepId}.check.${c.id}`);
      li.append(mark, text);
      return li;
    }));
    if (shownStep !== stepId) {
      shownStep = stepId;
      shownHints = -1;
      q('.think').replaceChildren(...questions.map((id) => {
        const details = document.createElement('details');
        const summaryEl = document.createElement('summary');
        summaryEl.textContent = t('ui.think');
        const p = document.createElement('p');
        p.textContent = t(`question.${id}`);
        details.append(summaryEl, p);
        return details;
      }));
    }
    if (shownHints !== hintsShown) {
      shownHints = hintsShown;
      q('.hints').replaceChildren(...Array.from({ length: hintsShown }, (_, i) => {
        const li = document.createElement('li');
        li.textContent = t(`step.${stepId}.hint.${i + 1}`);
        return li;
      }));
    }
    const hintButton = q('.hint-btn');
    hintButton.hidden = hintCount === 0;
    hintButton.disabled = hintsShown >= hintCount;
    hintButton.textContent = hintsShown >= hintCount ? t('ui.noMoreHints') : t('ui.hint');
    const next = q('.next-btn');
    next.textContent = t('ui.next');
    next.disabled = !canAdvance;
    next.hidden = isLast;
    const summaryBox = q('.summary');
    summaryBox.hidden = !summary;
    q('.summary-restart').hidden = !summary;
    if (summary) {
      summaryBox.replaceChildren(...summary.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }));
    }
  }

  return {
    currentControls: q('.controls-current'),
    earlierControls: q('.controls-earlier'),
    renderLabels,
    renderStep,
    invalidate() {
      shownStep = null;
      shownHints = -1;
    },
    setMoreVisible(visible) {
      q('.controls-more').hidden = !visible;
    },
    renderReadouts(items) {
      q('.readouts').replaceChildren(...items.flatMap(({ label, value }) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }));
    },
  };
}
