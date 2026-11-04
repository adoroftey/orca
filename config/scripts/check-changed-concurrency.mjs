export function resolveCheckConcurrency({ parallelism, maxWorkers, checkConcurrency }) {
  if (checkConcurrency != null) {
    return checkConcurrency
  }
  const automatic = Math.max(3, Math.floor(parallelism / 3))
  return Number.isSafeInteger(Number(maxWorkers)) && Number(maxWorkers) > 0
    ? Math.min(automatic, Number(maxWorkers))
    : automatic
}
