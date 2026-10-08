import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "orange" | "blue";
};

const tones = {
  neutral: "border-line bg-surface text-muted",
  green: "border-[#b8cfc2] bg-[#e5efe9] text-forest",
  orange: "border-[#ecc6aa] bg-[#fff0e4] text-[#8a4b21]",
  blue: "border-[#b9cbd8] bg-[#eaf1f5] text-[#31576c]",
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
