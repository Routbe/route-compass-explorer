import i18next from "i18next";
import type { QaSpace } from "./useQaPublic";

/** Head tags for the /ask pages (member page: no ROUT knowledge graph). */
export function qaAskHead(handle: string, space: QaSpace) {
  const tr = (key: string, fallback: string, params?: Record<string, string>) => {
    const out = i18next.isInitialized ? i18next.t(key, params ?? {}) : key;
    return out && out !== key ? out : fallback;
  };
  const title = tr("pages.qa.meta.title", `Stuur @${handle} een anoniem bericht`, { handle });
  const description = tr("pages.qa.meta.description", "Stuur een vraag zonder je accountgegevens met de ontvanger te delen. Toegang hangt af van de gekozen doelgroep.");
  const path = `${space === "alias" ? "/u/" : "/"}${handle}/ask`;
  return {
    meta: [
      { title },
      // An anonymous inbox must never show up in search results.
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `https://rout.be${path}` },
      { property: "og:image", content: `https://rout.be/api/public/og/${encodeURIComponent(handle)}.png?card=ask${space === "alias" ? "&space=alias" : ""}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `https://rout.be/api/public/og/${encodeURIComponent(handle)}.png?card=ask${space === "alias" ? "&space=alias" : ""}` },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      // Snapchat Creative Kit: sticker shown on the snap that carries this tappable link.
      { property: "snapchat:sticker", content: "https://rout.be/icon-512.png" },
    ],
    links: [{ rel: "canonical", href: `https://rout.be${path}` }],
  };
}
