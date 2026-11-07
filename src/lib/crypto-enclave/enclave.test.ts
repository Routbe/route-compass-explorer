// @vitest-environment node
import "fake-indexeddb/auto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wipe } from "@/lib/crypto/wipe";
import { open } from "@/lib/e2ee/crypto";
import { loadDeviceKey } from "@/lib/e2ee/device-key";
import { encryptLedgerEvent } from "@/lib/ledger/crypto";
import { generateEphemeralSecret, sealVaultPayload, vaultClaimProof, workspaceConfigAad } from "@/lib/vault/ephemeral-vault";
import { runEnclaveOp } from "./enclave-core";
import type { EnclaveOp, EnclaveOps } from "./protocol";

async function call<K extends EnclaveOp>(op: K, args: EnclaveOps[K]["req"]): Promise<EnclaveOps[K]["res"]> {
  const r = await runEnclaveOp(op, args);
  if (!r.ok) throw new Error(r.code);
  return r.result as EnclaveOps[K]["res"];
}
const code = async (op: EnclaveOp, args: unknown) => {
  const r = await runEnclaveOp(op, args);
  return r.ok ? "ok" : r.code;
};

describe("memory wiping", () => {
  it("overwrites typed arrays and buffers with zeros", () => {
    const a = new Uint8Array(70_000).map((_, i) => (i % 255) + 1); // spans multiple getRandomValues chunks
    const b = crypto.getRandomValues(new Uint8Array(32)).buffer;
    wipe(a, b, null, undefined, new Uint8Array(0));
    expect(a.every((x) => x === 0)).toBe(true);
    expect(new Uint8Array(b).every((x) => x === 0)).toBe(true);
  });
});

describe("cryptographic enclave", () => {
  const vaultId = "0b0e3f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  const userId = "user-enclave-test";
  const config = { name: "Studio Noord", description: "Handoff", secretNote: "TOP-SECRET-PLAINTEXT" };

  it("opens a handoff vault and returns only public metadata", async () => {
    const secret = generateEphemeralSecret();
    const blob = await sealVaultPayload(secret, vaultId, config);
    const { handle, claimProof } = await call("vault.prepare", { secret });
    expect(claimProof).toBe(await vaultClaimProof(secret));
    const summary = await call("vault.decrypt", { handle, vaultId, blob, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(summary).toEqual({ name: "Studio Noord", description: "Handoff" });
    expect(JSON.stringify(summary)).not.toContain("TOP-SECRET");
  });

  it("rejects a wrong secret and unknown handles", async () => {
    const blob = await sealVaultPayload(generateEphemeralSecret(), vaultId, config);
    const { handle } = await call("vault.prepare", { secret: generateEphemeralSecret() });
    expect(await code("vault.decrypt", { handle, vaultId, blob, expiresAt: "" })).toBe("decrypt_failed");
    expect(await code("vault.reseal", { handle: "nope", userId })).toBe("unknown_handle");
    expect(await code("vault.prepare", { secret: "short" })).toBe("invalid_input");
  });

  it("reseals with the device key, then wipes the held plaintext", async () => {
    const { handle: mk } = await call("masterKey.generate", {});
    const { keyId } = await call("masterKey.commitPending", { handle: mk, userId });
    expect(await code("masterKey.commitPending", { handle: mk, userId })).toBe("unknown_handle"); // entropy is gone

    const secret = generateEphemeralSecret();
    const { handle } = await call("vault.prepare", { secret });
    await call("vault.decrypt", { handle, vaultId, blob: await sealVaultPayload(secret, vaultId, config), expiresAt: "" });
    const sealed = await call("vault.reseal", { handle, userId });
    expect(sealed.keyId).toBe(keyId);
    expect(sealed.encrypted).not.toContain("TOP-SECRET");
    expect(await code("vault.reseal", { handle, userId })).toBe("unknown_handle"); // plaintext wiped after one reseal

    const dk = await loadDeviceKey(userId);
    expect(dk?.key.extractable).toBe(false);
    expect(await open(dk!.key, sealed.encrypted, workspaceConfigAad(userId))).toEqual(config);
  });

  it("seals UI plaintext and wipes the transferred input", async () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ note: "hello" }));
    const sealed = await call("data.seal", { userId, aad: "test:aad", plaintext });
    expect(plaintext.every((x) => x === 0)).toBe(true);
    const back = await call("data.open", { userId, aad: "test:aad", blob: sealed.encrypted });
    expect(JSON.parse(new TextDecoder().decode(back.plaintext))).toEqual({ note: "hello" });
    expect(await code("data.open", { userId, aad: "other", blob: sealed.encrypted })).toBe("decrypt_failed");
    expect(await code("data.seal", { userId: "no-key-user", aad: "x", plaintext: new Uint8Array(3) })).toBe("no_device_key");
  });

  it("rejects an invalid Master Key phrase", async () => {
    expect(await code("masterKey.unlock", { userId, mnemonic: "not a real phrase" })).toBe("invalid_mnemonic");
  });

  it("keeps ledger private keys inside and wipes the PRF output", async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const draft = await call("ledger.generate", { prf });
    expect(prf.every((x) => x === 0)).toBe(true);
    expect(draft).not.toHaveProperty("privateKey");
    await call("ledger.activate", { keyId: draft.keyId });
    const payload = await encryptLedgerEvent(draft.publicKey, { app: "X" });
    expect(await call("ledger.decrypt", { keyId: draft.keyId, items: [{ id: "1", payload }] })).toEqual({ "1": JSON.stringify({ app: "X" }) });

    await call("ledger.lock", {});
    expect(await code("ledger.decrypt", { keyId: draft.keyId, items: [] })).toBe("unknown_handle");
    await call("ledger.unlock", { keyId: draft.keyId, envelope: draft.envelopes[0], recoveryCode: draft.recoveryCode });
    expect(await call("ledger.decrypt", { keyId: draft.keyId, items: [{ id: "1", payload }] })).toEqual({ "1": JSON.stringify({ app: "X" }) });
    const wrong = `ROUT-RCVR-${"0".repeat(64)}`;
    expect(await code("ledger.unlock", { keyId: draft.keyId, envelope: draft.envelopes[0], recoveryCode: wrong })).toBe("decrypt_failed");
  }, 20000);
});

describe("UI-thread isolation", () => {
  const root = join(process.cwd(), "src");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
  const ui = [...files(join(root, "components")), ...files(join(root, "hooks")), ...files(join(root, "routes")).filter((f) => f.endsWith(".tsx"))];
  // developers.tsx shows crypto.subtle only inside a copy-paste code sample string for integrators.
  const SAMPLE_ONLY = new Set([join(root, "routes", "developers.tsx")]);

  it("no React component or hook calls crypto.subtle", () => {
    const offenders = ui.filter((f) => !SAMPLE_ONLY.has(f) && /crypto\.subtle/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("UI code imports crypto modules for types only", () => {
    const runtimeImport = /import\s+(?!type\b)[^;]*from\s+["']@\/lib\/(e2ee\/(crypto|recovery|device-key)|ledger\/crypto|vault\/ephemeral-vault|crypto-enclave\/enclave-core|protocol\/identity-store)["']/;
    expect(ui.filter((f) => runtimeImport.test(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("only the worker imports the enclave core", () => {
    const importers = files(root).filter((f) => /crypto-enclave\/enclave-core|["']\.\/enclave-core["']/.test(readFileSync(f, "utf8")));
    expect(importers.map((f) => f.slice(root.length + 1))).toEqual(["lib/crypto-enclave/crypto.worker.ts"]);
  });
});

describe("protocol identity in the enclave", () => {
  const userId = "user-protocol-test";

  it("creates a sealed did:key, signs ciphertext-only events and DPoP proofs", async () => {
    const { verifyEvent } = await import("@/lib/protocol/events");
    const { verifyDpop } = await import("@/lib/protocol/dpop");
    const { loadIdentity } = await import("@/lib/protocol/identity-store");
    const { newStreamId } = await import("@/lib/protocol/events");

    expect(await code("protocol.identity", { userId })).toBe("no_device_key"); // no Master Key unlocked → no signing
    const { handle } = await call("masterKey.generate", {});
    await call("masterKey.commitPending", { handle, userId });

    const { did } = await call("protocol.identity", { userId });
    expect(did.startsWith("did:key:z6Mk")).toBe(true);
    expect((await call("protocol.identity", { userId })).did).toBe(did);
    const stored = await loadIdentity(userId);
    expect(stored?.sealedSecret.startsWith("v1.")).toBe(true);

    const stream = newStreamId();
    const genesis = await call("protocol.signEvent", { userId, draft: { stream, seq: 0, prev: null, kind: "stream.genesis", body: {} } });
    expect(await code("protocol.signEvent", { userId, draft: { stream, seq: 1, prev: genesis.hash, kind: "profile.patch", body: { public: { bio: "x" } } } })).toBe("invalid_input");

    const plaintext = new TextEncoder().encode(JSON.stringify({ bio: "TOP-SECRET-BIO" }));
    const e1 = await call("protocol.sealEvent", { userId, stream, seq: 1, prev: genesis.hash, kind: "profile.patch", plaintext });
    expect(plaintext.every((b) => b === 0)).toBe(true); // wiped after sealing
    expect(verifyEvent(e1)).toMatchObject({ ok: true });
    expect(e1.author).toBe(did);
    expect(JSON.stringify(e1)).not.toContain("TOP-SECRET-BIO");
    const opened = await call("protocol.openEvent", { userId, event: e1 });
    expect(JSON.parse(new TextDecoder().decode(opened.plaintext))).toEqual({ bio: "TOP-SECRET-BIO" });

    const url = "https://rout.be/api/v1/ledger/events";
    const { proof } = await call("protocol.dpop", { userId, method: "POST", url });
    expect(verifyDpop(proof, { method: "POST", urls: [url] })).toMatchObject({ ok: true, did });
  }, 20000);
});
