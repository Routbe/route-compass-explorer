import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api_/wallet/render/premium-logo.png")({
  server: { handlers: { GET: async () => {
    const { googlePremiumLogoSvg, GOOGLE_PASS_DESIGN } = await import("@/lib/wallet/google-premium-art");
    const { svgToPng } = await import("@/lib/og-render.server");
    const { walletOrigin } = await import("@/lib/wallet/wallet-payload.server");
    const png = await svgToPng(googlePremiumLogoSvg(), walletOrigin(), GOOGLE_PASS_DESIGN.background, 660);
    return new Response(png as BodyInit, { headers: { "content-type": "image/png", "access-control-allow-origin": "*", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
  } } },
});