import { test, assertEqual, assertClose } from './harness.js';

test('smoke: harness runs', () => {
  assertEqual(1 + 1, 2);
  assertClose(0.1 + 0.2, 0.3, 1e-12);
});
