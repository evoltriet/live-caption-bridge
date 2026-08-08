import type { CaptionSegment, ExportFormat } from '../shared/contracts'

export function serializeTranscript(
  segments: CaptionSegment[],
  format: ExportFormat
): string {
  if (format === 'json') {
    return `${JSON.stringify({ exportedAt: new Date().toISOString(), segments }, null, 2)}\n`
  }
  if (format === 'vtt') {
    return serializeVtt(segments)
  }
  return serializeText(segments)
}

function serializeText(segments: CaptionSegment[]): string {
  return `${segments
    .map(
      (segment) =>
        `[${new Date(segment.startedAt).toISOString()}]\nEnglish: ${segment.englishText}\nTiếng Việt: ${segment.vietnameseText}`
    )
    .join('\n\n')}\n`
}

function serializeVtt(segments: CaptionSegment[]): string {
  if (segments.length === 0) {
    return 'WEBVTT\n'
  }

  const origin = segments[0]?.startedAt ?? 0
  const cues = segments.map((segment, index) => {
    const start = Math.max(0, segment.startedAt - origin)
    const next = segments[index + 1]
    const inferredEnd = next ? next.startedAt - origin : segment.emittedAt - origin + 2_000
    const end = Math.max(start + 1_000, inferredEnd)
    return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(end)}\n${segment.englishText}\n${segment.vietnameseText}`
  })

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

function formatVttTime(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)
  const millis = total % 1_000
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':') + `.${String(millis).padStart(3, '0')}`
}
