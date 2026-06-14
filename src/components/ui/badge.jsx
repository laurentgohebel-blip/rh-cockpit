import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors",
      className
    )}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
