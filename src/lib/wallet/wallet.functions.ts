import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuth, requireAuth } from "@/lib/auth/middleware";

/** Owner-only Google claim. Client account IDs and arbitrary class IDs are never accepted. */
export const createWalletPass = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ handle: z.string().trim().min(1).max(100).regex(/^@?[\w.-]+$/), space: z.enum(["root", "alias"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { isPlatformFeatureEnabled } = await import("@/lib/platform-features.server");
    if (!(await isPlatformFeatureEnabled("wallet"))) return { ok: false as const, error: "feature_disabled" };
    const { generateWalletPayload, walletOrigin } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    const { canClaimWalletCard } = await import("./wallet-claim");
    if (!own || !canClaimWalletCard(own, data.handle, data.space)) return { ok: false as const, error: "forbidden" };
    const { googleWalletConfig } = await import("./wallet-pass");
    const cfg = googleWalletConfig(process.env as Record<string, string | undefined>);
    if (!cfg) return { ok: false as const, error: "wallet_not_configured" };
    try {
      const { googleCardSave } = await import("./google-wallet.server");
      // Google ignores the JWT object when the pass is already saved: push the current design first.
      const { syncGoogleCardQuietly } = await import("./google-wallet-sync.server");
      const sync = await syncGoogleCardQuietly(own, walletOrigin(), cfg);
      return { ok: true as const, ...(await googleCardSave(own, walletOrigin(), cfg)), updatedExisting: sync.object === "updated" };
    } catch {
      console.error("[wallet] owner claim signing failed");
      return { ok: false as const, error: "wallet_issue_failed" };
    }
  });

/** Public: which wallets can issue passes right now (booleans only, never config values). */
export const getWalletStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { walletStatus } = await import("./wallet-pass");
  const { isPlatformFeatureEnabled } = await import("@/lib/platform-features.server");
  // An admin pause switches both wallets off; the 3D card and vCard stay available.
  if (!(await isPlatformFeatureEnabled("wallet"))) return { apple: false, google: false };
  return walletStatus(process.env as Record<string, string | undefined>);
});

/** Public: the ROUT Card payload for the 3D card (public profile data only). */
export const getWalletCard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().trim().min(1).max(100).regex(/^@?[\w.-]+$/), space: z.enum(["root", "alias"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { generateWalletPayload, walletOrigin } = await import("./wallet-payload.server");
    const card = await generateWalletPayload(data.handle, { space: data.space });
    if (!card) return null;
    const base = walletOrigin();
    // Same-origin path for drawing the photo on a canvas without CORS taint.
    const avatarPath = card.heroImageUrl?.startsWith(base) ? card.heroImageUrl.slice(base.length) : null;
    const { readCardDesign } = await import("./card-freeze.server");
    const { applyCardDesign } = await import("./card-design");
    const styled = applyCardDesign(card, await readCardDesign(card.serial));
    const { pickCardView } = await import("./card-liveness");
    // Allowlist, not a spread: only public card fields ever leave the server here.
    const view = pickCardView({ ...styled.card, avatarPath, materialId: styled.materialId as string | null });
    return view;
  });

const cardRef = z.object({ handle: z.string().trim().min(1).max(100).regex(/^@?[\w.-]+$/), space: z.enum(["root", "alias"]).optional() });

/**
 * Liveness for the 3D card. Everyone gets the per-window shader seed; only the
 * signed-in owner of this exact card gets the rotating live code.
 */
export const getCardLiveness = createServerFn({ method: "POST" })
  .middleware([optionalAuth])
  .inputValidator((d: unknown) => cardRef.parse(d))
  .handler(async ({ data, context }) => {
    const { generateWalletPayload } = await import("./wallet-payload.server");
    const { livenessKey } = await import("./card-liveness.server");
    const { liveCode, liveSeed, liveWindow, LIVE_WINDOW_S } = await import("./card-liveness");
    const card = await generateWalletPayload(data.handle, { space: data.space });
    if (!card) return null;
    const key = await livenessKey();
    const now = Date.now();
    const w = liveWindow(now);
    let owner = false;
    if (context.userId) {
      const own = await generateWalletPayload(context.userId, { space: card.space, allowAccountId: true });
      owner = own?.serial === card.serial;
    }
    const { cardStatus } = await import("./card-freeze.server");
    const status = await cardStatus(card.serial);
    const live = owner && status === "active";
    // Age tier is told to the owner only; visitors never learn a member is a minor.
    const { isMinorUser } = await import("@/lib/minor-safety.server");
    const minor = owner && context.userId ? await isMinorUser(context.userId).catch(() => true) : false;
    return {
      owner,
      tier: (minor ? "minor" : "sovereign") as "minor" | "sovereign",
      frozen: status !== "active",
      freezeAvailable: status !== "unavailable",
      window: w,
      expiresAt: (w + 1) * LIVE_WINDOW_S * 1000,
      serverNow: now,
      seed: await liveSeed(key, card.serial, w),
      code: live ? await liveCode(key, card.serial, w) : null,
    };
  });

/**
 * Owner only: a fresh secure QR (60 s, single-use nonce). The client asks
 * every 45 s, so the back of the card always shows a live token.
 */
export const getSecureCardToken = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ space: z.enum(["root", "alias"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateWalletPayload, walletOrigin } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    if (!own) return null;
    const { validateCardActive } = await import("./card-freeze.server");
    if (!(await validateCardActive(own.serial))) return { frozen: true as const };
    const { livenessKey } = await import("./card-liveness.server");
    const { signSecureToken } = await import("./card-token");
    const now = Date.now();
    const { token, payload } = await signSecureToken(await livenessKey(), { handle: own.handle, space: own.space, now });
    return { frozen: false as const, url: `${walletOrigin()}/s/${token}`, iat: payload.iat, exp: payload.exp, serverNow: now };
  });

/** Public: check a secure QR from the back of a card. Rate limited. */
export const verifySecureCardToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().trim().min(20).max(600) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { hitRateLimit, clientIp } = await import("@/lib/rate-limit-db.server");
    const limit = await hitRateLimit("card-secure-verify", clientIp(getRequest()), { limit: 20, windowSec: 300 }, { failClosed: true });
    if (!limit.ok) return { status: "limited" as const };
    const { verifySecureCardTokenCore } = await import("./card-verify.server");
    return verifySecureCardTokenCore(data.token);
  });

/** Public: check a code a card holder shows you. Rate limited per visitor. */
export const verifyCardLiveCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardRef.extend({ code: z.string().trim().min(4).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { hitRateLimit, clientIp } = await import("@/lib/rate-limit-db.server");
    const limit = await hitRateLimit("card-live-verify", clientIp(getRequest()), { limit: 10, windowSec: 300 }, { failClosed: true });
    if (!limit.ok) return { valid: false, limited: true };
    const { generateWalletPayload } = await import("./wallet-payload.server");
    const { livenessKey } = await import("./card-liveness.server");
    const { verifyLiveCode } = await import("./card-liveness");
    const card = await generateWalletPayload(data.handle, { space: data.space });
    if (!card) return { valid: false, limited: false };
    const { validateCardActive } = await import("./card-freeze.server");
    if (!(await validateCardActive(card.serial))) return { valid: false, limited: false };
    return { valid: await verifyLiveCode(await livenessKey(), card.serial, data.code, Date.now()), limited: false };
  });

/** Owner only: freeze or unfreeze their own card (lost or stolen). */
export const setMyCardFrozen = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ frozen: z.boolean(), space: z.enum(["root", "alias"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateWalletPayload } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    if (!own) throw Object.assign(new Error("No card"), { statusCode: 404 });
    const { setCardFrozen } = await import("./card-freeze.server");
    await setCardFrozen(own.serial, context.userId, data.frozen);
    return { frozen: data.frozen };
  });

const cmfInput = z.object({
  space: z.enum(["root", "alias"]).optional(),
  materialId: z.string().min(1).max(40),
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  displayName: z.string().trim().min(1).max(40),
  region: z.string().trim().max(40),
});

/** Owner only: validate (tier, contrast, privacy bot) and store the CMF production JSON. */
export const saveMyCardDesign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => cmfInput.parse(d))
  .handler(async ({ data, context }) => {
    const { checkCardText } = await import("./card-privacy");
    const hit = checkCardText(data.displayName) ?? checkCardText(data.region);
    if (hit) return { ok: false as const, error: "privacy" as const, hit };
    const { isMinorUser } = await import("@/lib/minor-safety.server");
    const tier = (await isMinorUser(context.userId).catch(() => true)) ? "minor" : "sovereign";
    const { buildCmf } = await import("./card-cmf");
    const r = buildCmf(data, tier);
    if (!r.ok) return { ok: false as const, error: r.error };
    const { generateWalletPayload } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    if (!own) throw Object.assign(new Error("No card"), { statusCode: 404 });
    const { saveCardDesign } = await import("./card-freeze.server");
    try {
      await saveCardDesign(own.serial, context.userId, r.cmf);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 503) return { ok: false as const, error: "unavailable" as const };
      throw err;
    }
    return { ok: true as const, cmf: r.cmf };
  });

/** Owner only: the member's physical keys (cards, wearables). */
export const listMyPhysicalKeys = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { listMyKeys } = await import("./card-freeze.server");
    return listMyKeys();
  });

/** Legacy registration is disabled: client tags must not supply factory keys. */
export const addMyPhysicalKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z.object({
      space: z.enum(["root", "alias"]).optional(),
      label: z.string().trim().max(40).optional(),
      nfcUid: z.string().max(60).optional(),
      publicKey: z.string().max(200).optional(),
      keyAlg: z.enum(["Ed25519", "P-256"]).optional(),
    }).parse(d),
  )
  .handler(async () => ({ ok: false as const, error: "factory-only" as const }));

/** Owner only: pair a pre-provisioned card using a separate activation proof. */
export const pairMyPhysicalKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({
    hardwareId: z.string().uuid(),
    activationCode: z.string().trim().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/),
    space: z.enum(["root", "alias"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateWalletPayload } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    if (!own) return { ok: false as const, error: "card" as const };
    const { pairFactoryKey } = await import("./card-freeze.server");
    const { sha256Hex } = await import("./hardware-crypto");
    try {
      const id = await pairFactoryKey(data.hardwareId, await sha256Hex(data.activationCode), own.serial);
      return id ? { ok: true as const, hardwareId: id } : { ok: false as const, error: "activation" as const };
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 503) return { ok: false as const, error: "unavailable" as const };
      throw err;
    }
  });

/** Owner only: activate, freeze or revoke one physical key. Revoked is final. */
export const setMyPhysicalKeyStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ hardwareId: z.string().uuid(), status: z.enum(["active", "frozen", "revoked"]) }).parse(d))
  .handler(async ({ data }) => {
    const { setMyKeyStatus } = await import("./card-freeze.server");
    return { ok: await setMyKeyStatus(data.hardwareId, data.status) };
  });

/** Owner-only: static public QR for the printed metal card. Never an auth credential. */
export const getPhysicalCardQr = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ space: z.enum(["root", "alias"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateWalletPayload, walletOrigin } = await import("./wallet-payload.server");
    const own = await generateWalletPayload(context.userId, { space: data.space, allowAccountId: true });
    if (!own) return null;
    const { livenessKey } = await import("./card-liveness.server");
    const { sealPublicCardId } = await import("./card-public-id");
    const id = await sealPublicCardId(await livenessKey(), context.userId, own.space);
    return { url: `${walletOrigin()}/v/${id}`, authenticates: false as const };
  });

/** Public: printed metal-card QR lookup. Identity display only; rate limited. */
export const lookupPhysicalCardFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ cardId: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { hitRateLimit, clientIp } = await import("@/lib/rate-limit-db.server");
    const limit = await hitRateLimit("card-physical-lookup", clientIp(getRequest()), { limit: 60, windowSec: 300 }, { failClosed: true });
    if (!limit.ok) return { channel: "physical-public" as const, authenticates: false as const, status: "limited" as const };
    const { lookupPhysicalCard } = await import("./physical-card.server");
    return lookupPhysicalCard(data.cardId);
  });
