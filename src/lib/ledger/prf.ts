// Local base64 helpers: this file runs on the UI thread (WebAuthn is unavailable in
// workers) and must not pull the ledger crypto module into the main bundle.
const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

/** Optional PRF only: unsupported authenticators never fall back to server-known secrets. */
export async function ledgerPrf(credentialId?: string): Promise<{ output: Uint8Array; credentialId: string } | null> {
  const salt = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ROUT-ledger-private-key-PRF:v1"));
  const extensions = { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs;
  const credential = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: "required", timeout: 60000,
    ...(credentialId ? { allowCredentials: [{ type: "public-key" as const, id: fromBase64(credentialId) }] } : {}), extensions,
  } }) as PublicKeyCredential | null;
  if (!credential) return null;
  const results = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & { prf?: { results?: { first?: ArrayBuffer } } };
  const output = results.prf?.results?.first;
  return output ? { output: new Uint8Array(output), credentialId: toBase64(new Uint8Array(credential.rawId)) } : null;
}