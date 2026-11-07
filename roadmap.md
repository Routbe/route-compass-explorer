# Repository import

## Current request: exact import, then Neon

- [x] Compare all imported application source and assets with the supplied repository.
- [x] Restore any unintended differences and verify ROUT's public experience.
- [ ] Link Neon only after the source-import verification passes.
- [ ] Verify existing Neon compatibility without changing records or permissions.

- [x] Import ROUT source, assets, and required dependencies while preserving project metadata.
- [x] Verify the home page, navigation, QR workflow, and phone layout.
- [x] Run focused source tests and inspect automatic build diagnostics.
- [x] Document unconfigured accounts, data, and connected services.

## External blockers

- [ ] Original account and private-data flows: require compatible external database, original signing keys, and account configuration.
- [ ] Payment, email, OAuth, storage, and scheduled services: require provider configuration and end-to-end checks.