import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callEnclave, enclave, terminateEnclave } from "./client";

class FakeWorker {
  static current: FakeWorker | null = null;
  static fail = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: { id: number; op: string; args: unknown }[] = [];
  terminated = false;
  constructor() { FakeWorker.current = this; }
  postMessage(request: { id: number; op: string; args: unknown }) {
    if (FakeWorker.fail) throw new DOMException("Cannot clone", "DataCloneError");
    this.requests.push(request);
  }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.({ data }); }
}

function currentWorker() {
  const worker = FakeWorker.current;
  if (!worker) throw new Error("Worker was not created");
  return worker;
}

describe("enclave message ownership", () => {
  beforeEach(() => {
    FakeWorker.fail = false;
    FakeWorker.current = null;
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => {
    terminateEnclave();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fails closed and wipes input if workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    const plaintext = new Uint8Array([1, 2, 3]);
    await expect(callEnclave("data.seal", { userId: "u", aad: "a", plaintext })).rejects.toMatchObject({ code: "enclave_unavailable" });
    expect([...plaintext]).toEqual([0, 0, 0]);
  });

  it("cleans up waiters and sensitive input on a synchronous send failure", async () => {
    vi.useFakeTimers();
    FakeWorker.fail = true;
    const plaintext = new Uint8Array([10, 20]);
    await expect(callEnclave("data.seal", { userId: "u", aad: "a", plaintext })).rejects.toMatchObject({ code: "invalid_input" });
    expect([...plaintext]).toEqual([0, 0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("zeroes late plaintext replies with no remaining receiver", () => {
    const promise = enclave.hash.sha256Hex("x");
    const worker = currentWorker();
    const id = worker.requests[0].id;
    worker.reply({ id, ok: true, result: "hash" });
    const plaintext = new Uint8Array([1, 2]);
    worker.reply({ id, ok: true, result: { plaintext } });
    expect([...plaintext]).toEqual([0, 0]);
    return expect(promise).resolves.toBe("hash");
  });

  it("terminates volatile state on timeout rather than allowing a late activation", async () => {
    vi.useFakeTimers();
    const pending = enclave.masterKey.generate();
    const rejection = expect(pending).rejects.toMatchObject({ code: "timeout" });
    const worker = currentWorker();
    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    expect(worker.terminated).toBe(true);
    const bytes = new Uint8Array([7]);
    worker.reply({ id: worker.requests[0].id, ok: true, result: { plaintext: bytes } });
    expect([...bytes]).toEqual([0]);
  });

  it("rejects pending requests when structured-clone reception fails", async () => {
    const pending = enclave.hash.sha256Hex("abc");
    const rejection = expect(pending).rejects.toMatchObject({ code: "enclave_crashed" });
    const worker = currentWorker();
    worker.onmessageerror?.();
    await rejection;
    expect(worker.terminated).toBe(true);
  });
});