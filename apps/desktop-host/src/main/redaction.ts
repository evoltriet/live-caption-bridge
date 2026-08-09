const SENSITIVE_KEYS = /(?:audio|caption|credential|key|secret|text|token|transcript)/i

/** Sanitizes structured diagnostic context before it reaches an operational log. */
export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return '[REDACTED]'
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    return '[CIRCULAR]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redactLogValue(item, seen)
    ])
  )
}
