'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { fuseIconUrl, type MeResponse, type ProfileFight, type ProfileTeam, type ProfileTournament } from "@/lib/auth";
import { displayName } from "./DiscordLogin";
import { RankBadge, SectionTitle, Stat } from "./shared";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Hace un momento";
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
};

function TeamIcons({ team }: { team: ProfileTeam }) {
  return (
    <span className="hc-team">
      {[team.point, team.assist].map((c) =>
        c?.id ? <img key={c.id} src={`/fighters/${encodeURIComponent(c.id)}.png`} alt={c.name} title={c.name} /> : null,
      )}
      {team.fuse?.id ? <img className="fuse" src={fuseIconUrl(team.fuse.id)} alt={team.fuse.name} title={team.fuse.name} /> : null}
    </span>
  );
}

function FightRow({ fight, index }: { fight: ProfileFight; index: number }) {
  const win = fight.result === "WIN";
  return (
    <div className="match-row">
      <span className={`result-stripe ${win ? "win" : "loss"}`} />
      <span className="match-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="match-result">
        <strong className={win ? "success" : "danger"}>{win ? "Victoria" : "Derrota"}</strong>
        <span>Matchmaking · FT{fight.targetFT}</span>
      </div>
      <div className="opponent">
        <span>VS.</span>
        {fight.opponentAvatar ? (
          <img className="mini-avatar" src={fight.opponentAvatar} alt="" />
        ) : (
          <div className="mini-avatar">{fight.opponentTag?.[0] ?? "?"}</div>
        )}
        <strong>{fight.opponentTag}</strong>
        {fight.playerTeam ? <TeamIcons team={fight.playerTeam} /> : null}
      </div>
      <strong className="score">
        {fight.scoreFor} — {fight.scoreAgainst}
      </strong>
      <span className="match-time">{fmtDate(fight.playedAt)}</span>
    </div>
  );
}

export function PlayerProfile({ me, own }: { me: MeResponse; own: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const name = displayName(me);
  const { stats, rank } = me;
  const fights = me.fights ?? [];
  const tournaments = me.tournaments ?? [];

  // Torneos ordenados por puesto: 1.º, 2.º, 3.º... Los históricos sin
  // placement real se ordenan por los puntos equivalentes; los puestos
  // desconocidos van al final. Desempates: puntos y evento más reciente.
  const orderedTournaments = useMemo(() => {
    const rankOf = (t: ProfileTournament) => {
      if (t.placement && t.placement > 0) return t.placement;
      switch (t.points) {
        case 100: return 1;
        case 70: return 2;
        case 50: return 3;
        case 35: return 4;
        case 20: return 5;
        case 10: return 7;
        default: return 999;
      }
    };
    return [...tournaments].sort((a, b) => {
      const ra = rankOf(a);
      const rb = rankOf(b);
      if (ra !== rb) return ra - rb;
      if (b.points !== a.points) return b.points - a.points;
      return b.eventId - a.eventId;
    });
  }, [tournaments]);
  const games = stats.wins + stats.losses;
  const winRate = games ? Math.round((stats.wins / games) * 100) : 0;
  const titles = tournaments.filter((t) => t.isWinner).length;
  const tournamentPoints = tournaments.reduce((n, t) => n + (t.points || 0), 0);
  let streak = 0;
  for (const f of fights) {
    if (f.result === fights[0]?.result) streak++;
    else break;
  }
  const streakWin = fights[0]?.result === "WIN";
  const progress = Math.round(Math.min(1, Math.max(0, rank.progress > 1 ? rank.progress / 100 : rank.progress)) * 100);
  const visible = showAll ? fights : fights.slice(0, 4);

  return (
    <main className="page profile-page">
      <section className="hero profile-hero">
        <div className="hero-copy">
          <SectionTitle
            eyebrow="IDENTIDAD COMPETITIVA / 2026"
            title={own ? "MI PERFIL" : "PERFIL DE JUGADOR"}
            copy={own ? "Tu trayectoria, tu rango y cada pelea que te trajo hasta aquí." : `La trayectoria competitiva de ${name}.`}
          />
        </div>
        <div className="hero-motto">
          <span>EL GRIND NUNCA PARA</span>
          <strong>BUEN CAFÉ. MEJORES COMBOS.</strong>
        </div>
      </section>

      <section className="profile-grid">
        <article className="player-card cut-panel">
          <div className="player-backdrop" />
          <div className="player-card-top">
            {own ? (
              <span className="online">
                <i /> CONECTADO
              </span>
            ) : (
              <Link href="/" className="icon-button">
                ← RANKING
              </Link>
            )}
          </div>
          <div className="player-identity">
            <RankBadge rank={rank} />
            <div className="identity-copy">
              <span>
                {rank.displayName.toUpperCase()}
                {stats.rankingPosition > 0 ? ` · #${stats.rankingPosition} DE LA LIGA` : ""}
              </span>
              <h2>{name.toUpperCase()}</h2>
              <p>@{me.user.username}</p>
              <div className="level">
                <span style={{ width: `${progress}%` }} />
                <small>
                  {rank.isRp ? `${rank.rp} RP` : `${rank.lp} LP · faltan ${rank.lpToNext} para ${rank.next}`}
                </small>
              </div>
            </div>
          </div>
          <div className="player-meta">
            <div>
              <small>PUNTOS</small>
              <strong>{stats.points}</strong>
            </div>
            <div>
              <small>TORNEOS</small>
              <strong>{tournaments.length}</strong>
            </div>
            <div>
              <small>TÍTULOS</small>
              <strong className="success">{titles}</strong>
            </div>
          </div>
        </article>

        <div className="stats-stack">
          <div className="stats-row">
            <Stat label="PUNTOS DE LIGA" value={String(stats.points)} note={`${tournamentPoints} de torneos`} tone="gold" />
            <Stat
              label="POSICIÓN GLOBAL"
              value={stats.rankingPosition > 0 ? `#${String(stats.rankingPosition).padStart(2, "0")}` : "—"}
              note={stats.rankingPosition > 0 ? "En la clasificación" : "Sin clasificar aún"}
            />
          </div>
          <article className="season-card panel">
            <div className="panel-heading">
              <h3>RENDIMIENTO EN MATCHMAKING</h3>
              <span>{games} SETS</span>
            </div>
            <div className="performance">
              <div className="win-rate">
                <strong>
                  {winRate}
                  <small>%</small>
                </strong>
                <span>VICTORIAS</span>
              </div>
              <div className="performance-bars">
                <div>
                  <span>{stats.wins} VICTORIAS</span>
                  <i>
                    <b style={{ width: `${winRate}%` }} />
                  </i>
                </div>
                <div>
                  <span>{stats.losses} DERROTAS</span>
                  <i>
                    <b className="loss" style={{ width: `${games ? 100 - winRate : 0}%` }} />
                  </i>
                </div>
                <p>
                  {fights.length ? (
                    <>
                      Racha actual <strong>{streak} {streakWin ? "victorias" : "derrotas"}</strong>
                    </>
                  ) : (
                    "Todavía no hay sets registrados."
                  )}
                </p>
              </div>
            </div>
          </article>
        </div>

        <aside className="duo-card panel">
          <div className="panel-heading">
            <h3>CUENTA DE DISCORD</h3>
            <span>{own ? "TÚ" : "JUGADOR"}</span>
          </div>
          <div className="duo-player">
            {me.user.avatarUrl ? <img className="avatar" src={me.user.avatarUrl} alt="" /> : <div className="avatar">{name[0]}</div>}
            <div>
              <strong>{name}</strong>
              <span>@{me.user.username}</span>
            </div>
            <span className="online-dot" />
          </div>
          <div className="duo-record">
            <div>
              <small>SETS</small>
              <strong>{games}</strong>
            </div>
            <div>
              <small>WIN RATE</small>
              <strong>{winRate}%</strong>
            </div>
          </div>
          <Link href={own ? "/matchmaking" : "/"} className="secondary-button">
            {own ? "BUSCAR PARTIDA" : "VOLVER AL RANKING"}
          </Link>
        </aside>
      </section>

      <section className="bottom-grid">
        <article className="panel history">
          <div className="panel-heading">
            <div>
              <h3>HISTORIAL RECIENTE</h3>
              <span>{own ? "TUS" : "SUS"} ÚLTIMOS ENFRENTAMIENTOS</span>
            </div>
            {fights.length > 4 && (
              <button type="button" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "VER MENOS" : `VER TODO (${fights.length}) →`}
              </button>
            )}
          </div>
          <div className="match-list">
            {fights.length === 0 ? (
              <p className="hc-empty">Aún no hay peleas de matchmaking registradas.</p>
            ) : (
              visible.map((f, i) => <FightRow key={f.id} fight={f} index={i} />)
            )}
          </div>
        </article>
        <aside className="panel achievements">
          <div className="panel-heading">
            <h3>TORNEOS</h3>
            <span>{titles} TÍTULOS</span>
          </div>
          {tournaments.length === 0 ? (
            <p className="hc-empty">Sin torneos registrados.</p>
          ) : (
            <div className="hc-tournaments">
              {orderedTournaments.map((t) => (
                <a
                  key={t.eventId}
                  className={`achievement ${t.isWinner ? "featured" : ""}`}
                  href={`https://www.start.gg/tournament/${t.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.image ? (
                    <span className="hc-tournament-icon">
                      <img src={t.image} alt="" loading="lazy" />
                    </span>
                  ) : (
                    {t.image ? (
                    <span className="hc-tournament-icon">
                      <img src={t.image} alt={t.name} loading="lazy" />
                    </span>
                  ) : (
                    <span>{t.isWinner ? "★" : "◆"}</span>
                  )}
                  )}
                  <div>
                    <strong>{t.name}</strong>
                    <p>{t.placementLabel}</p>
                  </div>
                  <b>+{t.points}</b>
                </a>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
