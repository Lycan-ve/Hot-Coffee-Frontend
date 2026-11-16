'use client';

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fuseIconUrl, rankIconFallbackUrl, rankIconUrl, saveCountry, type MeResponse, type ProfileFight, type ProfileTeam, type ProfileTournament } from "@/lib/auth";
import { displayName } from "./DiscordLogin";
import { A, PlayerFlag, SectionTitle, flagEmoji } from "./shared";
import { MainsPanel } from "./MainsPanel";
import { RankFx } from "./RankFx";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const name = displayName(me);
  // Estado de Discord en vivo: punto de color, etiqueta y JUGANDO X.
  const presenceStatus = me.presence?.status ?? "offline";
  const presenceLabel =
    presenceStatus === "online" ? "EN LÍNEA"
    : presenceStatus === "idle" ? "INACTIVO"
    : presenceStatus === "dnd" ? "NO MOLESTAR"
    : "DESCONECTADO";
  const activity = presenceStatus === "offline" ? "" : (me.presence?.activity ?? "").trim();
  const { stats, rank } = me;
  // Clasificación: nadie parte con rango; sin los 5 primeros sets el backend
  // manda el display "SIN RANGO" (sin iconPath).
  const unplaced = rank.placed === false;
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
  // Sin clasificación completada, la barra muestra el avance de los 5 sets.
  const progress = unplaced
    ? Math.round((Math.min(games, 5) / 5) * 100)
    : Math.round(Math.min(1, Math.max(0, rank.progress > 1 ? rank.progress / 100 : rank.progress)) * 100);
  const visible = showAll ? fights : fights.slice(0, 4);

  return (
    <main className="page profile-page">
      <section className="hero profile-hero">
        <div className="hero-copy">
          <SectionTitle
            eyebrow="IDENTIDAD COMPETITIVA / 2026"
            title={own ? "TU PERFIL" : "PERFIL DE"}
            accent={name.toUpperCase()}
            copy={own ? "Consulta tu rango, configura tu equipo y revisa tus resultados." : `Rango, equipo e historial competitivo de ${name}.`}
          />
        </div>
        <div className="hero-motto">
          <span>EL GRIND NUNCA PARA</span>
          <strong>BUEN CAFÉ. MEJORES COMBOS.</strong>
        </div>
      </section>

      {own ? (
        <section className={`profile-next-step panel ${unplaced ? "is-placing" : "is-ranked"}`} aria-labelledby="profile-next-title">
          <div className="profile-next-copy">
            <span className="profile-next-kicker">TU SIGUIENTE PASO</span>
            <h2 id="profile-next-title">
              {unplaced ? "Completa tus 5 sets de clasificación" : "Sigue avanzando en tu rango"}
            </h2>
            <p>
              {unplaced
                ? `Llevas ${Math.min(games, 5)} de 5 sets. Completa los que faltan para recibir tu primer rango.`
                : `Tu rango actual es ${rank.displayName}. Busca un rival para seguir sumando puntos y avanzar en la clasificación.`}
            </p>
            {unplaced ? (
              <>
                <div className="profile-placement-progress" role="progressbar" aria-valuenow={Math.min(games, 5)} aria-valuemin={0} aria-valuemax={5} aria-label="Sets de clasificación completados">
                  <span style={{ width: String(progress) + "%" }} />
                </div>
                <small>{Math.max(0, 5 - games)} sets para obtener tu rango</small>
              </>
            ) : (
              <small>{rank.isRp ? `${rank.rp} RP acumulados` : `${rank.lp} LP en tu división actual`}</small>
            )}
          </div>
          <div className="profile-next-actions">
            <Link href="/matchmaking" className="profile-next-primary">BUSCAR PARTIDA <span aria-hidden="true">→</span></Link>
            <a href="#equipo-principal" className="profile-next-secondary">
              {me.mains ? "REVISAR MI EQUIPO" : "CONFIGURAR MI EQUIPO"}
            </a>
          </div>
        </section>
      ) : null}

      <section className="profile-grid">
        <article className="player-card cut-panel">
          <div className="player-backdrop" />
          <div className="player-card-top">
            {own ? (
              <span className="online"><i /> TU PERFIL</span>
            ) : (
              <span className="profile-public-label">PERFIL PÚBLICO</span>
            )}
            <div className="card-top-right">
              {!own ? (
                <Link href="/" className="icon-button">
                  ← RANKING
                </Link>
              ) : null}
              <span className="live-badge">HOT COFFEE · 2XKO</span>
            </div>
          </div>
          <div className="player-identity" style={{ "--rank-accent": rank.color } as CSSProperties}>
            <div className="rank-emblem rfx-host" aria-label={"Rango " + rank.displayName}>
              {/* Sin rango aún: insignia genérica, nunca la de una división. */}
              {rank.iconPath ? (
                <>
                  {/* Aura Rank FX: capas detrás y delante de la insignia, */}
                  {/* con los colores y la potencia del rango actual. */}
                  <RankFx rank={rank} variant="badge" layer="back" />
                  <img
                    alt=""
                    src={rankIconUrl(rank.iconPath)}
                    onError={(event) => {
                      const fb = rankIconFallbackUrl(rank.iconPath);
                      if (event.currentTarget.src !== fb) event.currentTarget.src = fb;
                    }}
                  />
                  <RankFx rank={rank} variant="badge" layer="front" />
                </>
              ) : (
                <img alt="" src="/assets/Aspirant_icon.png" />
              )}
              {rank.isRp && rank.divisionIndex !== undefined ? (
                <span className="division-badge" aria-label={"División " + rank.divisionIndex}>
                  {rank.divisionIndex}
                </span>
              ) : null}
              {rank.isRp && stats.rankingPosition > 0 ? (
                <span className="top-chip">TOP {String(stats.rankingPosition).padStart(2, "0")}</span>
              ) : null}
            </div>
            <div className="rank-copy">
              <span>RANGO ACTUAL</span>
              <div className="player-name-row">
                <div className="player-name">{name}</div>
                {own ? (
                  <button
                    type="button"
                    className="flag-edit"
                    title={me.user.country ? "Cambiar tu nacionalidad" : "Elegir tu nacionalidad"}
                    onClick={() => setPickerOpen(true)}
                  >
                    {me.user.country ? <PlayerFlag country={me.user.country} state={me.user.state} /> : "🌍+"}
                  </button>
                ) : me.user.country ? (
                  <PlayerFlag country={me.user.country} state={me.user.state} />
                ) : null}
              </div>
              <div className="rank-line">
                <span>{unplaced ? "SIN RANGO" : rank.displayName.toUpperCase()}</span>
                <i />
                <strong>
                  {unplaced ? `CLASIFICANDO ${Math.min(games, 5)}/5` : `${rank.isRp ? rank.rp : rank.lp} ${rank.isRp ? "RP" : "LP"}`}
                </strong>
                {stats.rankingPosition > 0 && (
                  <>
                    <i />
                    <b>#{String(stats.rankingPosition).padStart(2, "0")}</b>
                  </>
                )}
              </div>
              <div className="progress-head">
                <small>{unplaced ? "CLASIFICACIÓN" : "PROGRESO DE DIVISIÓN"}</small>
                <b>{progress}%</b>
              </div>
              <div className="progress-bar">
                <span style={{ width: String(progress) + "%" }} />
              </div>
              <p className="rank-next">
                {unplaced ? (
                  <>
                    TE FALTAN <strong>{Math.max(0, 5 - games)} SETS</strong> PARA OBTENER RANGO
                  </>
                ) : rank.next ? (
                  <>
                    FALTAN{" "}
                    <strong>
                      {rank.lpToNext} {rank.isRp ? "RP" : "LP"}
                    </strong>{" "}
                    PARA {rank.next.toUpperCase()}
                  </>
                ) : (
                  <strong>RANGO MÁXIMO ALCANZADO</strong>
                )}
              </p>
            </div>
            <div className="identity-sep" />
            <div className="stats-col">
              <div className="stat-item">
                <b>{String(stats.wins).padStart(2, "0")}</b>
                <small>VICTORIAS</small>
              </div>
              <div className="stat-item">
                <b>{String(stats.losses).padStart(2, "0")}</b>
                <small>DERROTAS</small>
              </div>
              <div className="stat-item">
                <b className="wr">{winRate}%</b>
                <small>WIN RATE</small>
              </div>
            </div>
          </div>
        </article>

        {pickerOpen ? <CountryPicker current={me.user.country ?? ""} onClose={() => setPickerOpen(false)} /> : null}

        <MainsPanel me={me} own={own} />

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
              <small className="presence-status" data-status={presenceStatus}>
                {presenceLabel}
              </small>
            </div>
            <span className="online-dot" data-status={presenceStatus} />
          </div>
          {activity ? (
            <div className="presence-activity">
              <i />
              <span>
                JUGANDO <strong>{activity.toUpperCase()}</strong>
              </span>
            </div>
          ) : null}
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
              <span>{own ? "TUS RESULTADOS EN TORNEOS" : "RESULTADOS EN TORNEOS"}</span>
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
            <p className="hc-empty">{own ? "Cuando participes en un torneo procesado, tus resultados aparecerán aquí." : "Este jugador todavía no tiene torneos registrados."}</p>
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
              <span>SETS FT 3 JUGADOS DESDE LA WEB</span>
            </div>
            <span>{games} SETS</span>
          </div>
          <div className="zone-stats zone-stats-mm">
            <div>
              <small>PUNTOS DE LIGA</small>
              <strong className="gold">{unplaced ? "—" : stats.points}</strong>
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
              <div className="profile-empty-help">
                <p>{own ? "Todavía no tienes sets registrados. Busca tu primera partida para empezar con tus 5 sets de clasificación." : "Este jugador todavía no tiene sets de matchmaking registrados."}</p>
                {own ? <Link href="/matchmaking">Buscar mi primera partida →</Link> : null}
              </div>
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

// Países disponibles (ISO 3166-1 alpha-2) — misma lista que valida el backend.
const COUNTRIES: Array<[string, string]> = [
  ["AR", "Argentina"], ["BO", "Bolivia"], ["BR", "Brasil"], ["CA", "Canadá"],
  ["CL", "Chile"], ["CO", "Colombia"], ["CR", "Costa Rica"], ["CU", "Cuba"],
  ["DO", "República Dominicana"], ["EC", "Ecuador"], ["SV", "El Salvador"],
  ["GT", "Guatemala"], ["HN", "Honduras"], ["MX", "México"], ["NI", "Nicaragua"],
  ["PA", "Panamá"], ["PY", "Paraguay"], ["PE", "Perú"], ["US", "Estados Unidos"],
  ["UY", "Uruguay"], ["VE", "Venezuela"],
  ["AG", "Antigua y Barbuda"], ["BS", "Bahamas"], ["BB", "Barbados"],
  ["BZ", "Belice"], ["DM", "Dominica"], ["GD", "Granada"], ["GY", "Guyana"],
  ["HT", "Haití"], ["JM", "Jamaica"], ["KN", "San Cristóbal y Nieves"],
  ["LC", "Santa Lucía"], ["VC", "San Vicente y las Granadinas"],
  ["SR", "Surinam"], ["TT", "Trinidad y Tobago"],
  ["ES", "España"], ["PT", "Portugal"], ["FR", "Francia"], ["GB", "Reino Unido"],
  ["DE", "Alemania"], ["IT", "Italia"], ["NL", "Países Bajos"], ["PL", "Polonia"],
  ["RO", "Rumanía"], ["JP", "Japón"], ["KR", "Corea del Sur"], ["CN", "China"],
  ["PH", "Filipinas"], ["AU", "Australia"], ["NZ", "Nueva Zelanda"],
];

// CountryPicker: modal para elegir la nacionalidad (bandera en perfil y
// matchmaking). Al guardar recarga la ficha para traer el dato del backend.
function CountryPicker({ current, onClose }: { current: string; onClose: () => void }) {
  const [picked, setPicked] = useState(current);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    const problem = await saveCountry(picked);
    setSaving(false);
    if (problem) {
      setErr(problem);
      return;
    }
    window.location.reload();
  };

  return createPortal(
    <div className="country-backdrop" onClick={saving ? undefined : onClose}>
      <div className="country-modal" onClick={(e) => e.stopPropagation()}>
        <h3>TU NACIONALIDAD</h3>
        <p>Elige tu país a mano: la bandera se muestra en tu perfil, en los rankings y en el matchmaking. Ojo: si tu perfil de Start.gg tiene ubicación, la sync la tomará de allí y sobrescribirá tu elección.</p>
        <select value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">— Sin país —</option>
          {COUNTRIES.map(([code, cname]) => (
            <option key={code} value={code}>
              {flagEmoji(code)} {cname}
            </option>
          ))}
        </select>
        {err ? <span className="country-err">{err}</span> : null}
        <div className="row">
          <button type="button" className="country-save" disabled={saving} onClick={save}>
            {saving ? "GUARDANDO…" : "GUARDAR"}
          </button>
          <button type="button" className="country-cancel" disabled={saving} onClick={onClose}>
            CANCELAR
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}