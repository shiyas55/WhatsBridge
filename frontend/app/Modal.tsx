'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, description, onClose, children }: {
  title: string; description?: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <dialog ref={ref} className="wb-dialog" aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }}>
      <header className="wb-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="wb-dialog-close" aria-label="Close dialog" onClick={onClose} autoFocus><X size={20}/></button>
      </header>
      <div className="wb-dialog-body">{children}</div>
    </dialog>, document.body);
}
