'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

interface Player {
  id: number;
  ranking: number;
  gamerTag: string;
  sponsor: string;
  character: string;
  avatarUrl?: string;
  points: number;
}

type Status = 'loading' | 'ok' | 'offline';

const PODIUM_ART_CONFIG: Record<
  string,
  { objectPosition: string; scale?: string; x?: string; y?: string }
> = {
  caitlyn: { objectPosition: 'center -10%', scale: '2.5' },
  akali: { objectPosition: 'center 5%', scale: '2.5', x: '55%' },
  yasuo: { objectPosition: 'center 12%', scale: '2.8', x: '20%' },
  blitzcrank: { objectPosition: 'center 22%', scale: '2.0' },
  braum: { objectPosition: 'center -8%', scale: '2.8', x: '35%' },
  darius: { objectPosition: 'center 22%', scale: '2.0', x: '-25%' },
  ahri: { objectPosition: 'center -2%', scale: '2.0' },
  ekko: { objectPosition: 'center -5%', scale: '2.5', x: '-20%' },
  illaoi: { objectPosition: 'center -5%', scale: '2.5', x: '30%' },
  jinx: { objectPosition: 'center 5%', scale: '2.5', x: '10%' },
  lux: { objectPosition: 'center 10%', scale: '1.25' },
  senna: { objectPosition: 'center 14%', scale: '1.2' },
  teemo: { objectPosition: 'center 75%', scale: '1.3', x: '-15%' },
  thresh: { objectPosition: 'center -5%', scale: '2.8' },
  vi: { objectPosition: 'center 0%', scale: '2.0' },
  warwick: { objectPosition: 'center 45%', scale: '2.8', x: '-10%' },
};

const DEFAULT_ART = { objectPosition: 'center 15%', scale: '1.2' };
const FALLBACK_AVATAR = '/logo-Hot.jpg';
const ITEMS_PER_PAGE = 10;
const LIST_COLUMNS: 1 | 2 = 1;

const PLACEHOLDER_CHARACTER = /fighter|2xko|unknown|^n\/?a$|^-+$/i;

const BLANK_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const FALLBACK_PLAYERS: Player[] = [
  { id: 1, ranking: 1, gamerTag: 'ÑEMBO', sponsor: 'RZS', character: 'AKALI, YASUO', avatarUrl: '', points: 800 },
  { id: 2, ranking: 2, gamerTag: 'GAPPY', sponsor: 'TKF', character: 'BLITZCRANK', avatarUrl: '', points: 350 },
  { id: 3, ranking: 3, gamerTag: 'HIAMJOY', sponsor: 'HCN', character: 'DARIUS, BRAUM', avatarUrl: '', points: 300 },
  { id: 4, ranking: 4, gamerTag: 'MIKU', sponsor: 'FKC', character: 'AHRI', avatarUrl: '', points: 205 },
];

const parseCharacters = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && !PLACEHOLDER_CHARACTER.test(c))
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());

function Avatar({ url, alt }: { url?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const src = !failed && url && url.startsWith('http') ? url : FALLBACK_AVATAR;

  return (
    <div className="pr-user-avatar-frame">
      <img src={src} alt={alt} onError={() => setFailed(true)} />
    </div>
  );
}

function FighterArt({ characters }: { characters: string[] }) {
  if (characters.length === 0) return null;
  return (
    <div className="pr-art" aria-hidden="true">
      {characters.map((charName, i) => {
        const conf = PODIUM_ART_CONFIG[charName.toLowerCase()] || DEFAULT_ART;
        return (
          <div key={`${charName}-${i}`} className="pr-art-frame">
            <img
              src={`/fighters/${charName}.png`}
              alt=""
              className="pr-art-img"
              style={{
                objectPosition: conf.objectPosition,
                transform: `translateX(${'x' in conf && conf.x ? conf.x : '0%'}) scale(${conf.scale || DEFAULT_ART.scale})`,
              }}
              onError={(e) => {
                const frame = e.currentTarget.parentElement;
                if (frame) frame.style.display = 'none';
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function HotCoffeeRanking() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isWide, setIsWide] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');

  const tableRef = useRef<HTMLDivElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  // ---------- Range Picker ----------
  const SHORTCUTS = [3, 6, 9];
  const DEFAULT_LAST = 3;

  const [tourneyFrom, setTourneyFrom] = useState<number>(1);
  const [tourneyTo, setTourneyTo] = useState<number>(1);
  const [tourneyMax, setTourneyMax] = useState<number>(0);
  const [rangeReady, setRangeReady] = useState(false); // 🆕 evita pedir el ranking antes de saber el rango

  // 🆕 selecciona los últimos N torneos
  const selectLast = useCallback((n: number, max: number) => {
    setTourneyTo(max);
    setTourneyFrom(Math.max(1, max - n + 1));
  }, []);

  // Pedir el total de torneos y aplicar el atajo por defecto (últimos 3)
  useEffect(() => {
    const init = (max: number) => {
      setTourneyMax(max);
      selectLast(DEFAULT_LAST, max);
      setRangeReady(true);
    };
    fetch(`${API_URL}/api/tournaments/count`)
      .then((r) => r.json())
      .then((d) => init(d.count > 0 ? d.count : 17))
      .catch(() => init(17));
  }, [API_URL, selectLast]);

  // Al cambiar el rango, volver a la página 1
  useEffect(() => {
    setCurrentPage(1);
  }, [tourneyFrom, tourneyTo]);

  // 🆕 qué atajo está activo (si el rango coincide con alguno)
  const activeShortcut = SHORTCUTS.find(
    (n) => tourneyTo === tourneyMax && tourneyFrom === Math.max(1, tourneyMax - n + 1)
  );

  const fetchRankings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/rankings/2xko?from=${tourneyFrom}&to=${tourneyTo}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list: Player[] = Array.isArray(data) ? data : [];
      setPlayers([...list].sort((a, b) => a.ranking - b.ranking));
      setStatus('ok');
    } catch (error) {
      console.error('Error cargando rankings, aplicando datos de prueba...', error);
      setPlayers(FALLBACK_PLAYERS);
      setStatus('offline');
    }
  }, [API_URL, tourneyFrom, tourneyTo]);

  useEffect(() => {
    if (rangeReady) fetchRankings(); // 🆕 solo cuando el rango ya está definido
  }, [fetchRankings, rangeReady]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const totalPages = Math.max(1, Math.ceil(players.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const paginatedPlayers = players.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const top3Players = page === 1 ? paginatedPlayers.slice(0, 3) : [];
  const restPlayers = page === 1 ? paginatedPlayers.slice(3) : paginatedPlayers;

  const wide = isWide || exporting;

  const handleExportPNG = async () => {
    if (!tableRef.current || exporting) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const dataUrl = await toPng(tableRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        imagePlaceholder: BLANK_PIXEL,
      });
      const link = document.createElement('a');
      link.download = `Power-Ranking-HotCoffee-2XKO-Pag${page}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar la imagen:', err);
      setNotice('No se pudo exportar la imagen');
    } finally {
      setExporting(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/sync`);
      const json = await res.json();
      setNotice(json.message || 'Sincronizado con éxito');
      await fetchRankings();
    } catch (err) {
      setNotice('Error al sincronizar con Start.gg');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&display=swap');

        * { box-sizing: border-box; }

        .pr-root {
          min-height: 100vh;
          background-color: #392415;
          background-image:
            radial-gradient(circle at 50% 0%, rgba(180, 77, 29, 0.25), transparent 75%),
            repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(157, 149, 139, 0.03) 14px, rgba(157, 149, 139, 0.03) 15px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem 0.5rem;
          font-family: 'Barlow Condensed', sans-serif;
          width: 100%;
          overflow-x: hidden;
        }

        .pr-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 540px;
          margin-bottom: 0.8rem;
          gap: 0.8rem;
          flex-wrap: wrap;
        }
        @media (min-width: 768px) {
          .pr-controls { max-width: 920px; }
        }

        /* ---------- Rango de Torneos ---------- */
        .pr-range-picker-wrap {
          width: 100%;
          max-width: 540px;
          margin-bottom: 0.8rem;
        }
        @media (min-width: 768px) {
          .pr-range-picker-wrap { max-width: 920px; }
        }

        .pr-range-inputs {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          background: #25170d;
          border: 1px solid rgba(204, 160, 138, 0.3);
          border-radius: 8px;
          padding: 0.5rem 0.8rem;
          color: #f5f5f4;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .pr-range-inputs label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #cca08a;
          text-transform: uppercase;
        }
        .pr-range-inputs select {
          background: #191008;
          color: #f5f5f4;
          border: 1px solid rgba(204, 160, 138, 0.4);
          border-radius: 4px;
          padding: 0.25rem 0.4rem;
          font-family: inherit;
          font-weight: 700;
          font-size: 0.9rem;
        }
        
        .pr-range-shortcuts,
        .pr-range-fields {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .pr-range-fields { gap: 0.5rem; }

        .pr-shortcut-btn {
          padding: 0.25rem 0.6rem;
          background: #191008;
          color: #cca08a;
          border: 1px solid rgba(204, 160, 138, 0.4);
          border-radius: 4px;
          font-family: inherit;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .pr-shortcut-btn:hover:not(:disabled) { border-color: #d0ca53; color: #f5f5f4; }
        .pr-shortcut-btn.is-active {
          background: #d0ca53;
          color: #392415;
          border-color: #b8b245;
          box-shadow: 0 0 10px rgba(208, 202, 83, 0.3);
        }
        .pr-shortcut-btn:disabled { opacity: 0.4; cursor: progress; }

        @media (min-width: 768px) {
          .pr-range-inputs { justify-content: space-between; padding: 0.6rem 1rem; }
          .pr-shortcut-btn { font-size: 0.9rem; padding: 0.3rem 0.75rem; }
        }

        .pr-pagination { display: flex; align-items: center; gap: 0.4rem; }
        .pr-page-btn {
          padding: 0.35rem 0.7rem;
          background: #392415;
          color: #f5f5f4;
          border: 1px solid rgba(204, 160, 138, 0.3);
          border-radius: 4px;
          font-family: inherit;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .pr-page-btn:hover:not(:disabled) { background: #b44d1d; border-color: #b44d1d; }
        .pr-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .pr-page-info { color: #cca08a; font-weight: 700; font-size: 0.85rem; }

        .pr-action-btns { display: flex; gap: 0.4rem; }
        .pr-sync-btn, .pr-export-btn {
          padding: 0.45rem 0.8rem;
          background: linear-gradient(90deg, #392415, #22150b);
          color: #f5f5f4;
          border: 1px solid #cca08a;
          border-radius: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .pr-sync-btn:hover:not(:disabled), .pr-export-btn:hover:not(:disabled) {
          background: #b44d1d; border-color: #d0ca53;
        }
        .pr-sync-btn:disabled, .pr-export-btn:disabled { opacity: 0.55; cursor: progress; }

        .pr-notice {
          width: 100%;
          max-width: 540px;
          margin-bottom: 0.8rem;
          padding: 0.45rem 0.8rem;
          border-radius: 6px;
          border: 1px solid rgba(208, 202, 83, 0.35);
          background: rgba(29, 18, 10, 0.9);
          color: #d0ca53;
          font-weight: 700;
          font-size: 0.85rem;
        }
        @media (min-width: 768px) {
          .pr-notice { max-width: 920px; }
        }

        .pr-card {
          width: 100%;
          max-width: 540px;
          background: #25170d;
          border: 2px solid #b44d1d;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(180, 77, 29, 0.2);
          overflow: hidden;
          position: relative;
        }
        .pr-card.is-wide { max-width: 920px; }
        .pr-card.is-exporting { max-width: 920px; width: 920px; }

        .pr-header {
          padding: 1.2rem 1rem 0.9rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, rgba(180, 77, 29, 0.15) 0%, transparent 100%);
          border-bottom: 1px solid rgba(204, 160, 138, 0.2);
          gap: 0.5rem;
        }
        @media (min-width: 768px) {
          .pr-header { padding: 1.75rem 1.75rem 1.2rem; }
        }

        .pr-title-area { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .pr-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.9rem;
          color: #f5f5f4;
          line-height: 0.95;
          letter-spacing: 0.03em;
          text-shadow: 0 4px 15px rgba(0,0,0,0.8);
          word-break: break-word;
        }
        @media (min-width: 768px) {
          .pr-title { font-size: 2.8rem; }
        }

        .pr-subtitle {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 0.95rem;
          color: #d0ca53;
          letter-spacing: 0.1em;
          margin-top: 4px;
          text-shadow: 0 0 10px rgba(208, 202, 83, 0.4);
        }
        @media (min-width: 768px) {
          .pr-subtitle { font-size: 1.25rem; }
        }

        .pr-logo-badge {
          width: 75px;
          height: 75px;
          background: #1a1008;
          border: 2px solid #d0ca53;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.8), 0 0 15px rgba(208, 202, 83, 0.2);
          flex-shrink: 0;
          transform: rotate(3deg);
        }
        @media (min-width: 768px) {
          .pr-logo-badge { width: 110px; height: 110px; border-radius: 12px; padding: 8px; }
        }
        .pr-logo-badge img { width: 100%; height: 100%; object-fit: contain; }

        .pr-podium-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0.8rem 0.8rem 0.5rem;
        }
        @media (min-width: 768px) {
          .pr-podium-section { padding: 1.1rem 1.2rem 0.8rem; gap: 10px; }
        }

        .pr-podium-row, .pr-row {
          position: relative;
          display: flex;
          align-items: center;
          border-radius: 8px;
          overflow: hidden;
          background: #1d120a;
          padding: 0 0.7rem 0 0.3rem;
          height: 80px;
        }
        @media (min-width: 768px) {
          .pr-podium-row.top-1 { height: 100px; }
          .pr-podium-row.top-2 { height: 90px; }
          .pr-podium-row.top-3 { height: 90px; }
          .pr-row { height: 90px; padding: 0 1.1rem 0 0.5rem; }
        }

        .pr-podium-row.top-1 {
          background: linear-gradient(90deg, rgba(208, 202, 83, 0.25) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #d0ca53;
          box-shadow: 0 4px 18px rgba(208, 202, 83, 0.2);
        }
        .pr-podium-row.top-2 {
          background: linear-gradient(90deg, rgba(215, 223, 142, 0.2) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #d7df8e;
        }
        .pr-podium-row.top-3 {
          background: linear-gradient(90deg, rgba(115, 140, 62, 0.25) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #738c3e;
        }
        .pr-podium-row::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0;
          z-index: 4;
        }
        .pr-podium-row.top-1::before { width: 5px; background: #d0ca53; box-shadow: 0 0 12px #d0ca53; }
        .pr-podium-row.top-2::before { width: 4px; background: #d7df8e; box-shadow: 0 0 10px #d7df8e; }
        .pr-podium-row.top-3::before { width: 4px; background: #738c3e; box-shadow: 0 0 8px #738c3e; }

        .pr-row {
          background: linear-gradient(90deg, rgba(204, 160, 138, 0.07) 0%, #191008 70%);
          border: 1px solid rgba(204, 160, 138, 0.18);
        }

        .pr-podium-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(208, 202, 83, 0.3), transparent);
          margin: 0.1rem 0.8rem 0.6rem;
        }
        @media (min-width: 768px) {
          .pr-podium-divider { margin: 0.2rem 1.2rem 0.9rem; }
        }

        .pr-art {
          position: absolute;
          top: 0; bottom: 0;
          left: 30%; right: 25%;
          display: flex;
          z-index: 2;
          pointer-events: none;
          opacity: 0.45; /* Más tenue en móvil para no opacar el texto */
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%);
        }
        @media (min-width: 768px) {
          .pr-art { opacity: 0.92; left: 34%; right: 22%; }
          .pr-card:not(.is-wide) .pr-art { left: 42%; right: 30%; }
        }

        .pr-art-frame {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          overflow: hidden;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
        }
        .pr-art-frame + .pr-art-frame { margin-left: -6%; }
        .pr-art-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.9));
        }

        .pr-rank {
          position: relative;
          z-index: 4;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 2rem;
          width: 34px;
          text-align: center;
          flex-shrink: 0;
          margin-left: 2px;
          line-height: 1;
        }
        @media (min-width: 768px) {
          .pr-rank { font-size: 2.6rem; width: 44px; margin-left: 6px; }
        }

        .pr-rank.gold   { color: #d0ca53; text-shadow: 0 0 10px rgba(208, 202, 83, 0.6); }
        .pr-rank.silver { color: #d7df8e; text-shadow: 0 0 8px rgba(215, 223, 142, 0.5); }
        .pr-rank.bronze { color: #738c3e; text-shadow: 0 0 8px rgba(115, 140, 62, 0.6); }
        .pr-rank.white  { color: #9d958b; text-shadow: 1px 1px 4px rgba(0,0,0,0.8); }

        .pr-name-wrap {
          position: relative;
          z-index: 4;
          margin-left: 6px;
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        @media (min-width: 768px) {
          .pr-name-wrap { margin-left: 10px; gap: 14px; }
        }

        .pr-player-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .pr-name {
          font-size: 1.1rem;
          font-weight: 800;
          font-style: italic;
          color: #f5f5f4;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1.1;
          text-shadow: 2px 2px 5px rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 768px) {
          .pr-name { font-size: 1.4rem; }
          .pr-podium-row.top-1 .pr-name { font-size: 1.6rem; }
        }

        .pr-sponsor { color: #b44d1d; font-style: normal; font-weight: 800; flex-shrink: 0; }

        .pr-fighter-tag {
          font-size: 0.68rem;
          font-weight: 700;
          color: #cca08a;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 768px) {
          .pr-fighter-tag { font-size: 0.78rem; }
        }

        .pr-right-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          .pr-right-group { gap: 14px; }
        }

        .pr-user-avatar-frame {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #d0ca53;
          background: #1a1008;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(208, 202, 83, 0.3);
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          .pr-user-avatar-frame { width: 46px; height: 46px; }
        }
        .pr-user-avatar-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .pr-points {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.1rem;
          color: #392415;
          background: #d0ca53;
          border: 1px solid #b8b245;
          padding: 2px 8px;
          border-radius: 5px;
          letter-spacing: 0.03em;
          box-shadow: 0 0 10px rgba(208, 202, 83, 0.3);
          white-space: nowrap;
          font-weight: 800;
        }
        @media (min-width: 768px) {
          .pr-points { font-size: 1.4rem; padding: 3px 12px; border-radius: 6px; }
        }

        .pr-list-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 0.8rem 1.2rem;
        }
        @media (min-width: 768px) {
          .pr-list-section { padding: 0 1.2rem 1.6rem; gap: 10px; }
          .pr-card.is-wide .pr-list-section.cols-2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px 14px;
          }
        }

        .pr-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 1.5rem 0;
          color: #cca08a;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .pr-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 0.9rem 0.8rem;
          border-top: 1px solid rgba(204, 160, 138, 0.2);
          background: rgba(37, 23, 13, 0.7);
          font-size: 0.72rem;
          font-weight: 700;
          color: #cca08a;
          text-transform: uppercase;
          gap: 0.5rem;
        }
        @media (min-width: 768px) {
          .pr-footer { padding: 0.7rem 1.2rem 0.9rem; font-size: 0.8rem; }
        }
      `}</style>

      <main className="pr-root">
        {/* Controles superiores */}
        <div className="pr-controls">
          <div className="pr-pagination">
            <button
              className="pr-page-btn"
              disabled={page === 1}
              onClick={() => setCurrentPage(page - 1)}
              aria-label="Página anterior"
            >
              ◀ Ant
            </button>
            <span className="pr-page-info">
              Pág {page} / {totalPages}
            </span>
            <button
              className="pr-page-btn"
              disabled={page === totalPages}
              onClick={() => setCurrentPage(page + 1)}
              aria-label="Página siguiente"
            >
              Sig ▶
            </button>
          </div>

          <div className="pr-action-btns">
            <button className="pr-sync-btn" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Sincronizando…' : '⟳ Sincronizar'}
            </button>
            <button className="pr-export-btn" onClick={handleExportPNG} disabled={exporting}>
              {exporting ? 'Generando…' : '↓ PNG'}
            </button>
          </div>
        </div>

          {/* Rango de Torneos */}
          <div className="pr-range-picker-wrap">
            <div className="pr-range-inputs">
              <div className="pr-range-shortcuts">
                {SHORTCUTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`pr-shortcut-btn${activeShortcut === n ? ' is-active' : ''}`}
                    onClick={() => selectLast(n, tourneyMax)}
                    disabled={!rangeReady}
                  >
                    Últimos {n}
                  </button>
                ))}
              </div>

              <div className="pr-range-fields">
                <label>Desde</label>
                <select
                  value={tourneyFrom}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTourneyFrom(v);
                    if (v > tourneyTo) setTourneyTo(v);
                  }}
                >
                  {Array.from({ length: tourneyMax }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>

                <label>Hasta</label>
                <select
                  value={tourneyTo}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTourneyTo(v);
                    if (v < tourneyFrom) setTourneyFrom(v);
                  }}
                >
                  {Array.from({ length: tourneyMax }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        {status === 'offline' && !notice && (
          <div className="pr-notice">Sin conexión con la API: mostrando datos de prueba.</div>
        )}
        {notice && <div className="pr-notice">{notice}</div>}

        <div
          ref={tableRef}
          className={`pr-card${wide ? ' is-wide' : ''}${exporting ? ' is-exporting' : ''}`}
        >
          <div className="pr-header">
            <div className="pr-title-area">
              <div className="pr-title">
                HOT COFFEE 2XKO<br />DISCORD RANKING
              </div>
              <div className="pr-subtitle">ORGANIZADO POR BANEADO SENSEI</div>
            </div>
            <div className="pr-logo-badge">
              <img src="/logo-Hot.jpg" alt="Hot Coffee x 2XKO" />
            </div>
          </div>

          {/* 1. PODIO (Top 3) */}
          {top3Players.length > 0 && (
            <>
              <div className="pr-podium-section">
                {top3Players.map((player, index) => {
                  const characters = parseCharacters(player.character);
                  const rankClass = ['gold', 'silver', 'bronze'][index];

                  return (
                    <div key={player.id} className={`pr-podium-row top-${index + 1}`}>
                      <span className={`pr-rank ${rankClass}`}>{player.ranking}</span>

                      <FighterArt characters={characters} />

                      <div className="pr-name-wrap">
                        <div className="pr-player-info">
                          <span className="pr-name">
                            {player.sponsor && <span className="pr-sponsor">{player.sponsor} |</span>}
                            {player.gamerTag}
                          </span>
                          {characters.length > 0 && (
                            <span className="pr-fighter-tag">{characters.join(' + ')}</span>
                          )}
                        </div>

                        <div className="pr-right-group">
                          <Avatar url={player.avatarUrl} alt={player.gamerTag} />
                          <span className="pr-points">{player.points} PTS</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pr-podium-divider" />
            </>
          )}

          {/* 2. LISTA GENERAL */}
          <div className={`pr-list-section cols-${LIST_COLUMNS}`}>
            {restPlayers.length === 0 && top3Players.length === 0 && (
              <div className="pr-empty">
                {status === 'loading' ? 'Cargando ranking…' : 'Todavía no hay jugadores en el ranking.'}
              </div>
            )}

            {restPlayers.map((player) => {
              const characters = parseCharacters(player.character);
              return (
                <div key={player.id} className="pr-row">
                  <span className="pr-rank white">{player.ranking}</span>

                  <FighterArt characters={characters} />

                  <div className="pr-name-wrap">
                    <div className="pr-player-info">
                      <span className="pr-name">
                        {player.sponsor && <span className="pr-sponsor">{player.sponsor} |</span>}
                        {player.gamerTag}
                      </span>
                      {characters.length > 0 && (
                        <span className="pr-fighter-tag">{characters.join(' + ')}</span>
                      )}
                    </div>

                    <div className="pr-right-group">
                      <Avatar url={player.avatarUrl} alt={player.gamerTag} />
                      <span className="pr-points">{player.points} PTS</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pr-footer">
            <span>
              Pág {page} de {totalPages} ·{' '}
              {activeShortcut
                ? `Últimos ${activeShortcut} torneos (${tourneyFrom}–${tourneyTo})`
                : `Torneos ${tourneyFrom}–${tourneyTo}`}
            </span>
            <span>Hot Coffee 2XKO Circuit</span>
          </div>
        </div>
      </main>
    </>
  );
}