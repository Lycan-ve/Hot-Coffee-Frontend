'use client';

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { fuseIconUrl, type MeResponse, type ProfileFight, type ProfileTeam, type ProfileTournament } from "@/lib/auth";
import { displayName } from "./DiscordLogin";
import { RankBadge, SectionTitle, Stat } from "./shared";
import { MainsPanel } from "./MainsPanel";

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

// Puesto equivalente de un torneo: el real si existe, o el que sugieren los
// puntos de los resultados históricos (999 = desconocido).
function rankOf(t: ProfileTournament): number {
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
}

function TournamentLink({ t, featured }: { t: ProfileTournament; featured?: boolean }) {
  return (
    <a
      className={`achievement ${t.isWinner || featured ? "featured" : ""}`}
      href={`https://www.start.gg/tournament/${t.slug}`}
      target="_blank"
      rel="noreferrer"
    >
      {t.image ? (
        <span className="hc-tournament-icon">
          <img src={t.image} alt="" loading="lazy" />
        </span>
      ) : (
        <span>{t.isWinner ? "★" : "◆"}</span>
      )}
      <div>
        <strong>{t.name}</strong>
        <p>{t.placementLabel}</p>
      </div>
      <b>+{t.points}</b>
    </a>
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
  const tournamentPoints = stats.tournamentPoints ?? tournaments.reduce((n, t) => n + (t.points || 0), 0);
  const tournamentPosition = stats.tournamentPosition ?? 0;
  // Torneos donde el jugador destacó: títulos y podios (top 3).
  const highlights = orderedTournaments.filter((t) => t.isWinner || rankOf(t) <= 3);
  const fmtPos = (n: number) => (n > 0 ? "#" + String(n).padStart(2, "0") : "—");
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
          <div className="player-identity" style={{ "--rank-accent": rank.color } as CSSProperties}>
            <RankBadge rank={rank} />
            <div className="identity-copy">
              <h2>{name.toUpperCase()}</h2>
              <div className="rank-line">
                <span className="rank-text">{rank.displayName.toUpperCase()}</span>
                <i className="dot">•</i>
                <span className="lp-text">
                  {rank.isRp ? String(rank.rp) + " RP" : String(rank.lp) + " LP"}
                </span>
              </div>
              <div className="meter">
                <span style={{ width: String(progress) + "%" }} />
              </div>
              <small className="meter-note">
                {rank.isRp
                  ? rank.next
                    ? "FALTAN " + rank.lpToNext + " RP PARA " + rank.next.toUpperCase()
                    : "RANGO MÁXIMO"
                  : "FALTAN " + rank.lpToNext + " LP PARA " + rank.next.toUpperCase()}
              </small>
              <p>
                @{me.user.username}
                {stats.rankingPosition > 0 ? " · #" + stats.rankingPosition + " DE LA LIGA" : ""}
              </p>
            </div>
            <span className="identity-sep" />
            <div className="identity-stats">
              <div>
                <strong>{stats.wins}</strong>
                <small>WINS</small>
              </div>
              <div>
                <strong>{stats.losses}</strong>
                <small>LOSSES</small>
              </div>
              <div>
                <strong className="wr">{winRate}%</strong>
                <small>WINRATE</small>
              </div>
            </div>
          </div>
        </article>

        <div className="stats-stack">
          <div className="stats-row">
            <Stat label="PUNTOS DE LIGA" value={String(stats.points)} note="MATCHMAKING" tone="gold" />
            <Stat
              label="POSICIÓN EN LA LIGA"
              value={stats.rankingPosition > 0 ? `#${String(stats.rankingPosition).padStart(2, "0")}` : "—"}
              note={stats.rankingPosition > 0 ? "RANKING MATCHMAKING" : "SIN CLASIFICAR AÚN"}
            />
          </div>
          <MainsPanel me={me} own={own} />
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
        {/* Zona TORNEOS (verde): todo lo relacionado al ranking de torneos */}
        <article className="panel zone zone-tournaments">
          <div className="panel-heading">
            <div>
              <h3>
                <i className="zone-dot" />
                TORNEOS
              </h3>
              <span>{own ? "TU" : "SU"} CARRERA EN START.GG</span>
            </div>
            <span>{titles} TÍTULOS</span>
          </div>
          <div className="zone-stats">
            <div>
              <small>PUNTOS DE TORNEOS</small>
              <strong className="gold">{tournamentPoints}</strong>
            </div>
            <div>
              <small>POSICIÓN EN LA TABLA</small>
              <strong>{fmtPos(tournamentPosition)}</strong>
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
          {highlights.length > 0 && (
            <>
              <div className="zone-subheading">TORNEOS EN LOS QUE {own ? "HAS" : "HA"} DESTACADO</div>
              <div className="hc-tournaments">
                {highlights.map((t) => (
                  <TournamentLink key={t.eventId} t={t} featured />
                ))}
              </div>
            </>
          )}
          <div className="zone-subheading">HISTORIAL DE TORNEOS</div>
          {tournaments.length === 0 ? (
            <p className="hc-empty">Sin torneos registrados.</p>
          ) : (
            <div className="hc-tournaments">
              {orderedTournaments.map((t) => (
                <TournamentLink key={t.eventId} t={t} />
              ))}
            </div>
          )}
        </article>

        {/* Zona MATCHMAKING (azul): rendimiento, puntos, posición y combates */}
        <article className="panel zone zone-matchmaking">
          <div className="panel-heading">
            <div>
              <h3>
                <i className="zone-dot" />
                MATCHMAKING
              </h3>
              <span>RENDIMIENTO EN LA COLA /FT</span>
            </div>
            <span>{games} SETS</span>
          </div>
          <div className="zone-stats zone-stats-mm">
            <div>
              <small>PUNTOS DE LIGA</small>
              <strong className="gold">{stats.points}</strong>
            </div>
            <div>
              <small>POSICIÓN EN LA TABLA</small>
              <strong>{fmtPos(stats.rankingPosition)}</strong>
            </div>
            <div>
              <small>WIN RATE</small>
              <strong>{winRate}%</strong>
            </div>
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
                  <b style={{ width: winRate + "%" }} />
                </i>
              </div>
              <div>
                <span>{stats.losses} DERROTAS</span>
                <i>
                  <b className="loss" style={{ width: (games ? 100 - winRate : 0) + "%" }} />
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
          <div className="zone-subheading">HISTORIAL DE COMBATES</div>
          <div className="match-list">
            {fights.length === 0 ? (
              <p className="hc-empty">Aún no hay peleas de matchmaking registradas.</p>
            ) : (
              visible.map((f, i) => <FightRow key={f.id} fight={f} index={i} />)
            )}
          </div>
          {fights.length > 4 && (
            <div className="zone-more">
              <button type="button" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "VER MENOS" : "VER TODO (" + fights.length + ") →"}
              </button>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
