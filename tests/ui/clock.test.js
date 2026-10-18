import { test, assertEqual } from '../harness.js';
import { formatClock, createClock } from '../../js/ui/clock.js';

test('clock: shows mm:ss from page load and freezes when stopped', () => {
  assertEqual(formatClock(0), '00:00');
  assertEqual(formatClock(65.9), '01:05');
  assertEqual(formatClock(3600), '60:00');
  let now = 1000;
  const clock = createClock(() => now);
  now += 61500;
  assertEqual(formatClock(clock.seconds()), '01:01');
  clock.stop();
  now += 30000;
  assertEqual(formatClock(clock.seconds()), '01:01', 'frozen after stop');
  clock.stop();
  assertEqual(formatClock(clock.seconds()), '01:01', 'a second stop keeps the first time');
});
