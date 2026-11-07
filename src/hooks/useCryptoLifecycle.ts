import { useCallback, useEffect, useRef } from "react";
import { captureEnclaveScope, EnclaveError } from "@/lib/crypto-enclave/client";

/** Suppress late crypto UI completions after lock, account remount or unmount. */
export function useCryptoLifecycle() {
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; };
  }, []);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const capture = useCallback(() => {
    const local = generation.current;
    const scope = captureEnclaveScope();
    return {
      signal: scope.signal,
      assertCurrent: () => {
        scope.assertCurrent();
        if (!mounted.current || local !== generation.current) throw new EnclaveError("enclave_crashed");
      },
      isCurrent: () => {
        try { scope.assertCurrent(); return mounted.current && local === generation.current; } catch { return false; }
      },
    };
  }, []);
  return { capture, invalidate };
}