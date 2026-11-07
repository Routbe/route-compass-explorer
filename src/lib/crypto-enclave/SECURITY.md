# Browser cryptography boundary

## Verified behavior

- React receives public metadata, ciphertext and opaque handles, not derived/private CryptoKeys or raw entropy. WebAuthn PRF bytes are immediately transferred by the browser adapter, never returned to React.
- Dedicated module worker performs device-key derivation, AES-GCM encryption/decryption, vault handoff, ledger key operations, signing and chain verification. ALTCHA puzzle hashing retains its separate worker with no main-thread fallback.
- Owned sensitive byte views are zero-filled on success and failure, including malformed messages and failed transfers. Decrypted bytes move back to the display adapter, which zero-fills them after decoding.
- Pending master keys are non-extractable; entropy is wiped before replying. Pending vault configuration is retained as ciphertext. Absolute deadlines are checked in addition to cleanup timers.
- Worker requests execute in order. A 120-second total request timeout terminates volatile worker state; it includes queue time. Persisted device-key writes already committed cannot be rolled back by termination.
- Existing external ciphertext formats, HKDF labels, AAD and IndexedDB slots remain compatible.

## Limits

A browser Web Worker is not a hardware enclave or a security boundary against same-origin XSS. Same-origin JavaScript can invoke the worker API and access origin storage. Non-extractability prevents API key export, not unauthorized use of an accessible key. Recovery phrases/codes, pasted handoff secrets and rendered plaintext are immutable strings visible to the UI; they cannot be reliably wiped. WebAuthn itself requires the main context. JavaScript engines and native Web Crypto can hold inaccessible copies, so zero-fill is best-effort, not guaranteed physical-memory erasure.

The existing agent vault provisioning endpoint receives the configuration and generates its temporary secret server-side. This change improves browser isolation and ciphertext storage, not server blindness at provisioning. Migrating provisioning or authentication is outside this change.

## Verification scope

Focused tests cover real cryptographic compatibility, zeroing, expired handles, malformed messages, timeout termination, failed sends and passkey ownership. Chromium verification forbids all main-context SubtleCrypto methods while exercising device-key creation/persistence, encryption/decryption, signed event verification, tamper rejection, transfer detachment and worker restart.

For the protocol/ALTCHA import workflow, Vite development-served main-thread modules fell from 10 to 2 (847,775 to 25,865 bytes, including development transforms). This is not a minified production bundle measurement. Production bundle reduction has no comparable baseline/artifacts in this environment and remains unverified.

Authenticated Neon create/read verification remains blocked by the original ROUT account/signing configuration. No account, permission, schema or Neon record is changed by this work. Automatic build/type diagnostics, not a manually invoked TypeScript build, validate the application.