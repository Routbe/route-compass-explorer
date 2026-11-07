/**
 * Pushes the current ROUT Card design to passes that are already saved in Google Wallet.
 *
 * Google ignores the object inside a "Save" JWT when an object with the same id already
 * exists, so a member who saved the card before a redesign keeps the old look forever
 * unless the object is updated through the Wallet REST API. This module does exactly that,
 * best-effort: any failure is reported but never blocks the save link.
 */
import type { GoogleGenericObject } from "./google-pass-types";
import { googleCardSaveClaims, type GoogleWalletConfig, type WalletCardPayload } from "./wallet-pass";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export type WalletSyncResult = {
  /** "updated" = existing pass now shows the new design; "new" = not saved yet, the save link creates it. */
  object: "updated" | "new" | "failed";
  klass: "updated" | "created" | "failed";
  error?: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function accessToken(cfg: GoogleWalletConfig, f: FetchLike): Promise<string> {
  const { SignJWT, importPKCS8 } = await import("jose");
  const key = await importPKCS8(cfg.privateKey.replace(/\\n/g, "\n").trim(), "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(cfg.serviceAccountEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`token_${res.status}_${body.error ?? "unknown"}`);
  return body.access_token;
}

/** Updates (or creates) the class and updates an already-saved object with the current design. */
export async function syncGoogleCard(card: WalletCardPayload, origin: string, cfg: GoogleWalletConfig, f: FetchLike = fetch): Promise<WalletSyncResult> {
  const claims = googleCardSaveClaims(card, { issuerId: cfg.issuerId, serviceAccountEmail: cfg.serviceAccountEmail, origins: [origin], classId: cfg.classId });
  const klass = claims.payload.genericClasses[0]!;
  const object: GoogleGenericObject = claims.payload.genericObjects[0]!;
  const result: WalletSyncResult = { object: "failed", klass: "failed" };
  try {
    const token = await accessToken(cfg, f);
    const call = (method: string, path: string, body: unknown) =>
      f(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });

    const cls = await call("PATCH", `/genericClass/${encodeURIComponent(klass.id)}`, klass);
    if (cls.ok) result.klass = "updated";
    else if (cls.status === 404) result.klass = (await call("POST", "/genericClass", klass)).ok ? "created" : "failed";

    const obj = await call("PUT", `/genericObject/${encodeURIComponent(object.id)}`, object);
    if (obj.ok) result.object = "updated";
    else if (obj.status === 404) result.object = "new";
    else result.error = `object_${obj.status}`;
    if (result.klass === "failed" && !result.error) result.error = `class_${cls.status}`;
  } catch (e) {
    result.error = e instanceof Error ? e.message.slice(0, 120) : "sync_failed";
  }
  return result;
}

/** Same, but never takes longer than `ms` and never throws: the save link must always work. */
export async function syncGoogleCardQuietly(card: WalletCardPayload, origin: string, cfg: GoogleWalletConfig, ms = 4000): Promise<WalletSyncResult> {
  const timeout = new Promise<WalletSyncResult>((resolve) => setTimeout(() => resolve({ object: "failed", klass: "failed", error: "timeout" }), ms));
  const out = await Promise.race([syncGoogleCard(card, origin, cfg), timeout]);
  if (out.error) console.warn("[wallet] Google pass sync:", out.error);
  return out;
}
