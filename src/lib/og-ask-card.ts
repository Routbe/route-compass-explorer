import { escapeXml, initials } from "@/lib/og-card";

/**
 * Link-preview card (1200×630) for /<handle>/ask: a framed "send me an anonymous
 * question" prompt with a fake input field, so a pasted link in a Snapchat or
 * Instagram story clearly reads as an anonymous inbox. Tapping it opens ROUT.
 */
export function askOgSvg(input: { handle: string; name: string; avatarUrl: string | null; accent: string; title: string; placeholder: string; cta: string; urlLabel: string }) {
  const { handle, name, avatarUrl, accent } = input;
  const avatar = avatarUrl
    ? `<clipPath id="av"><circle cx="190" cy="215" r="58"/></clipPath><image href="${escapeXml(avatarUrl)}" x="132" y="157" width="116" height="116" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="190" cy="215" r="58" fill="#ffffff" fill-opacity="0.25"/><text x="190" y="232" text-anchor="middle" font-family="Inter" font-weight="700" font-size="44" fill="#ffffff">${escapeXml(initials(name))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="head" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(accent)}"/><stop offset="1" stop-color="#E4572E"/></linearGradient>
    <clipPath id="card"><rect x="80" y="70" width="1040" height="490" rx="44"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#131211"/>
  <g clip-path="url(#card)">
    <rect x="80" y="70" width="1040" height="490" fill="#ffffff"/>
    <rect x="80" y="70" width="1040" height="290" fill="url(#head)"/>
    ${avatar}
    <text x="280" y="200" font-family="Inter" font-weight="800" font-size="54" fill="#ffffff">${escapeXml(input.title)}</text>
    <text x="280" y="256" font-family="Inter" font-weight="500" font-size="32" fill="#ffffff" fill-opacity="0.85">@${escapeXml(handle)}</text>
    <rect x="132" y="300" width="936" height="120" rx="28" fill="#ffffff"/>
    <rect x="132" y="300" width="936" height="120" rx="28" fill="none" stroke="#000000" stroke-opacity="0.08" stroke-width="2"/>
    <text x="172" y="374" font-family="Inter" font-weight="500" font-size="36" fill="#8a8580">${escapeXml(input.placeholder)}</text>
    <rect x="132" y="452" width="936" height="72" rx="36" fill="#131211"/>
    <text x="600" y="499" text-anchor="middle" font-family="Inter" font-weight="700" font-size="30" fill="#ffffff">${escapeXml(input.cta)}</text>
  </g>
  <text x="600" y="600" text-anchor="middle" font-family="Inter" font-weight="500" font-size="24" fill="#ffffff" fill-opacity="0.6">${escapeXml(input.urlLabel)}</text>
</svg>`;
}
