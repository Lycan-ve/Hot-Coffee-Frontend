'use client';

import { useEffect, useState, useRef } from 'react';
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

export default function HotCoffeeRanking() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchRankings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rankings/2xko`);
      if (!response.ok) throw new Error('Error en la red');
      const data = await response.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando rankings, aplicando datos de prueba...', error);
      setPlayers([
        { id: 1, ranking: 1, gamerTag: 'Ñembo', sponsor: 'RZS', character: 'AKALI, YASUO', avatarUrl: '', points: 4800 },
        { id: 2, ranking: 2, gamerTag: 'GAPPY', sponsor: 'TKF', character: 'BLITZCRANK', avatarUrl: '', points: 2118 },
        { id: 3, ranking: 3, gamerTag: 'HIAMJOY', sponsor: 'HCN', character: 'DARIUS, BRAUM', avatarUrl: '', points: 1836 },
        { id: 4, ranking: 4, gamerTag: 'DELETED USER', sponsor: '', character: '2XKO_FIGHTER', avatarUrl: '', points: 1740 },
        { id: 5, ranking: 5, gamerTag: 'BANEADO SENSEI', sponsor: '', character: 'EKKO, ILAOI', avatarUrl: '', points: 1302 },
      ]);
    }
  };

  useEffect(() => {
    fetchRankings();
    setCurrentPage(1);
  }, []);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(players.length / ITEMS_PER_PAGE) || 1;
  const paginatedPlayers = players.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const top3Players = currentPage === 1 ? paginatedPlayers.slice(0, 3) : [];
  const restPlayers = currentPage === 1 ? paginatedPlayers.slice(3) : paginatedPlayers;

  const handleExportPNG = async () => {
    if (!tableRef.current) return;
    try {
      const dataUrl = await toPng(tableRef.current, { cacheBust: true, pixelRatio: 2.5 });
      const link = document.createElement('a');
      link.download = `Power-Ranking-HotCoffee-2XKO-Pag${currentPage}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al exportar la imagen:', err);
    }
  };

  const handleSync = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/sync');
      const json = await res.json();
      alert(json.message || 'Sincronizado con éxito');
      fetchRankings();
    } catch (err) {
      alert('Error al sincronizar con Start.gg');
    }
  };

  const getAvatarSrc = (url?: string) => {
    if (url && url.startsWith('http')) {
      return url;
    }
    return '/logo-hot-2xko.png';
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&display=swap');

        /* 
          MAPA DE LA NUEVA PALETA DE COLORES:
          #392415 -> Fondo café espresso profundo
          #b44d1d -> Naranja terracota intenso (Acentos y sponsors)
          #f5f5f4 -> Texto claro / Marfil neutro
          #d0ca53 -> Amarillo mostaza / Oliva claro (Top ranks / Highlights)
          #d7df8e -> Verde pistacho suave
          #cca08a -> Terracota claro / Rosa madera
          #9d958b -> Gris piedra cálido
          #738c3e -> Verde oliva profundo (Bordes y elementos de éxito)
        */

        .pr-root {
          min-height: 100vh;
          background-color: #392415;
          background-image:
            radial-gradient(circle at 50% 0%, rgba(180, 77, 29, 0.25), transparent 75%),
            repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(157, 149, 139, 0.03) 14px, rgba(157, 149, 139, 0.03) 15px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem 1rem;
          font-family: 'Barlow Condensed', sans-serif;
        }

        .pr-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 540px;
          max-width: 100%;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }

        @media (min-width: 768px) {
          .pr-controls {
            width: 920px;
          }
        }

        .pr-pagination {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .pr-page-btn {
          padding: 0.4rem 0.9rem;
          background: #392415;
          color: #f5f5f4;
          border: 1px solid rgba(204, 160, 138, 0.3);
          border-radius: 4px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pr-page-btn:hover:not(:disabled) { background: #b44d1d; color: #f5f5f4; border-color: #b44d1d; }
        .pr-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .pr-page-info { color: #cca08a; font-weight: 700; font-size: 0.95rem; }

        .pr-action-btns {
          display: flex;
          gap: 0.5rem;
        }
        .pr-sync-btn, .pr-export-btn {
          padding: 0.55rem 1rem;
          background: linear-gradient(90deg, #392415, #22150b);
          color: #f5f5f4;
          border: 1px solid #cca08a;
          border-radius: 6px;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 0.95rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .pr-sync-btn:hover, .pr-export-btn:hover { background: #b44d1d; color: #f5f5f4; border-color: #d0ca53; }

        /* Tarjeta Principal */
        .pr-card {
          width: 540px;
          max-width: 100%;
          background: #25170d;
          border: 2px solid #b44d1d;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(180, 77, 29, 0.2);
          overflow: hidden;
          position: relative;
        }

        @media (min-width: 768px) {
          .pr-card {
            width: 920px;
          }
        }

        .pr-header {
          padding: 1.75rem 1.75rem 1.2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, rgba(180, 77, 29, 0.15) 0%, transparent 100%);
          border-bottom: 1px solid rgba(204, 160, 138, 0.2);
        }
        .pr-title-area {
          display: flex;
          flex-direction: column;
        }
        .pr-title {
          font-family: 'Bebas Neue', cursive;
          font-size: 2.8rem;
          color: #f5f5f4;
          line-height: 0.92;
          letter-spacing: 0.03em;
          text-shadow: 0 4px 15px rgba(0,0,0,0.8);
        }
        .pr-subtitle {
          font-family: 'Bebas Neue', cursive;
          font-size: 1.25rem;
          color: #d0ca53;
          letter-spacing: 0.12em;
          margin-top: 6px;
          text-shadow: 0 0 10px rgba(208, 202, 83, 0.4);
        }

        .pr-logo-badge {
          width: 110px;
          height: 110px;
          background: #1a1008;
          border: 2px solid #d0ca53;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.8), 0 0 15px rgba(208, 202, 83, 0.2);
          flex-shrink: 0;
          transform: rotate(3deg);
        }
        .pr-logo-badge img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .pr-podium-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 1rem 1.2rem 0.8rem;
        }

        @media (min-width: 768px) {
          .pr-list-section {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px 14px;
            padding: 0 1.2rem 1.5rem;
          }
        }

        @media (max-width: 767px) {
          .pr-list-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 0 1.2rem 1.5rem;
          }
        }

        .pr-podium-row, .pr-row {
          position: relative;
          display: flex;
          align-items: center;
          height: 72px;
          border-radius: 8px;
          overflow: hidden;
          background: #1d120a;
          padding: 0 1rem 0 0.5rem;
        }

        .pr-podium-row.top-1 {
          background: linear-gradient(90deg, rgba(208, 202, 83, 0.25) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #d0ca53;
          box-shadow: 0 4px 18px rgba(208, 202, 83, 0.2);
        }
        .pr-podium-row.top-1::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px;
          background: #d0ca53; box-shadow: 0 0 12px #d0ca53; z-index: 3;
        }

        .pr-podium-row.top-2 {
          background: linear-gradient(90deg, rgba(215, 223, 142, 0.2) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #d7df8e;
        }
        .pr-podium-row.top-2::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: #d7df8e; box-shadow: 0 0 10px #d7df8e; z-index: 3;
        }

        .pr-podium-row.top-3 {
          background: linear-gradient(90deg, rgba(115, 140, 62, 0.25) 0%, rgba(29, 18, 10, 0.98) 75%);
          border: 1px solid #738c3e;
        }
        .pr-podium-row.top-3::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: #738c3e; box-shadow: 0 0 8px #738c3e; z-index: 3;
        }

        .pr-row {
          background: #191008;
          border: 1px solid rgba(204, 160, 138, 0.15);
        }

        .pr-podium-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(208, 202, 83, 0.3), transparent);
          margin: 0.2rem 1.2rem 0.8rem;
        }

        .pr-rank {
          position: relative;
          z-index: 3;
          font-family: 'Bebas Neue', cursive;
          font-size: 2.6rem;
          width: 44px;
          text-align: center;
          flex-shrink: 0;
          margin-left: 6px;
          line-height: 1;
        }
        .pr-rank.gold   { color: #d0ca53; text-shadow: 0 0 10px rgba(208, 202, 83, 0.6); }
        .pr-rank.silver { color: #d7df8e; text-shadow: 0 0 8px rgba(215, 223, 142, 0.5); }
        .pr-rank.bronze { color: #738c3e; text-shadow: 0 0 8px rgba(115, 140, 62, 0.6); }
        .pr-rank.white  { color: #9d958b; text-shadow: 1px 1px 4px rgba(0,0,0,0.8); }

        .pr-name-wrap {
          position: relative;
          z-index: 3;
          margin-left: 8px;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
        }

        .pr-player-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: 55%;
        }
        .pr-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1.4rem;
          font-weight: 800;
          font-style: italic;
          color: #f5f5f4;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1;
          text-shadow: 2px 2px 5px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pr-sponsor {
          color: #b44d1d;
          font-style: normal;
          font-weight: 800;
        }
        .pr-fighter-tag {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          color: #cca08a;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pr-right-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          z-index: 3;
        }

        /* Avatar de Perfil con tono cálido */
        .pr-user-avatar-frame {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 2px solid #d0ca53;
          background: #1a1008;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(208, 202, 83, 0.3);
          flex-shrink: 0;
        }

        .pr-user-avatar-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Bloque de Puntos con tonos mostaza y terracota */
        .pr-points {
          font-family: 'Bebas Neue', cursive;
          font-size: 1.4rem;
          color: #392415;
          background: #d0ca53;
          border: 1px solid #b8b245;
          padding: 3px 12px;
          border-radius: 6px;
          letter-spacing: 0.05em;
          text-shadow: none;
          box-shadow: 0 0 12px rgba(208, 202, 83, 0.3);
          white-space: nowrap;
          font-weight: 800;
        }

        .pr-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.7rem 1.2rem 0.9rem;
          border-top: 1px solid rgba(204, 160, 138, 0.2);
          background: rgba(37, 23, 13, 0.7);
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          color: #cca08a;
          text-transform: uppercase;
        }
      `}</style>

      <main className="pr-root">
        <div className="pr-controls">
          <div className="pr-pagination">
            <button
              className="pr-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ◀ Ant
            </button>
            <span className="pr-page-info">
              Pág {currentPage} / {totalPages}
            </span>
            <button
              className="pr-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Sig ▶
            </button>
          </div>

          <div className="pr-action-btns">
            <button className="pr-sync-btn" onClick={handleSync}>
              ⟳ Sincronizar
            </button>
            <button className="pr-export-btn" onClick={handleExportPNG}>
              ↓ PNG
            </button>
          </div>
        </div>

        <div ref={tableRef} className="pr-card">
          <div className="pr-header">
            <div className="pr-title-area">
              <div className="pr-title">
                HOT COFFEE 2XKO<br />DISCORD RANKING
              </div>
              <div className="pr-subtitle">ORGANIZADO POR BANEADO SENSEI</div>
            </div>
            <div className="pr-logo-badge">
              <img
                src="/logo-hot.jpg"
                alt="Hot Coffee x 2XKO"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>
          </div>

          {/* 1. SECCIÓN PODIO (Top 1, 2, 3) */}
          {currentPage === 1 && top3Players.length > 0 && (
            <>
              <div className="pr-podium-section">
                {top3Players.map((player) => {
                  const isTop1 = player.ranking === 1;
                  const isTop2 = player.ranking === 2;

                  const podiumClass = [
                    'pr-podium-row',
                    isTop1 ? 'top-1' : isTop2 ? 'top-2' : 'top-3',
                  ].join(' ');

                  const rankClass = isTop1 ? 'pr-rank gold' : isTop2 ? 'pr-rank silver' : 'pr-rank bronze';

                  return (
                    <div key={player.id} className={podiumClass}>
                      <span className={rankClass}>{player.ranking}</span>

                      <div className="pr-name-wrap">
                        <div className="pr-player-info">
                          <span className="pr-name">
                            {player.sponsor && (
                              <span className="pr-sponsor">{player.sponsor} |</span>
                            )}
                            {player.gamerTag}
                          </span>
                          <span className="pr-fighter-tag">{player.character}</span>
                        </div>

                        <div className="pr-right-group">
                          <div className="pr-user-avatar-frame">
                            <img
                              src={getAvatarSrc(player.avatarUrl)}
                              alt={player.gamerTag}
                              onError={(e) => {
                                e.currentTarget.src = '/logo.png';
                              }}
                            />
                          </div>
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

          {/* 2. SECCIÓN LISTA GENERAL */}
          <div className="pr-list-section">
            {restPlayers.map((player) => (
              <div key={player.id} className="pr-row">
                <span className="pr-rank white">{player.ranking}</span>

                <div className="pr-name-wrap">
                  <div className="pr-player-info">
                    <span className="pr-name">
                      {player.sponsor && (
                        <span className="pr-sponsor">{player.sponsor} |</span>
                      )}
                      {player.gamerTag}
                    </span>
                    <span className="pr-fighter-tag">{player.character}</span>
                  </div>

                  <div className="pr-right-group">
                    <div className="pr-user-avatar-frame">
                      <img
                        src={getAvatarSrc(player.avatarUrl)}
                        alt={player.gamerTag}
                        onError={(e) => {
                          e.currentTarget.src = '/logo.png';
                        }}
                      />
                    </div>
                    <span className="pr-points">{player.points} PTS</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pr-footer">
            <span>Página {currentPage} de {totalPages}</span>
            <span>Hot Coffee 2XKO Circuit</span>
          </div>
        </div>
      </main>
    </>
  );
}