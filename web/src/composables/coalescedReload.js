/**
 * FE-02: merge rapid reload triggers (e.g. WS bursts) into one async call per frame window.
 */
export function createCoalescedAsync(fn, delayMs = 48) {
  let timer = 0
  let pendingArgs = null
  let chain = Promise.resolve()

  return (...args) => {
    pendingArgs = args
    clearTimeout(timer)
    timer = setTimeout(() => {
      const runArgs = pendingArgs
      pendingArgs = null
      chain = chain.then(() => fn(...runArgs))
    }, delayMs)
    return chain
  }
}
