'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
export default function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (n: number) => void }) {
  return (
    <div className="pagination" role="group" aria-label="Paginación del ranking">
      <button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span aria-live="polite">{String(page).padStart(2, '0')} <i>/</i> {String(total).padStart(2, '0')}</span>
      <button type="button" aria-label="Página siguiente" disabled={page === total} onClick={() => onChange(page + 1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
