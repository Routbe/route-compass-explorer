/// <reference lib="webworker" />
/**
 * Cryptographic enclave worker: the only browser context that performs Web
 * Crypto key operations. The UI talks to it exclusively through postMessage
 * (see client.ts / protocol.ts) and only ever receives ciphertext, public key
 * ids, display-safe summaries or plaintext it explicitly asked to decrypt.
 */
import { isEnclaveOp, runEnclaveOp } from "./enclave-core";
import type { EnclaveRequest, EnclaveResponse } from "./protocol";
import { wipeMessage } from "@/lib/crypto/wipe";

declare const self: DedicatedWorkerGlobalScope;

// Ordered execution prevents identity creation, key activation and locking
// from overtaking each other across asynchronous Web Crypto operations.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<EnclaveRequest>) => {
  const msg = event.data as Partial<EnclaveRequest> | null;
  if (!msg || !Number.isSafeInteger(msg.id) || !isEnclaveOp(msg.op)) {
    wipeMessage(msg);
    return;
  }
  const id = msg.id as number;
  const op = msg.op;
  queue = queue.then(async () => {
    const outcome = await runEnclaveOp(op, msg.args);
    const response: EnclaveResponse = { id, ...outcome };
    const transfer: Transferable[] = [];
    if (outcome.ok && (op === "data.open" || op === "protocol.openEvent")) transfer.push((outcome.result as { plaintext: Uint8Array }).plaintext.buffer as ArrayBuffer);
    try {
      self.postMessage(response, transfer);
    } finally {
      wipeMessage(response); // detached on success; zero-filled on send failure
    }
  }).catch(() => {
    // A failed send must not break the queue or expose internal error content.
    try { self.postMessage({ id, ok: false, code: "internal" } satisfies EnclaveResponse); } catch { /* receiver is gone */ }
  });
};
