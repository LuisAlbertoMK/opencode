export function withTimeout<T>(promise: Promise<T>, ms: number, label?: string, signal?: AbortSignal): Promise<T> {
  // ciclo3-exp8: acepta AbortSignal opcional (ej. AbortSignal.timeout(ms)); si el caller lo soporta se propaga, si no solo documenta y mantiene Promise.race compatible
  let timeout: NodeJS.Timeout | undefined
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        if (signal.aborted) reject(signal.reason ?? new Error(label ?? `Operation timed out after ${ms}ms`))
        const handler = () => reject(signal.reason ?? new Error(label ?? `Operation timed out after ${ms}ms`))
        signal.addEventListener("abort", handler, { once: true })
        promise.finally(() => signal.removeEventListener("abort", handler)).catch(() => {})
      })
    : undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(label ?? `Operation timed out after ${ms}ms`)), ms)
  })
  const race: Promise<T>[] = abortPromise
    ? ([
        promise.finally(() => {
          if (timeout) clearTimeout(timeout)
        }),
        timeoutPromise,
        abortPromise,
      ] as unknown as Promise<T>[])
    : [
        promise.finally(() => {
          if (timeout) clearTimeout(timeout)
        }),
        timeoutPromise as unknown as Promise<T>,
      ]
  return Promise.race(race)
}
