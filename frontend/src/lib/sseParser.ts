/**
 * Tiny SSE frame parser over a ReadableStream<string> chunk source.
 * Yields (event, data) tuples. Handles multi-line data blocks (joins them),
 * ignores comments (lines starting with ':'), tolerates CRLF.
 */

export interface SseFrame {
  event: string
  data: string
}

export async function* parseSseStream(
  source: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
  const reader = source.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Split on SSE record terminator: a blank line (\n\n or \r\n\r\n).
      let idx = buffer.search(/\r?\n\r?\n/)
      while (idx !== -1) {
        const raw = buffer.slice(0, idx)
        buffer = buffer.slice(idx + (buffer[idx] === "\r" ? 4 : 2))
        const frame = parseFrame(raw)
        if (frame) yield frame
        idx = buffer.search(/\r?\n\r?\n/)
      }
    }
    // Flush any trailing frame
    if (buffer.trim()) {
      const frame = parseFrame(buffer)
      if (frame) yield frame
    }
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message"
  const dataLines: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue
    const sep = line.indexOf(":")
    if (sep === -1) continue
    const field = line.slice(0, sep)
    let value = line.slice(sep + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    if (field === "event") event = value
    else if (field === "data") dataLines.push(value)
  }

  if (!dataLines.length) return null
  return { event, data: dataLines.join("\n") }
}
