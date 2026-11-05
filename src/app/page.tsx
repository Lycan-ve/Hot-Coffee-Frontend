'use client';

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { toPng } from 'html-to-image';
import DiscordLoginButton from '@/components/DiscordLoginButton';
import SiteHeader from '@/components/SiteHeader';
import { getToken } from '@/lib/auth';

interface Player {
  id: number;
  ranking: number;
  gamerTag: string;
  sponsor: string;
  character: string;
  avatarUrl?: string;
  profileUrl?: string;
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
  lux: { objectPosition: 'center -12%', scale: '2.5', x:'10%' },
  senna: { objectPosition: 'center 13%', scale: '2.5', x:'-10%' },
  teemo: { objectPosition: 'center 75%', scale: '1.3', x: '-15%' },
  thresh: { objectPosition: 'center -5%', scale: '2.8' },
  vi: { objectPosition: 'center 0%', scale: '2.0' },
  warwick: { objectPosition: 'center 45%', scale: '2.8', x: '-10%' },
  sett: { objectPosition: 'center -5%', scale: '2.5', x: '-15%'},
  samira: { objectPosition: 'center -15%', scale: '3.0', x: '-20%'},
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

const Avatar = memo(function Avatar({ url, alt, profileUrl }: { url?: string; alt: string; profileUrl?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const src = !failed && url && url.startsWith('http') ? url : FALLBACK_AVATAR;

  const avatarElement = (
    <div className="pr-user-avatar-frame">
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );

  if (profileUrl) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Ver perfil de Start.gg de ${alt}`}
        className="pr-avatar-link"
      >
        {avatarElement}
      </a>
    );
  }

  return avatarElement;
});

const FighterArt = memo(function FighterArt({ characters }: { characters: string[] }) {
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
              loading="lazy"
              decoding="async" /* 🚀 Evita que el navegador se congele al decodificar */
              className="pr-art-img"
              style={{
                objectPosition: conf.objectPosition,
                transform: `translateX(${'x' in conf && conf.x ? conf.x : '0%'}) scale(${conf.scale || DEFAULT_ART.scale}) translateZ(0)`,
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
});

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
  const [showRangePicker, setShowRangePicker] = useState(false);

  const [tourneyFrom, setTourneyFrom] = useState<number>(1);
  const [tourneyTo, setTourneyTo] = useState<number>(1);
  const [tourneyMax, setTourneyMax] = useState<number>(0);
  const [rangeReady, setRangeReady] = useState(false);

  // 🕒 Hora del último refresco para el indicador "En vivo" del espectador.
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const selectLast = useCallback((n: number, max: number) => {
    setTourneyTo(max);
    setTourneyFrom(Math.max(1, max - n + 1));
  }, []);

  const selectAllTournaments = useCallback((max: number) => {
    setTourneyFrom(1);
    setTourneyTo(max);
  }, []);

  useEffect(() => {
    const commonFighters = [
      'Akali', 'Yasuo', 'Ahri', 'Ekko', 'Braum', 'Illaoi', 
      'Caitlyn', 'Blitzcrank', 'Darius', 'Jinx', 'Thresh', 'Vi'
    ];
    commonFighters.forEach((name) => {
      const img = new Image();
      img.src = `/fighters/${name}.png`;
    });
  }, []);

  useEffect(() => {
    const init = (max: number) => {
      setTourneyMax(max);
      selectAllTournaments(max);
      setRangeReady(true);
    };
    fetch(`${API_URL}/api/tournaments/count`)
      .then((r) => r.json())
      .then((d) => init(d.count > 0 ? d.count : 17))
      .catch(() => init(17));
  }, [API_URL, selectAllTournaments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tourneyFrom, tourneyTo]);

  const activeShortcut = SHORTCUTS.find(
    (n) => tourneyTo === tourneyMax && tourneyFrom === Math.max(1, tourneyMax - n + 1)
  );

  const isAllSelected = tourneyFrom === 1 && tourneyTo === tourneyMax;

  const fetchRankings = useCallback(async (silent = false) => {
    try {
      const response = await fetch(`${API_URL}/api/rankings/2xko?from=${tourneyFrom}&to=${tourneyTo}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list: Player[] = Array.isArray(data) ? data : [];
      setPlayers([...list].sort((a, b) => a.ranking - b.ranking));
      setStatus('ok');
      setLastRefresh(new Date());
    } catch (error) {
      if (silent) return; // el refresco automático nunca tumba la vista
      console.error('Error cargando rankings, aplicando datos de prueba...', error);
      setPlayers(FALLBACK_PLAYERS);
      setStatus('offline');
    }
  }, [API_URL, tourneyFrom, tourneyTo]);

  useEffect(() => {
    if (rangeReady) fetchRankings();
  }, [fetchRankings, rangeReady]);

  // 🔄 Auto-refresh silencioso cada 60 s: el espectador ve los cambios sin recargar.
  useEffect(() => {
    if (status !== 'ok') return;
    const id = setInterval(() => {
      fetchRankings(true);
    }, 60000);
    return () => clearInterval(id);
  }, [status, fetchRankings]);

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
      // Esta llamada ahora se quedará parada en "Sincronizando..." 
      // hasta que Go termine por completo de procesar los torneos y guardar en la BD.
      const token = getToken();
      const res = await fetch(`${API_URL}/api/sync`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.status === 401) throw new Error('Inicia sesión con Discord para sincronizar');
      if (!res.ok) throw new Error('Error en el servidor');
      
      const json = await res.json();
      setNotice(json.message || 'Sincronizado con éxito');

      // Volvemos a pedir los rankings para asegurar consistencia visual
      await fetchRankings();

      // 🔄 Como el backend ya confirmó el fin de la ejecución, recargamos la página por completo
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err) {
      console.error(err);
      setNotice(err instanceof Error && err.message ? err.message : 'Error al sincronizar con Start.gg');
      setSyncing(false); // Solo liberamos si hubo error para permitir reintentar
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&display=swap');

        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background-color: #392415; }

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

        .pr-range-picker-wrap {
          width: 100%;
          max-width: 540px;
          margin-bottom: 0.8rem;
          animation: fadeIn 0.25s ease-in-out;
        }
        @media (min-width: 768px) {
          .pr-range-picker-wrap { max-width: 920px; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
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
          flex-wrap: wrap;
        }
        .pr-range-fields { gap: 0.5rem; }

        .pr-shortcut-btn, .pr-filter-toggle-btn {
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
        .pr-shortcut-btn:hover:not(:disabled), .pr-filter-toggle-btn:hover { border-color: #d0ca53; color: #f5f5f4; }
        .pr-shortcut-btn.is-active, .pr-filter-toggle-btn.is-active {
          background: #d0ca53;
          color: #392415;
          border-color: #b8b245;
          box-shadow: 0 0 10px rgba(208, 202, 83, 0.3);
        }
        .pr-shortcut-btn:disabled { opacity: 0.4; cursor: progress; }

        .pr-filter-toggle-btn {
          padding: 0.45rem 0.8rem;
          border-radius: 6px;
          font-size: 0.85rem;
        }

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

        .pr-action-btns { display: flex; gap: 0.4rem; align-items: center; }
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
          transform: translateZ(0);
        }
        .pr-card.is-wide { max-width: 920px; }
        .pr-card.is-exporting { max-width: 920px; width: 920px; }

        .pr-birthday-banner {
          background: linear-gradient(90deg, #b44d1d, #d0ca53, #b44d1d);
          background-size: 200% auto;
          color: #25170d;
          text-align: center;
          padding: 0.5rem 1rem;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.25rem;
          letter-spacing: 0.08em;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(255,255,255,0.4);
          border-bottom: 2px solid #d0ca53;
          animation: shine 4s linear infinite;
        }
        @media (min-width: 768px) {
          .pr-birthday-banner {
            font-size: 1.6rem;
            padding: 0.7rem 1rem;
          }
        }
        @keyframes shine {
          to { background-position: 200% center; }
        }

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

        .pr-avatar-link {
          display: inline-block;
          will-change: transform;
          transition: transform 0.2s ease;
        }
        .pr-avatar-link:hover {
          transform: scale(1.12);
        }
        .pr-user-avatar-frame {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #d0ca53;
          background: #1a1008;
          overflow: hidden;
          box-shadow: 0 0 8px rgba(208, 202, 83, 0.2);
          flex-shrink: 0;
        }
        .pr-avatar-link:hover .pr-user-avatar-frame {
          border-color: #f5f5f4;
          box-shadow: 0 0 12px rgba(208, 202, 83, 0.6);
        }
        @media (min-width: 768px) {
          .pr-user-avatar-frame { width: 46px; height: 46px; }
        }
        .pr-user-avatar-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .pr-title-area { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .pr-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.9rem;
          color: #f5f5f4;
          line-height: 0.95;
          letter-spacing: 0.03em;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
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
          box-shadow: 0 4px 15px rgba(0,0,0,0.8);
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
          transform: translateZ(0);
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
        .pr-podium-row.top-1::before { width: 5px; background: #d0ca53; }
        .pr-podium-row.top-2::before { width: 4px; background: #d7df8e; }
        .pr-podium-row.top-3::before { width: 4px; background: #738c3e; }

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
          opacity: 0.45;
        }
        @media (min-width: 768px) {
          .pr-art { opacity: 0.92; left: 34%; right: 22%; }
          .pr-card:not(.is-wide) .pr-art { left: 42%; right: 30%; }
        }

        @media (max-width: 767px) {
          .pr-art {
            left: 16% !important;
            right: 16% !important;
            opacity: 0.60 !important;
          }
        }

        .pr-art-frame {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          overflow: hidden;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          transform: translateZ(0); /* Fuerza aceleración por hardware */
        }
        .pr-art-frame + .pr-art-frame { margin-left: -6%; }

        .pr-art-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: translateZ(0);
          will-change: transform; /* Le avisa al navegador que esto se va a escalar para que lo optimice */
          backface-visibility: hidden;
          opacity: 0;
          animation: imageFadeIn 0.25s ease-in-out forwards;
        }

        @keyframes imageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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

        .pr-rank.gold   { color: #d0ca53; }
        .pr-rank.silver { color: #d7df8e; }
        .pr-rank.bronze { color: #738c3e; }
        .pr-rank.white  { color: #9d958b; }

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

        .pr-points {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.1rem;
          color: #392415;
          background: #d0ca53;
          border: 1px solid #b8b245;
          padding: 2px 8px;
          border-radius: 5px;
          letter-spacing: 0.03em;
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
        }

        .pr-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 1.5rem 0;
          color: #cca08a;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        /* 🚀 FOOTER UNIFICADO Y RESPONSIVO */
        .pr-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.8rem 1rem;
          border-top: 1px solid rgba(204, 160, 138, 0.2);
          background: rgba(37, 23, 13, 0.85);
          font-size: 0.75rem;
          font-weight: 700;
          color: #cca08a;
          text-transform: uppercase;
          gap: 1rem;
          flex-wrap: wrap;
        }
        @media (min-width: 768px) {
          .pr-footer { padding: 0.9rem 1.4rem; font-size: 0.85rem; }
        }

        .pr-footer-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pr-footer-pagination {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .pr-footer-right {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-left: auto;
        }
        @media (max-width: 767px) {
          .pr-footer-right {
            width: 100%;
            justify-content: space-between;
            margin-left: 0;
            padding-top: 0.4rem;
            border-top: 1px dashed rgba(204, 160, 138, 0.2);
          }
        }

        /* Botón Discord en Footer */
        .pr-render-badge {
          background: linear-gradient(135deg, #5865f2 0%, #404feed5 100%);
          border: 1px solid #7983f5;
          color: #ffffff !important;
          padding: 0.3rem 0.65rem;
          border-radius: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 0 10px rgba(88, 101, 242, 0.4);
          transition: all 0.25s ease;
        }
        .pr-render-badge:hover {
          background: linear-gradient(135deg, #4752c4 0%, #3543b5 100%);
          border-color: #d0ca53;
          box-shadow: 0 0 15px rgba(88, 101, 242, 0.7);
          transform: translateY(-1px);
        }
        .pr-discord-icon {
          width: 14px;
          height: 14px;
          fill: currentColor;
          flex-shrink: 0;
        }
        .pr-tag-highlight {
          background: rgba(0, 0, 0, 0.3);
          padding: 1px 4px;
          border-radius: 3px;
          color: #d0ca53;
          font-size: 0.68rem;
        }

        /* Crédito de Lycan */
        .pr-dev-credit {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #d0ca53;
        }
        .pr-dev-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid #d0ca53;
          object-fit: cover;
        }

        /* Dashboard layout: keeps the Hot Coffee palette and ranking behavior. */
        .pr-root {
          display: grid;
          grid-template-columns: 214px minmax(0, 1fr);
          grid-template-areas:
            "sidebar main"
            "sidebar info";
          align-items: start;
          gap: 18px;
          width: min(100%, 1580px);
          margin: 0 auto;
          padding: 18px;
          overflow: visible;
          background-color: #392415;
          background-image:
            radial-gradient(ellipse at 48% 0%, rgba(180, 77, 29, 0.22), transparent 56%),
            repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(157, 149, 139, 0.025) 14px, rgba(157, 149, 139, 0.025) 15px);
        }

        .pr-sidebar {
          grid-area: sidebar;
          position: sticky;
          top: 78px;
          min-width: 0;
          min-height: calc(100vh - 36px);
          display: flex;
          flex-direction: column;
          padding: 18px 14px;
          border: 1px solid rgba(204, 160, 138, 0.2);
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(37, 23, 13, 0.96), rgba(29, 18, 10, 0.92));
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.24);
        }

        .pr-side-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f5f5f4;
          text-decoration: none;
        }

        .pr-sidebar-logo {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          overflow: hidden;
          border: 1px solid #d0ca53;
          border-radius: 10px;
          background: #191008;
          padding: 4px;
        }

        .pr-sidebar-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .pr-side-brand-name {
          display: flex;
          flex-direction: column;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.25rem;
          line-height: 0.95;
          letter-spacing: 0.04em;
        }

        .pr-side-brand-name strong {
          color: #d0ca53;
          font-weight: inherit;
        }

        .pr-sidebar-caption {
          margin: 15px 0 8px;
          color: #9d958b;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pr-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .pr-nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 8px;
          color: #cca08a;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
        }

        .pr-nav-link span {
          width: 23px;
          color: #9d958b;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .pr-nav-link:hover,
        .pr-nav-link.is-active {
          border-color: rgba(208, 202, 83, 0.22);
          background: linear-gradient(90deg, rgba(180, 77, 29, 0.22), rgba(208, 202, 83, 0.07));
          color: #f5f5f4;
        }

        .pr-nav-link.is-active span {
          color: #d0ca53;
        }

        .pr-sidebar-rule {
          height: 1px;
          margin: 18px 0;
          background: linear-gradient(90deg, rgba(208, 202, 83, 0.42), transparent);
        }

        .pr-sidebar-season {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 13px;
          border: 1px solid rgba(204, 160, 138, 0.14);
          border-radius: 9px;
          background: rgba(25, 16, 8, 0.74);
          color: #cca08a;
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.3;
        }

        .pr-sidebar-season strong {
          color: #d0ca53;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.65rem;
          font-weight: 400;
          line-height: 1;
        }

        .pr-sidebar-actions {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          margin-top: auto;
          padding-top: 18px;
        }

        .pr-sidebar-actions .inline-flex {
          justify-content: center;
          min-height: 40px;
          border-color: rgba(208, 202, 83, 0.35);
          background: rgba(208, 202, 83, 0.1);
          color: #f5f5f4;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          text-align: center;
        }

        .pr-sidebar-actions .inline-flex:hover {
          border-color: #d0ca53;
          background: rgba(208, 202, 83, 0.18);
        }

        .pr-discord-link {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 40px;
          padding: 7px 10px;
          border: 1px solid rgba(204, 160, 138, 0.23);
          border-radius: 7px;
          color: #cca08a;
          font-size: 0.83rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-decoration: none;
          text-transform: uppercase;
          transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
        }

        .pr-discord-link:hover {
          border-color: #b44d1d;
          background: rgba(180, 77, 29, 0.15);
          color: #f5f5f4;
        }

        .pr-main-column {
          grid-area: main;
          min-width: 0;
        }

        .pr-page-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin: 2px 2px 16px;
        }

        .pr-page-kicker {
          margin: 0 0 3px;
          color: #d0ca53;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .pr-page-title {
          margin: 0;
          color: #f5f5f4;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(1.9rem, 3vw, 2.55rem);
          font-weight: 400;
          line-height: 0.96;
          letter-spacing: 0.035em;
        }

        .pr-page-description {
          margin: 6px 0 0;
          color: #cca08a;
          font-size: 0.92rem;
        }

        .pr-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          padding: 8px 11px;
          border: 1px solid rgba(204, 160, 138, 0.2);
          border-radius: 999px;
          background: rgba(37, 23, 13, 0.7);
          color: #cca08a;
          font-size: 0.78rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .pr-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9d958b;
          box-shadow: 0 0 8px currentColor;
        }

        .pr-status-pill.is-ok .pr-status-dot { background: #738c3e; }
        .pr-status-pill.is-loading .pr-status-dot { background: #d0ca53; }
        .pr-status-pill.is-offline .pr-status-dot { background: #b44d1d; }

        .pr-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .pr-summary-card {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border: 1px solid rgba(204, 160, 138, 0.17);
          border-radius: 9px;
          background: linear-gradient(135deg, rgba(37, 23, 13, 0.88), rgba(29, 18, 10, 0.68));
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .pr-summary-label {
          color: #9d958b;
          font-size: 0.67rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pr-summary-value {
          overflow: hidden;
          color: #d0ca53;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.7rem;
          line-height: 1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pr-summary-value.is-name {
          color: #f5f5f4;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1.08rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .pr-summary-detail {
          overflow: hidden;
          color: #cca08a;
          font-size: 0.76rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pr-info-panel {
          grid-area: info;
          display: grid;
          grid-template-columns: 1fr;
          align-content: start;
          gap: 12px;
          min-width: 0;
        }

        .pr-info-card {
          min-width: 0;
          padding: 16px;
          border: 1px solid rgba(204, 160, 138, 0.19);
          border-radius: 12px;
          background: linear-gradient(160deg, rgba(37, 23, 13, 0.94), rgba(29, 18, 10, 0.82));
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
        }

        .pr-info-eyebrow {
          margin: 0 0 6px;
          color: #b44d1d;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .pr-info-title {
          margin: 0;
          color: #f5f5f4;
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 1.35rem;
          font-weight: 400;
          line-height: 1;
          letter-spacing: 0.04em;
        }

        .pr-info-copy {
          margin: 8px 0 0;
          color: #cca08a;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .pr-info-stat {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 13px;
          padding-top: 10px;
          border-top: 1px solid rgba(204, 160, 138, 0.14);
          color: #9d958b;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .pr-info-stat strong { color: #d0ca53; }

        .pr-leader {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .pr-leader .pr-user-avatar-frame {
          width: 42px;
          height: 42px;
        }

        .pr-leader-name {
          overflow: hidden;
          color: #f5f5f4;
          font-size: 0.95rem;
          font-weight: 800;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .pr-leader-points {
          color: #d0ca53;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .pr-controls,
        .pr-range-picker-wrap,
        .pr-notice,
        .pr-card {
          max-width: none;
        }

        .pr-controls { margin-bottom: 12px; }
        .pr-range-picker-wrap { margin-bottom: 12px; }
        .pr-mobile-login { display: none; }

        .pr-card.is-wide,
        .pr-card.is-exporting {
          width: 100%;
          max-width: none;
        }

        @media (min-width: 1280px) {
          .pr-root {
            grid-template-columns: 224px minmax(0, 1fr) 278px;
            grid-template-areas: "sidebar main info";
            gap: 20px;
            padding: 22px;
          }
          .pr-sidebar { min-height: calc(100vh - 44px); }
          .pr-info-panel { padding-top: 0; }
        }

        @media (min-width: 900px) and (max-width: 1279px) {
          .pr-root { grid-template-columns: 190px minmax(0, 1fr); gap: 14px; padding: 14px; }
          .pr-sidebar { min-height: calc(100vh - 28px); }
          .pr-info-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 899px) {
          .pr-root {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            padding: 12px;
          }
          .pr-sidebar {
            position: static;
            min-height: 0;
            padding: 12px;
          }
          .pr-sidebar-caption,
          .pr-sidebar-season,
          .pr-sidebar-rule,
          .pr-sidebar-actions { display: none; }
          .pr-sidebar-nav {
            flex-direction: row;
            gap: 6px;
            margin-top: 10px;
          }
          .pr-nav-link {
            flex: 1;
            justify-content: center;
            min-height: 36px;
            padding: 0 8px;
            font-size: 0.84rem;
          }
          .pr-main-column { width: 100%; }
          .pr-mobile-login { display: flex; width: 100%; }
          .pr-mobile-login .inline-flex { justify-content: center; width: 100%; }
          .pr-info-panel {
            width: 100%;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .pr-info-card { padding: 14px; }
          .pr-controls { max-width: none; }
          .pr-range-picker-wrap,
          .pr-notice { max-width: none; }
        }

        @media (max-width: 560px) {
          .pr-root { gap: 11px; padding: 8px; }
          .pr-sidebar { border-radius: 10px; padding: 10px; }
          .pr-sidebar-logo { width: 38px; height: 38px; }
          .pr-side-brand-name { font-size: 1.08rem; }
          .pr-nav-link span { display: none; }
          .pr-nav-link { font-size: 0.78rem; }
          .pr-page-heading { align-items: flex-start; flex-direction: column; gap: 10px; margin-bottom: 12px; }
          .pr-summary-grid { gap: 6px; margin-bottom: 10px; }
          .pr-summary-card { padding: 9px 8px; }
          .pr-summary-label { font-size: 0.57rem; letter-spacing: 0.07em; }
          .pr-summary-value { font-size: 1.4rem; }
          .pr-summary-value.is-name { font-size: 0.86rem; }
          .pr-summary-detail { font-size: 0.66rem; }
          .pr-info-panel { grid-template-columns: 1fr; gap: 9px; }
          .pr-controls { align-items: stretch; gap: 8px; }
          .pr-action-btns { width: 100%; justify-content: space-between; gap: 6px; }
          .pr-filter-toggle-btn,
          .pr-sync-btn,
          .pr-export-btn { padding: 0.42rem 0.55rem; font-size: 0.76rem; }
          .pr-card { border-radius: 9px; }
          .pr-header { padding: 0.95rem 0.8rem 0.75rem; }
          .pr-title { font-size: 1.65rem; }
          .pr-logo-badge { width: 58px; height: 58px; }
          .pr-podium-section { padding: 0.65rem 0.55rem 0.45rem; }
          .pr-list-section { padding: 0 0.55rem 0.9rem; }
          .pr-podium-row,
          .pr-row { height: 72px; }
          .pr-rank { font-size: 1.7rem; width: 28px; }
          .pr-name { font-size: 0.94rem; }
          .pr-fighter-tag { font-size: 0.6rem; }
          .pr-right-group { gap: 5px; }
          .pr-user-avatar-frame { width: 31px; height: 31px; }
          .pr-points { padding: 2px 6px; font-size: 0.94rem; }
          .pr-render-badge { font-size: 0.7rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pr-root *,
          .pr-root *::before,
          .pr-root *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* --- Carga y feedback para el espectador (esqueletos, "En vivo", hover) --- */
        .pr-skeleton-list { display: grid; gap: 8px; grid-column: 1 / -1; }
        .pr-skeleton-row {
          display: flex; align-items: center; gap: 12px;
          height: 56px; padding: 0 1rem;
          border: 1px solid #ffffff0f; border-radius: 6px;
          background: #ffffff05;
        }
        .pr-skeleton-shape {
          background: linear-gradient(100deg, #ffffff08 40%, #ffffff14 50%, #ffffff08 60%);
          background-size: 200% 100%;
          animation: pr-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
        }
        .pr-skeleton-shape.is-rank { width: 28px; height: 28px; border-radius: 50%; }
        .pr-skeleton-shape.is-art { width: 48px; height: 48px; border-radius: 6px; }
        .pr-skeleton-lines { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .pr-skeleton-shape.is-name { width: 38%; height: 12px; }
        .pr-skeleton-shape.is-tag { width: 24%; height: 9px; }
        .pr-skeleton-shape.is-points { width: 56px; height: 14px; }
        @keyframes pr-shimmer { to { background-position: -200% 0; } }

        .pr-heading-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .pr-refresh-note {
          font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff59;
        }

        .pr-row { animation: pr-enter 0.35s ease both; }
        .pr-row { transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease; }
        .pr-row:hover { transform: translateX(3px); border-color: #d0ca5366; background: #ffffff08; }
        @keyframes pr-enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>

      <SiteHeader />

      <main className="pr-root">
        <aside className="pr-sidebar" aria-label="Navegación principal">
          <a href="/" className="pr-side-brand">
            <span className="pr-sidebar-logo">
              <img src="/logo-Hot.jpg" alt="" />
            </span>
            <span className="pr-side-brand-name">
              <span>HOT COFFEE</span>
              <strong>2XKO RANKING</strong>
            </span>
          </a>

          <p className="pr-sidebar-caption">Competitivo · Comunidad</p>
          <nav className="pr-sidebar-nav">
            <a href="/" className="pr-nav-link is-active" aria-current="page">
              <span>01</span> Ranking
            </a>
            <a href="/perfil" className="pr-nav-link">
              <span>02</span> Mi perfil
            </a>
            <a href="/matchmaking" className="pr-nav-link">
              <span>03</span> Matchmaking
            </a>
          </nav>

          <div className="pr-sidebar-rule" />
          <div className="pr-sidebar-season">
            TEMPORADA DE TORNEOS
            <strong>{tourneyMax || '—'}</strong>
            eventos registrados
          </div>

          <div className="pr-sidebar-actions">
            <DiscordLoginButton />
            <a className="pr-discord-link" href="https://discord.gg/8NbFuJcSCH" target="_blank" rel="noopener noreferrer">
              Unirse al Discord
            </a>
          </div>
        </aside>

        <section className="pr-main-column">
          <div className="pr-page-heading">
            <div>
              <p className="pr-page-kicker">HOT COFFEE · 2XKO</p>
              <h1 className="pr-page-title">Clasificación de jugadores</h1>
              <p className="pr-page-description">El progreso competitivo de la comunidad, en un solo lugar.</p>
            </div>
            <div className="pr-heading-right">
              <div className={`pr-status-pill is-${status}`}>
                <span className="pr-status-dot" />
                {status === 'ok' ? 'En vivo' : status === 'loading' ? 'Cargando ranking' : 'Modo sin conexión'}
              </div>
              {status === 'ok' && lastRefresh && (
                <span className="pr-refresh-note">
                  ↻ Auto · {lastRefresh.toLocaleTimeString('es-VE')}
                </span>
              )}
            </div>
          </div>

          <div className="pr-summary-grid" aria-label="Resumen del ranking">
            <div className="pr-summary-card">
              <span className="pr-summary-label">Participantes</span>
              <strong className="pr-summary-value">{players.length}</strong>
              <span className="pr-summary-detail">en el ranking de torneos</span>
            </div>
            <div className="pr-summary-card">
              <span className="pr-summary-label">Torneos registrados</span>
              <strong className="pr-summary-value">{tourneyMax || '—'}</strong>
              <span className="pr-summary-detail">eventos contabilizados</span>
            </div>
            <div className="pr-summary-card">
              <span className="pr-summary-label">Líder actual</span>
              <strong className="pr-summary-value is-name">{players[0]?.gamerTag || 'Por definir'}</strong>
              <span className="pr-summary-detail">{players[0] ? `${players[0].points} puntos` : 'A la espera de resultados'}</span>
            </div>
          </div>

        {/* Controles superiores */}
        <div className="pr-controls">
          <div className="pr-mobile-login">
            <DiscordLoginButton />
          </div>
          <div className="pr-action-btns">
            <button
              type="button"
              className={`pr-filter-toggle-btn${showRangePicker ? ' is-active' : ''}`}
              onClick={() => setShowRangePicker((prev) => !prev)}
            >
              ⚙️ {showRangePicker ? 'Ocultar Filtro' : 'Filtrar Torneos'}
            </button>

            <button className="pr-sync-btn" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Sincronizando…' : '⟳ Sincronizar'}
            </button>
            <button className="pr-export-btn" onClick={handleExportPNG} disabled={exporting}>
              {exporting ? 'Generando…' : '↓ PNG'}
            </button>
          </div>
        </div>

        {showRangePicker && (
          <div className="pr-range-picker-wrap">
            <div className="pr-range-inputs">
              <div className="pr-range-shortcuts">
                <button
                  type="button"
                  className={`pr-shortcut-btn${isAllSelected ? ' is-active' : ''}`}
                  onClick={() => selectAllTournaments(tourneyMax)}
                  disabled={!rangeReady}
                >
                  Todos ({tourneyMax})
                </button>

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
                  {Array.from({ length: tourneyTo || tourneyMax }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
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
                  {Array.from(
                    { length: tourneyMax - tourneyFrom + 1 },
                    (_, i) => tourneyFrom + i
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {status === 'offline' && !notice && (
          <div className="pr-notice">Sin conexión con la API: mostrando datos de prueba.</div>
        )}
        {notice && <div className="pr-notice">{notice}</div>}

        <div
          ref={tableRef}
          className={`pr-card${wide ? ' is-wide' : ''}${exporting ? ' is-exporting' : ''}`}
        >
          {/* <div className="pr-birthday-banner">
            🎉 ¡FELIZ CUMPLEAÑOS CHILL FEVER! 🎂🎈
          </div> */}

          <div className="pr-header">
            <div className="pr-title-area">
              <div className="pr-title">
                HOT COFFEE 2XKO<br />DISCORD RANKING
              </div>
              <div className="pr-subtitle">ORGANIZADO POR BANEADO SENSEI</div>
            </div>
            <div className="pr-logo-badge">
              <img src="/logo-Hot.jpg" alt="Hot Coffee x 2XKO" loading="lazy" />
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
                          <Avatar url={player.avatarUrl} alt={player.gamerTag} profileUrl={player.profileUrl} />
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
            {restPlayers.length === 0 && top3Players.length === 0 && status === 'loading' && (
              <div className="pr-skeleton-list" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pr-skeleton-row">
                    <span className="pr-skeleton-shape is-rank" />
                    <span className="pr-skeleton-shape is-art" />
                    <span className="pr-skeleton-lines">
                      <span className="pr-skeleton-shape is-name" />
                      <span className="pr-skeleton-shape is-tag" />
                    </span>
                    <span className="pr-skeleton-shape is-points" />
                  </div>
                ))}
              </div>
            )}

            {restPlayers.length === 0 && top3Players.length === 0 && status !== 'loading' && (
              <div className="pr-empty">Todavía no hay jugadores en el ranking.</div>
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
                      <Avatar url={player.avatarUrl} alt={player.gamerTag} profileUrl={player.profileUrl} />
                      <span className="pr-points">{player.points} PTS</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 🚀 FOOTER LIMPIO, ORDENADO Y ALINEADO */}
          <div className="pr-footer">
            <div className="pr-footer-info">
              <span>
                Pág {page} de {totalPages} ·{' '}
                {isAllSelected
                  ? `Todos los torneos (1-${tourneyMax})`
                  : activeShortcut
                  ? `Últimos ${activeShortcut} torneos`
                  : `Rango: Torneos ${tourneyFrom} al ${tourneyTo}`}
              </span>
            </div>

            <div className="pr-footer-pagination">
              <button
                className="pr-page-btn"
                disabled={page === 1}
                onClick={() => setCurrentPage(page - 1)}
                aria-label="Página anterior"
              >
                ◀ Ant
              </button>
              <span className="pr-page-info">
                {page}/{totalPages}
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

            <div className="pr-footer-right">
              <a
                href="https://discord.gg/8NbFuJcSCH"
                target="_blank"
                rel="noopener noreferrer"
                className="pr-render-badge"
                title="Unirse al servidor oficial de Discord Hot Coffee"
              >
                <svg className="pr-discord-icon" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a73.51,73.51,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c2.72-27.16-5.83-50.91-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.88,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.12,53,91,65.69,84.69,65.69Z" />
                </svg>
                <span>¡Únete al Discord!</span>
                <span className="pr-tag-highlight">From On Render</span>
              </a>

              <div className="pr-dev-credit">
                <img src="/lycan-logo.png" alt="Lycan" className="pr-dev-avatar" />
                <span>Dev: <strong>Lycan</strong></span>
              </div>
            </div>
          </div>
        </div>
        </section>

        <aside className="pr-info-panel" aria-label="Información del ranking">
          <section className="pr-info-card">
            <p className="pr-info-eyebrow">Temporada</p>
            <h2 className="pr-info-title">Puntos por torneo</h2>
            <p className="pr-info-copy">La clasificación se construye con los resultados registrados en los eventos de 2XKO.</p>
            <div className="pr-info-stat">
              <span>Filtro visible</span>
              <strong>{isAllSelected ? 'Todos' : `${tourneyFrom}–${tourneyTo}`}</strong>
            </div>
            <div className="pr-info-stat">
              <span>Eventos en temporada</span>
              <strong>{tourneyMax || '—'}</strong>
            </div>
          </section>

          <section className="pr-info-card">
            <p className="pr-info-eyebrow">En la cima</p>
            <h2 className="pr-info-title">Jugador destacado</h2>
            {players[0] ? (
              <div className="pr-leader">
                <Avatar url={players[0].avatarUrl} alt={players[0].gamerTag} profileUrl={players[0].profileUrl} />
                <div>
                  <div className="pr-leader-name">{players[0].gamerTag}</div>
                  <div className="pr-leader-points">{players[0].points} PTS · Puesto #1</div>
                </div>
              </div>
            ) : (
              <p className="pr-info-copy">El líder aparecerá cuando se carguen los resultados.</p>
            )}
            <p className="pr-info-copy">Usa el filtro de torneos para comparar el avance en distintos tramos.</p>
          </section>
        </aside>
      </main>
    </>
  );
}