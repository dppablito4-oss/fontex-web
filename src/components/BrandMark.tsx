export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label="Fontex">
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-brand-black shadow-sm" aria-hidden="true">
        <img
          alt=""
          className="size-8 object-contain"
          src={`${import.meta.env.BASE_URL}brand/fontex-mark.svg`}
        />
      </span>
      {!compact && (
        <span className="font-display text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
          fontex<span className="text-primary">.</span>
        </span>
      )}
    </div>
  );
}
