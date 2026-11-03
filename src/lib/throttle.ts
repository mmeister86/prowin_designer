export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0
  let timer: number | null = null
  let pending: A | null = null
  const throttled = (...args: A) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    } else {
      pending = args
      if (timer === null) {
        timer = window.setTimeout(
          () => {
            timer = null
            last = Date.now()
            if (pending) fn(...pending)
            pending = null
          },
          ms - (now - last),
        )
      }
    }
  }
  /* a rejected save must retract its optimistic relay: drop the trailing
     send so it cannot re-poison peers after the correction below it */
  throttled.cancel = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    pending = null
  }
  return throttled
}
