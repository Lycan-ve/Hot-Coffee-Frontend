'use client';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';

type FiltersBarProps = {
  from: number;
  to: number;
  onFrom: (value: number) => void;
  onTo: (value: number) => void;
  onSync: () => void;
  syncing: boolean;
};

export default function FiltersBar({ from, to, onFrom, onTo, onSync, syncing }: FiltersBarProps) {
  const ranges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="filters-bar" role="group" aria-label="Filtros del ranking">
      <div className="filter-label"><SlidersHorizontal size={14} aria-hidden="true" /> TORNEOS</div>
      <label htmlFor="tournament-from">
        DESDE
        <select id="tournament-from" value={from} onChange={(event) => onFrom(Number(event.target.value))}>
          {ranges.map((range) => <option key={range} value={range}>{range}</option>)}
        </select>
      </label>
      <label htmlFor="tournament-to">
        HASTA
        <select id="tournament-to" value={to} onChange={(event) => onTo(Number(event.target.value))}>
          {ranges.map((range) => <option key={range} value={range}>{range}</option>)}
        </select>
      </label>
      <button
        type="button"
        className="filter-all"
        onClick={() => {
          onFrom(1);
          onTo(10);
        }}
      >
        TODOS
      </button>
      <button type="button" className="sync-button" onClick={onSync} disabled={syncing}>
        <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
        {syncing ? 'SINCRONIZANDO' : 'SINCRONIZAR'}
      </button>
    </div>
  );
}
