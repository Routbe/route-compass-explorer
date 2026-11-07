import { Anvil, Layers } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/hooks/useTheme";

export function InterfaceThemeSwitcher() {
  const { interfaceTheme, setInterfaceTheme } = useTheme();
  return (
    <ToggleGroup type="single" value={interfaceTheme} aria-label="Interface thema" className="justify-start gap-2"
      onValueChange={value => { if (value === "sovereign" || value === "creator") setInterfaceTheme(value); }}>
      <ToggleGroupItem value="sovereign" className="min-h-11 flex-1 gap-2 px-3"><Anvil className="size-4" />Sovereign</ToggleGroupItem>
      <ToggleGroupItem value="creator" className="min-h-11 flex-1 gap-2 px-3"><Layers className="size-4" />Creator</ToggleGroupItem>
    </ToggleGroup>
  );
}