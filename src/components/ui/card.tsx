import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border border-border bg-surface shadow-[0_1px_0_rgb(var(--ui-shadow)/0.08)]",
        className,
      )}
      {...props}
    />
  );
}
