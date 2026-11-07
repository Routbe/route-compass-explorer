/**
 * Best-effort memory wiping for key material and plaintext held in typed arrays.
 * Overwrites with CSPRNG noise, then zeros, so a later heap snapshot finds
 * neither the secret nor a recognisable all-zero marker of where it lived.
 *
 * Limits (by design of JavaScript engines): JS strings are immutable and cannot
 * be wiped, and the engine may have made internal copies we cannot reach. Wipe
 * every typed array you own as soon as the operation that needed it finishes.
 */
const CHUNK = 65536; // crypto.getRandomValues refuses larger requests

export function wipe(...buffers: Array<Uint8Array | ArrayBuffer | null | undefined>): void {
  for (const b of buffers) {
    if (!b) continue;
    const view = b instanceof Uint8Array ? b : new Uint8Array(b);
    if (view.byteLength === 0) continue; // empty or already transferred (detached)
    for (let offset = 0; offset < view.length; offset += CHUNK) {
      crypto.getRandomValues(view.subarray(offset, offset + CHUNK) as Uint8Array<ArrayBuffer>);
    }
    view.fill(0);
  }
}
