import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "orange" | "blue";
};

const tones = {
  neutral: "border-border bg-surface text-muted-foreground",
  green: "border-success-border bg-success-surface text-success",
  orange: "border-warning-border bg-warning-surface text-warning",
  blue: "border-info bg-info-surface text-info-foreground",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
