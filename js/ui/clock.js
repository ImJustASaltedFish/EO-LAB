// The running mm:ss clock in the top bar: starts on page load, stops at Done.
export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createClock(now = () => performance.now()) {
  const start = now();
  let stoppedAt = null;
  return {
    seconds: () => ((stoppedAt ?? now()) - start) / 1000,
    stop() {
      if (stoppedAt === null) stoppedAt = now();
    },
  };
}
