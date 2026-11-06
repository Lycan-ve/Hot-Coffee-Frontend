'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import RankingRow, { RankPlayer } from '@/components/RankingRow';
import PodiumRow from '@/components/PodiumRow';
import FiltersBar from '@/components/FiltersBar';
import InfoCard from '@/components/InfoCard';
import Pagination from '@/components/Pagination';

const fallback: RankPlayer[] = [
  { id: 1, ranking: 1, gamerTag: 'ÑEMBO', sponsor: 'RZS', character: 'Yasuo + Samira + Fuse', points: 890 },
  { id: 2, ranking: 2, gamerTag: 'GAPPY', sponsor: 'TKF', character: 'Blitzcrank + Braum', points: 740 },
  { id: 3, ranking: 3, gamerTag: 'HIAMJOY', sponsor: 'HCN', character: 'Darius + Illaoi', points: 620 },
  { id: 4, ranking: 4, gamerTag: 'MIKU', sponsor: 'FKC', character: 'Ahri + Ekko', points: 560 },
  { id: 5, ranking: 5, gamerTag: 'KIRITO', sponsor: 'RZS', character: 'Yasuo + Ekko', points: 510 },
  { id: 6, ranking: 6, gamerTag: 'SENPAI', character: 'Jinx + Vi', points: 480 },
  { id: 7, ranking: 7, gamerTag: 'NOVA', sponsor: 'HCN', character: 'Caitlyn + Lux', points: 445 },
  { id: 8, ranking: 8, gamerTag: 'ZETA', character: 'Akali + Senna', points: 420 },
  { id: 9, ranking: 9, gamerTag: 'BANEADO', sponsor: 'FKC', character: 'Sett + Darius', points: 390 },
  { id: 10, ranking: 10, gamerTag: 'KUMA', character: 'Braum + Warwick', points: 360 },
  { id: 11, ranking: 11, gamerTag: 'RAVEN', character: 'Thresh + Samira', points: 330 },
  { id: 12, ranking: 12, gamerTag: 'ORBIT', character: 'Lux + Ahri', points: 300 },
];

export default function Home() {
  const [players, setPlayers] = useState<RankPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/rankings/2xko?from=${from}&to=${to}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        const nextPlayers = Array.isArray(data) && data.length ? data : fallback;
        setPlayers(nextPlayers.sort((a: RankPlayer, b: RankPlayer) => a.ranking - b.ranking));
      })
      .catch(() => setPlayers(fallback))
      .finally(() => setLoading(false));
  }, [from, to, refresh]);

  const list = useMemo(() => (players.length ? players : fallback), [players]);
  const total = Math.max(1, Math.ceil(list.length / 10));
  const shown = list.slice((page - 1) * 10, page * 10);
  const podium = page === 1 ? shown.slice(0, 3) : [];
  const rows = page === 1 ? shown.slice(3) : shown;
  const maxPoints = Math.max(...shown.map((p) => p.points), 1);
  const selectRange = (setter: (value: number) => void) => (value: number) => {
    setter(value);
    setPage(1);
  };

  const handleSync = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setRefresh((value) => value + 1);
      setToast('SINCRONIZACIÓN COMPLETADA · PUNTOS ACTUALIZADOS');
      window.setTimeout(() => setToast(null), 3000);
    }, 1200);
  };

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="site-main">
        <div className="content-column">
          <section className="hero" aria-labelledby="ranking-title">
            <div>
              <span className="eyebrow">TEMPORADA DE TORNEOS · 2026</span>
              <h1 id="ranking-title">HOT COFFEE <em>2XKO</em><br /><span>RANKING</span></h1>
              <p>LA CLASIFICACIÓN COMPETITIVA DE LA COMUNIDAD.</p>
            </div>
            <div className="live-pill" aria-live="polite"><i /> {loading ? 'CARGANDO' : 'EN VIVO'}</div>
          </section>

          <FiltersBar from={from} to={to} onFrom={selectRange(setFrom)} onTo={selectRange(setTo)} syncing={syncing} onSync={handleSync} />

          <section className="ranking-board" aria-labelledby="board-title">
            <div className="board-heading">
              <div><span className="eyebrow">TOP 3 · TEMPORADA ACTUAL</span><h2 id="board-title">LOS QUE MANDAN</h2></div>
              <span className="board-count">{list.length} JUGADORES</span>
            </div>
            <div className="podium-list">{podium.map((player) => <PodiumRow key={player.ranking} player={player} />)}</div>
            <div className="list-heading" aria-hidden="true"><span>POSICIÓN / JUGADOR</span><span>EQUIPO</span><span>PUNTOS</span></div>
            <div className="ranking-list">
              {loading ? [1, 2, 3, 4].map((item) => <div key={item} className="skeleton-row" aria-label="Cargando jugador" />) : rows.length ? rows.map((player) => <RankingRow key={player.ranking} player={player} maxPoints={maxPoints} />) : <div className="empty-state">NO HAY JUGADORES EN ESTE RANGO.</div>}
            </div>
            <div className="board-footer"><span>10 POR PÁGINA</span><Pagination page={page} total={total} onChange={setPage} /></div>
          </section>
        </div>

        <aside className="sidebar" aria-label="Resumen de la temporada">
          <InfoCard eyebrow="RESUMEN" title="TEMPORADA"><div className="stat-line"><span>PARTICIPANTES</span><b>{list.length || 56}</b></div><div className="stat-line"><span>TORNEOS REGISTRADOS</span><b>22</b></div></InfoCard>
          <InfoCard eyebrow="EN LA CIMA" title="JUGADOR DESTACADO"><div className="featured"><div className="featured-avatar"><img src="/logo-Hot.jpg" alt="Logo Hot Coffee" /></div><div><strong>{list[0]?.gamerTag || 'ÑEMBO'}</strong><span>{list[0]?.points || 890} PTS · PUESTO #1</span></div></div></InfoCard>
          <div className="discord-card"><span className="eyebrow">COMUNIDAD</span><h2>ENTRA AL LOBBY</h2><p>RANKED, TORNEOS Y CAFÉ.</p><a href="https://discord.com" target="_blank" rel="noreferrer">ÚNETE AL DISCORD</a></div>
        </aside>
      </main>
      <footer><span>ORGANIZADO POR BANEADO SENSEI / DEV: LYCAN</span><b>HECHO EN COMUNIDAD · JUGADO CON CARÁCTER.</b><span>2XKO · HOT COFFEE</span></footer>
      {toast && <div className="toast" role="status"><i />{toast}</div>}
    </div>
  );
}
