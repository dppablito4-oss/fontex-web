export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Fontex">
      <span
        className="grid size-8 place-items-center rounded-[10px] bg-brand-deep text-[13px] font-bold text-on-brand shadow-sm"
        aria-hidden="true"
      >
        f<span className="text-brand-cyan">.</span>
      </span>
      {!compact && (
        <span className="font-display text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
          fontex<span className="text-primary">.</span>
        </span>
      )}
    </div>
  );
}
