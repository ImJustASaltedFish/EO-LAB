// Tiny test harness: register with test(), run with run(); results go to <pre id="results">.
const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

function fmt(value) {
  return typeof value === 'number' ? String(Number(value.toPrecision(10))) : JSON.stringify(value);
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${fmt(expected)}, got ${fmt(actual)}`);
}

export function assertClose(actual, expected, tolerance, message = 'not close') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message}: expected ${fmt(expected)} ± ${fmt(tolerance)}, got ${fmt(actual)}`);
  }
}

export function assertRelClose(actual, expected, relTolerance, message = 'not close') {
  assertClose(actual, expected, Math.abs(expected) * relTolerance, message);
}

export function assertThrows(fn, message = 'expected an exception') {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

const lines = [];
function emit(line) {
  lines.push(line);
  console.log(line);
  const out = document.getElementById('results');
  if (out) out.textContent = lines.join('\n');
}

let fatal = 0;
export function reportFatal(error) {
  fatal += 1;
  emit(`FAIL (load error) ${error && error.message ? error.message : error}`);
}

export async function run({ filter = '' } = {}) {
  let passed = 0;
  let failed = fatal;
  for (const { name, fn } of registry) {
    if (filter && !name.includes(filter)) continue;
    try {
      await fn();
      passed += 1;
      emit(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      emit(`FAIL ${name} — ${error && error.message ? error.message : error}`);
    }
  }
  emit(`SUMMARY passed=${passed} failed=${failed}`);
  return { passed, failed };
}
