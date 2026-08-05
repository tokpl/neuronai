/**
 * Shared transaction pattern for orders + payments.
 * Real code would open a DB transaction; demo uses a serial async lock.
 */
let locked = Promise.resolve();

export async function withTransaction(fn) {
  const run = locked.then(fn, fn);
  locked = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
