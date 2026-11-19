import { singleFlight } from '@/lib/singleFlight';

/** A fn whose runs finish only when the test says so, recording when each began. */
function controlled() {
  const starts: number[] = [];
  const gates: (() => void)[] = [];
  let clock = 0;
  const fn = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        starts.push(clock++);
        gates.push(resolve);
      }),
  );
  return { fn, starts, release: (i: number) => gates[i]() };
}
const tick = () => new Promise((r) => setImmediate(r));

it('a lone call runs once', async () => {
  const { fn, release } = controlled();
  const call = singleFlight(fn);
  const p = call();
  release(0);
  await p;
  expect(fn).toHaveBeenCalledTimes(1);
});

it('calls during a run cost exactly one more run, and share its promise', async () => {
  const { fn, release } = controlled();
  const call = singleFlight(fn);
  const first = call();
  const second = call();
  const third = call();
  expect(second).toBe(first);
  expect(third).toBe(first);
  expect(fn).toHaveBeenCalledTimes(1); // never in parallel
  release(0);
  await tick();
  expect(fn).toHaveBeenCalledTimes(2); // the one follow-up pass
  release(1);
  await first;
  expect(fn).toHaveBeenCalledTimes(2);
});

it('a caller always gets a pass that started after its call', async () => {
  const { fn, release } = controlled();
  const call = singleFlight(fn);
  const first = call();
  await tick();
  const lateCall = call(); // arrives mid-run
  release(0); // the run it overlapped ends, but it asked for another
  await tick();
  expect(fn).toHaveBeenCalledTimes(2);
  let done = false;
  void lateCall.then(() => (done = true));
  await tick();
  expect(done).toBe(false); // not resolved by the stale pass
  release(1);
  await lateCall;
  expect(done).toBe(true);
  await first;
});

it('after it settles, the next call starts fresh; a failure reaches the callers and does not wedge it', async () => {
  let fail = true;
  const fn = jest.fn(async () => {
    if (fail) throw new Error('boom');
  });
  const call = singleFlight(fn);
  await expect(call()).rejects.toThrow('boom');
  fail = false;
  await expect(call()).resolves.toBeUndefined();
  expect(fn).toHaveBeenCalledTimes(2);
});
