/** Workspace materials are independent from colour mode and member artwork. */
export type InterfaceTheme = "sovereign" | "creator";
export const INTERFACE_THEME_KEY = "rout-interface-theme";
export const DEFAULT_INTERFACE_THEME: InterfaceTheme = "sovereign";

export function parseInterfaceTheme(value: unknown): InterfaceTheme {
  return value === "creator" ? "creator" : DEFAULT_INTERFACE_THEME;
}

export function isInternalInterface(pathname: string, routeIds: readonly string[]): boolean {
  return routeIds.some(id => id.startsWith("/_authenticated")) ||
    ["/studio", "/studio/grid", "/qr"].includes(pathname);
}