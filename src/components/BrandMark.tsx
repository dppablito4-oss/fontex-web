export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Fontex">
      <span
        className="grid size-8 place-items-center rounded-[10px] bg-ink text-[13px] font-bold text-paper shadow-sm"
        aria-hidden="true"
      >
        f<span className="text-coral">.</span>
      </span>
      {!compact && (
        <span className="font-display text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-ink">
          fontex<span className="text-coral">.</span>
        </span>
      )}
    </div>
  );
}
