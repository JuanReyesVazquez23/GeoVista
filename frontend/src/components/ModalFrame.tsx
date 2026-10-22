import type { ReactNode } from 'react';
import { useModalA11y } from '../useModalA11y';

interface Props {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

// Envoltorio para modales sin animación (panel admin). ExploreModal usa el
// mismo hook directamente porque anima con framer-motion.
export default function ModalFrame({ label, onClose, className, children }: Props) {
  const dialogRef = useModalA11y(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={className ? `modal ${className}` : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
