/// <reference lib="webworker" />
/**
 * Cryptographic enclave worker: the only browser context that performs Web
 * Crypto key operations. The UI talks to it exclusively through postMessage
 * (see client.ts / protocol.ts) and only ever receives ciphertext, public key
 * ids, display-safe summaries or plaintext it explicitly asked to decrypt.
 */
import { isEnclaveOp, runEnclaveOp } from "./enclave-core";
import type { EnclaveRequest, EnclaveResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<EnclaveRequest>) => {
  const msg = event.data as Partial<EnclaveRequest> | null;
  if (!msg || typeof msg.id !== "number" || !isEnclaveOp(msg.op)) return;
  const outcome = await runEnclaveOp(msg.op, msg.args);
  const response: EnclaveResponse = { id: msg.id, ...outcome };
  // Decrypted bytes are transferred (moved), so no copy lingers in the worker.
  const transfer: Transferable[] = [];
  if (outcome.ok && (msg.op === "data.open" || msg.op === "protocol.openEvent")) transfer.push((outcome.result as { plaintext: Uint8Array }).plaintext.buffer as ArrayBuffer);
  self.postMessage(response, transfer);
};
