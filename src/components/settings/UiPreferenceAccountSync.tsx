import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUiPreferences } from "@/hooks/useUiPreferences";
import { setUiPreferences } from "@/lib/ui-preferences-store";
import { getAccountUiMaterial, saveAccountUiMaterial } from "@/lib/ui-preferences.functions";

/**
 * Signed-in members carry their material across devices: the account value is
 * adopted once per sign-in, later device changes are written back. Failures
 * leave the device choice in place.
 */
export function UiPreferenceAccountSync() {
  const { user } = useAuth();
  const { material } = useUiPreferences();
  const adoptedFor = useRef<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) { adoptedFor.current = null; return; }
    if (adoptedFor.current === userId) return;
    let live = true;
    getAccountUiMaterial().then(({ material: stored }) => {
      if (!live) return;
      adoptedFor.current = userId;
      if (stored) setUiPreferences({ material: stored });
      else void saveAccountUiMaterial({ data: { material } }).catch(() => undefined);
    }).catch(() => { if (live) adoptedFor.current = userId; });
    return () => { live = false; };
  }, [userId, material]);

  useEffect(() => {
    if (!userId || adoptedFor.current !== userId) return;
    void saveAccountUiMaterial({ data: { material } }).catch(() => undefined);
  }, [userId, material]);

  return null;
}
