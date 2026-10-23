/** Execute a batch in the caller's order. Whenever the guard reports a reason for an operation, that
 * operation is represented by a skipped result instead of running
 * speculatively. */
export async function executeGuardedBatch<T, R>(
  items: readonly T[],
  options: {
    execute: (item: T) => Promise<R>
    blocked: (item: T) => string | undefined
    skipped: (item: T, reason: string) => R
  },
): Promise<R[]> {
  const results: R[] = []
  for (const item of items) {
    const reason = options.blocked(item)
    results.push(reason ? options.skipped(item, reason) : await options.execute(item))
  }
  return results
}
