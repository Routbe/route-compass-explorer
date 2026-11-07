import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { motion, useReducedMotion } from "motion/react";
import { premiumSpringPreset } from "@/lib/spatial-motion";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
  const ownRef = React.useRef<HTMLButtonElement | null>(null);
  const [checked, setChecked] = React.useState(Boolean(props.checked ?? props.defaultChecked));
  const reduced = useReducedMotion();
  React.useEffect(() => {
    const element = ownRef.current;
    if (!element) return;
    const sync = () => setChecked(element.dataset["state"] === "checked");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(element, { attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);
  return (
  <SwitchPrimitives.Root
    className={cn(
      "spatial-switch peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={(element) => { ownRef.current = element; if (typeof ref === "function") ref(element); else if (ref) ref.current = element; }}
  >
    <SwitchPrimitives.Thumb asChild><motion.span
      className="spatial-switch-thumb pointer-events-none block h-[18px] w-[18px] rounded-full ring-0"
      initial={false} animate={{ x: checked ? 20 : 0 }} transition={reduced ? { duration: 0 } : premiumSpringPreset}
    /></SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
