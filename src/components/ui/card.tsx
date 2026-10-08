import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border border-line bg-surface shadow-[0_1px_0_rgba(24,35,29,0.04)]",
        className,
      )}
      {...props}
    />
  );
}
