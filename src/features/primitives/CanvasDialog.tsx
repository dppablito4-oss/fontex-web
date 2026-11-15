import { useEffect, useRef, type ReactNode } from "react";
export function CanvasDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="pc-dialog" aria-label={title} onCancel={onClose}
    onClick={e => { if(e.target === e.currentTarget) { const b=e.currentTarget.getBoundingClientRect(); if(e.clientX<b.left || e.clientX>b.right || e.clientY<b.top || e.clientY>b.bottom) onClose(); } }}>
    <h2>{title}</h2>{children}
  </dialog>;
}
