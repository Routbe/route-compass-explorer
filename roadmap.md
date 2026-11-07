# Repository import

## Current request: exact import, then Neon

- [x] Compare all imported application source and assets with the supplied repository.
- [x] Restore any unintended differences and verify ROUT's public experience.
- [x] Link Neon only after the source-import verification passes.
- [x] Verify existing Neon compatibility without changing records or permissions.

- [x] Import ROUT source, assets, and required dependencies while preserving project metadata.
- [x] Verify the home page, navigation, QR workflow, and phone layout.
- [x] Run focused source tests and inspect automatic build diagnostics.
- [x] Document unconfigured accounts, data, and connected services.

## Current request: isolated browser cryptography

### Follow-up: correctness review and remaining hardening

- [x] Re-audit worker execution, secret-buffer ownership, expiry and account/UI lifecycle.
- [x] Fix verified memory, queue timeout, account-switch, stale UI completion and passkey cancellation gaps while preserving ciphertext and account behavior.
- [x] Expand to 83 behavioral tests; rerun Chromium cryptography, independently encrypted vault round trip, cancellation and restart with the UI crypto API disabled.
- [x] Recheck successful automatic build/type diagnostics and confirm production/auth verification blockers remain external.

- [x] Audit client cryptography and preserve ciphertext/storage compatibility.
- [x] Harden the existing dedicated worker, remove main-thread hash fallback and keep PRF bytes out of React.
- [x] Overwrite owned sensitive byte buffers on success and failure; document browser limitations.
- [x] Run 57 focused tests; verify real Chromium encryption, transfers, signing/tamper rejection and worker restart with zero main-thread SubtleCrypto calls.
- [x] Inspect successful automatic build/type diagnostics and verify development main-thread module separation.
- [ ] Compare minified production bundle sizes: blocked by absent comparable baseline/artifacts; development-served module bytes are not a production measurement.
- [ ] Verify authenticated ciphertext writes/readback in Neon: blocked by original ROUT account/signing configuration; browser-local encryption is verified, no database records changed.

## Previously identified external blockers

- [ ] Original account and private-data flows: Neon is linked and its runtime role checks pass; original signing keys, account configuration, and authenticated end-to-end checks remain required.
- [ ] Payment, email, OAuth, storage, and scheduled services: require provider configuration and end-to-end checks.

## Current request: Stealth Brutalism landing page

- [x] Scope crisp borders, hard 4px shadows and mechanical action states to the public gateway only, including shared portals and preview controls.
- [x] Preserve the monospace terminal, ROUT typography, page content and existing navigation; remove conflicting hero scale-on-press animation.
- [x] Verify zero diffuse shadows/filters, exact 4px active displacement, QR changes, menu/dialogs, sign-in navigation and 1280/810/390px layouts in Chromium; 18 existing tests and automatic build checks pass.