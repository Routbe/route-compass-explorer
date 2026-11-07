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

## External blockers

## Current request: isolated browser cryptography

- [ ] Audit client cryptography and preserve ciphertext/storage compatibility.
- [ ] Move browser encryption, key management, and vault handoff into a dedicated worker with typed messaging.
- [ ] Overwrite owned sensitive byte buffers on success and failure; document browser limitations.
- [ ] Run focused security tests and verify the real browser flow, type diagnostics, and bundle separation.

## Previously identified external blockers

- [ ] Original account and private-data flows: Neon is linked and its runtime role checks pass; original signing keys, account configuration, and authenticated end-to-end checks remain required.
- [ ] Payment, email, OAuth, storage, and scheduled services: require provider configuration and end-to-end checks.