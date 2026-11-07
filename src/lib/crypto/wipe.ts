/**
 * Best-effort memory wiping for key material and plaintext held in typed arrays.
 * Zero-fill the owned view, including when randomness is unavailable.
 *
 * Limits (by design of JavaScript engines): JS strings are immutable and cannot
 * be wiped, and the engine may have made internal copies we cannot reach. Wipe
 * every typed array you own as soon as the operation that needed it finishes.
 */
export function wipe(...buffers: Array<ArrayBufferView | ArrayBuffer | null | undefined>): void {
  for (const b of buffers) {
    if (!b) continue;
    try {
      const view = ArrayBuffer.isView(b)
        ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
        : new Uint8Array(b);
      view.fill(0);
    } catch {
      // A transferred buffer is detached and has no accessible bytes to wipe.
    }
  }
}

/** Covers malformed requests too, without relying on a handler reaching its finally. */
export function wipeMessage(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    wipe(value);
    return;
  }
  for (const child of Object.values(value)) wipeMessage(child, seen);
}
