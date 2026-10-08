import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title mt-2">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
