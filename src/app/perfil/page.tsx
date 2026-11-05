'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  CircleX,
  Coffee,
  Crown,
  ExternalLink,
  Flame,
  LayoutList,
  LoaderCircle,
  Medal,
  Percent,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import {
  fetchMe,
  fuseIconUrl,
  getToken,
  loginUrl,
  rankIconFallbackUrl,
  rankIconUrl,
} from '@/lib/auth';
import type { MeResponse, ProfileFight, ProfileTournament } from '@/lib/auth';
import SiteHeader from '@/components/SiteHeader';

type Status = 'loading' | 'anon' | 'error' | 'ok';

const ERROR_MESSAGES: Record<string, string> = {
  no_miembro:
    'Necesitas ser miembro del servidor de Discord Hot Coffee 2XKO para iniciar sesión. Únete y vuelve a intentarlo.',
  estado_invalido: 'La sesión de login expiró. Vuelve a intentarlo.',
  token: 'Discord no autorizó el acceso. Vuelve a intentarlo.',
  usuario: 'No se pudo obtener tu usuario de Discord. Vuelve a intentarlo.',
  servidor: 'Error interno del servidor. Vuelve a intentarlo en un momento.',
};

export default function PerfilPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [tab, setTab] = useState<'rango' | 'stats' | 'peleas' | 'torneos'>('rango');
  const [showAllFights, setShowAllFights] = useState(false);

  useEffect(() => {
    // ¿vino con ?error=... desde el callback del backend?
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setErrorCode(err);

    if (!getToken()) {
      setStatus(err ? 'error' : 'anon');
      return;
    }
    fetchMe().then((data) => {
      if (!data) {
        setStatus(err ? 'error' : 'anon');
        return;
      }
      setMe(data);
      setStatus('ok');
    });
  }, []);

  if (status === 'loading') {
    return (
      <ProfileCanvas>
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 grid h-16 w-16 place-items-center border border-[#b44d1d]/50 bg-[#28180f] text-[#d0ca53] [clip-path:polygon(15%_0,100%_0,100%_85%,85%_100%,0_100%,0_15%)]">
            <LoaderCircle className="h-7 w-7 animate-spin motion-reduce:animate-none" />
          </div>
          <p className="font-game text-2xl font-semibold uppercase tracking-[0.16em] text-white/80">
            Cargando ficha
          </p>
          <p className="mt-2 text-sm text-white/45">Conectando con la arena...</p>
        </div>
      </ProfileCanvas>
    );
  }

  if (status === 'anon') {
    return (
      <ProfileCanvas>
        <ProfileNotice
          eyebrow="HOT COFFEE 2XKO / PLAYER CARD"
          title="Tu próxima partida empieza aquí."
          message="Conecta tu cuenta de Discord para consultar tu rango, tu historial de peleas y tus resultados en torneos."
          action="Iniciar sesión con Discord"
          href={loginUrl()}
        />
      </ProfileCanvas>
    );
  }

  if (status === 'error' || !me) {
    return (
      <ProfileCanvas>
        <ProfileNotice
          eyebrow="HOT COFFEE 2XKO / CONEXIÓN"
          title="No pudimos cargar tu ficha."
          message={
            ERROR_MESSAGES[errorCode ?? ''] ??
            'Ocurrió un error inesperado. Vuelve a intentarlo.'
          }
          action="Reintentar con Discord"
          href={loginUrl()}
          error
        />
      </ProfileCanvas>
    );
  }

  const { user, stats, rank } = me;
  const games = stats.wins + stats.losses;
  const winrate = games > 0 ? (stats.wins / games) * 100 : null;
  const name = user.guildNickname || user.globalName || user.username;
  const position = stats.rankingPosition > 0 ? `#${stats.rankingPosition}` : '—';
  const progress = Math.max(0, Math.min(rank.progress, 100));
  const fights = me.fights ?? [];
  const tournaments = me.tournaments ?? [];
  const championships = tournaments.filter((tournament) => tournament.isWinner);
  const top1 = tournaments.filter((t) => t.placement === 1).length;
  const top3 = tournaments.filter((t) => t.placement > 0 && t.placement <= 3).length;
  const top8 = tournaments.filter((t) => t.placement > 0 && t.placement <= 8).length;

  return (
    <ProfileCanvas>
      <div className="mx-auto w-full max-w-6xl">

        {/* ---------- Banner de jugador (estilo cliente) ---------- */}
        <section
          id="resumen"
          aria-labelledby="player-name"
          className="relative isolate mb-5 overflow-hidden border border-[#b44d1d]/45 bg-[#21150f] shadow-[0_24px_80px_rgba(0,0,0,0.35)] [clip-path:polygon(0_0,calc(100%_-_26px)_0,100%_26px,100%_100%,0_100%)]"
        >
          {/* Capas de arte de fondo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 88% 10%, rgba(180,77,29,.30), transparent 42%), radial-gradient(ellipse at 8% 100%, rgba(208,202,83,.10), transparent 34%), linear-gradient(115deg, transparent 46%, rgba(208,202,83,.05) 46.3%, transparent 66%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-44 -z-10 h-96 w-96 rotate-45 border border-[#d0ca53]/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -left-16 -z-10 h-72 w-72 rotate-12 border border-[#c48a4a]/10"
          />

          <div className="flex flex-col gap-7 p-5 sm:p-8 lg:flex-row lg:items-center">
            {/* Avatar + identidad */}
            <div className="flex min-w-0 items-center gap-5 sm:gap-7">
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute -inset-1.5 rotate-[-5deg] border border-[#c76836]/65"
                />
                <div
                  aria-hidden="true"
                  className="absolute -inset-3 rotate-[-5deg] border border-[#d0ca53]/15"
                />
                <img
                  src={user.avatarUrl}
                  alt={`Avatar de ${name}`}
                  className="relative h-[84px] w-[84px] border-2 border-[#d0ca53]/65 bg-[#29190f] object-cover sm:h-28 sm:w-28"
                />
                <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center border border-[#21150f] bg-[#b44d1d] text-[#fff4df]">
                  <Coffee className="h-4 w-4" />
                </span>
              </div>

              <div className="min-w-0">
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c76836]">
                  Ficha de combate
                </p>
                <h2
                  id="player-name"
                  className="truncate font-game text-4xl font-bold leading-[0.95] text-white sm:text-6xl"
                >
                  {name}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="text-xs tracking-[0.12em] text-white/45">
                    @{user.username}
                  </p>
                  <span className="inline-flex items-center gap-1.5 border border-[#50d484]/25 bg-[#50d484]/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#7ee2a5]">
                    <span className="h-1 w-1 rounded-full bg-[#50d484]" />
                    Miembro de Hot Coffee 2XKO
                  </span>
                </div>
              </div>
            </div>

            {/* Posición en ranking */}
            <div className="flex items-center gap-4 border-t border-[#c48a4a]/20 pt-5 lg:ml-auto lg:min-w-44 lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center border border-[#d0ca53]/35 bg-[#d0ca53]/[0.07] text-[#d0ca53] [clip-path:polygon(15%_0,100%_0,100%_85%,85%_100%,0_100%,0_15%)]">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="lg:text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
                  Posición en ranking
                </p>
                <p className="font-game text-5xl font-bold leading-none text-[#ffe787]">
                  {position}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Cuerpo: nav lateral + contenido ---------- */}
        <div className="grid gap-5 lg:grid-cols-[216px_minmax(0,1fr)]">
          {/* Nav lateral estilo cliente */}
          <aside aria-label="Secciones del perfil" className="lg:sticky lg:top-6 lg:self-start">
            <nav className="flex gap-2 overflow-x-auto border border-white/10 bg-[#21150f] p-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:p-3">
              <NavItem
                icon={Flame}
                label="Rango actual"
                active={tab === 'rango'}
                onClick={() => setTab('rango')}
              />
              <NavItem
                icon={LayoutList}
                label="Rendimiento"
                active={tab === 'stats'}
                onClick={() => setTab('stats')}
              />
              <NavItem
                icon={Swords}
                label="Historial de peleas"
                active={tab === 'peleas'}
                onClick={() => setTab('peleas')}
              />
              <NavItem
                icon={Trophy}
                label="Torneos y posiciones"
                active={tab === 'torneos'}
                onClick={() => setTab('torneos')}
              />
              <NavItem icon={Trophy} label="Tabla de posiciones" href="/" />
            </nav>
            <div className="mt-3 hidden border border-white/10 bg-[#21150f] p-4 lg:block">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                Historial competitivo
              </p>
              <p className="font-game text-xl font-bold uppercase tracking-[0.06em] text-[#d0ca53]">
                {championships.length} {championships.length === 1 ? 'campeonato' : 'campeonatos'}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                {fights.length} peleas recientes y resultados de torneos asociados a tu perfil.
              </p>
              <ul className="mt-3 divide-y divide-white/[0.08] text-[11px]">
                <li className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-white/40">Veces Top 1</span>
                  <span className="font-game font-bold text-[#ffe787]">{top1}</span>
                </li>
                <li className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-white/40">Veces Top 3</span>
                  <span className="font-game font-bold text-[#d0ca53]">{top3}</span>
                </li>
                <li className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-white/40">Veces Top 8</span>
                  <span className="font-game font-bold text-white/70">{top8}</span>
                </li>
              </ul>
            </div>
          </aside>

          {/* Columna principal */}
          <div className="min-w-0 space-y-5">
            {tab === 'rango' && (
            <>
            {/* Rango actual */}
            <section
              id="rango"
              aria-labelledby="rank-section-title"
              className="relative overflow-hidden border border-white/10 bg-[#211a15] [clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_20px,100%_100%,0_100%)] scroll-mt-6"
            >
              <SectionHeading
                id="rank-section-title"
                icon={Flame}
                label="Rango actual"
                index="01"
              />
              <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-10 sm:p-8">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 bottom-0 h-56 w-56 rotate-45 border border-[#c48a4a]/10"
                />
                <div className="relative shrink-0">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-2.5 border border-[#c48a4a]/20 [clip-path:polygon(15%_0,100%_0,100%_85%,85%_100%,0_100%,0_15%)]"
                  />
                  <img
                    src={rankIconUrl(rank.iconPath)}
                    alt={`Emblema de ${rank.displayName}`}
                    className="relative h-28 w-28 object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)] sm:h-36 sm:w-36"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = rankIconFallbackUrl(rank.iconPath);
                    }}
                  />
                </div>

                <div className="min-w-0 w-full flex-1 text-center sm:text-left">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">
                    Rango competitivo
                  </p>
                  <h2
                    className="break-words font-game text-4xl font-bold leading-[0.95] sm:text-5xl"
                    style={{ color: rank.color }}
                  >
                    {rank.displayName.toUpperCase()}
                  </h2>

                  {rank.isRp ? (
                    <div className="mt-5">
                      <p className="font-game text-3xl font-bold text-white sm:text-4xl">
                        {rank.rp}{' '}
                        <span className="text-base font-medium text-white/45">RP</span>
                      </p>
                      {rank.next ? (
                        <p className="mt-1.5 text-xs text-white/50">
                          Faltan{' '}
                          <span className="font-semibold text-[#ffe787]">
                            {rank.lpToNext} RP
                          </span>{' '}
                          para {rank.next}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs font-semibold text-[#ffe787]">
                          ¡Máximo rango alcanzado!
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="font-game text-3xl font-bold text-white sm:text-4xl">
                          {rank.lp}{' '}
                          <span className="text-base font-medium text-white/45">LP</span>
                        </p>
                        <p className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-white/40">
                          100 LP para subir
                        </p>
                      </div>
                      <div
                        className="relative mt-3 h-2.5 overflow-hidden bg-white/10"
                        role="progressbar"
                        aria-label="Progreso hacia el siguiente rango"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <div
                          className="relative h-full transition-[width] duration-500"
                          style={{
                            width: `${progress}%`,
                            background: `linear-gradient(90deg, ${rank.color}bb, ${rank.color})`,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%_-_1px),rgba(0,0,0,.28)_calc(10%_-_1px)_10%)]"
                          />
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs text-white/50">
                        Faltan{' '}
                        <span className="font-semibold" style={{ color: rank.color }}>
                          {rank.lpToNext} LP
                        </span>{' '}
                        para {rank.next}
                        {rank.nextIsRp ? ' (RP)' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
            </>
            )}

            {tab === 'stats' && (
            <>
            {/* Rendimiento */}
            <section
              id="rendimiento"
              aria-labelledby="stats-heading"
              className="overflow-hidden border border-white/10 bg-[#211a15]"
            >
              <SectionHeading
                id="stats-heading"
                icon={Swords}
                label="Rendimiento"
                index="02"
              />
              <div className="grid grid-cols-2 gap-px bg-white/[0.07] p-px sm:grid-cols-4">
                <Stat
                  label="Puntos"
                  value={String(stats.points)}
                  color="#ffe787"
                  icon={Flame}
                />
                <Stat
                  label="Victorias"
                  value={String(stats.wins)}
                  color="#50d484"
                  icon={CircleCheck}
                />
                <Stat
                  label="Derrotas"
                  value={String(stats.losses)}
                  color="#f07070"
                  icon={CircleX}
                />
                <Stat
                  label="Winrate"
                  value={winrate !== null ? `${winrate.toFixed(1)}%` : '—'}
                  color={rank.color}
                  icon={Percent}
                />
              </div>
              <p className="border-t border-white/[0.08] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {games} peleas registradas
              </p>
            </section>
            </>
            )}

            {tab === 'peleas' && (
              <FightHistory
                fights={fights}
                showAll={showAllFights}
                onToggleShowAll={() => setShowAllFights((v) => !v)}
              />
            )}
            {tab === 'torneos' && <TournamentHistory tournaments={tournaments} />}
          </div>
        </div>

        <footer className="mt-7 flex items-center justify-between border-t border-white/[0.08] pt-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
          <span>Hot Coffee 2XKO</span>
          <span>Perfil de jugador</span>
        </footer>
      </div>
    </ProfileCanvas>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function ProfileCanvas({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen overflow-hidden bg-[#18100b] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 10% 10%, rgba(180,77,29,.12), transparent 32%), radial-gradient(ellipse at 92% 86%, rgba(208,202,83,.07), transparent 30%), repeating-linear-gradient(132deg, transparent 0 96px, rgba(255,255,255,.012) 97px, transparent 99px)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-48 top-[28%] h-[30rem] w-[30rem] rotate-45 border border-[#c48a4a]/[0.08]"
      />
        <div className="relative px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="relative mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </main>
    </>
  );
}

function FightHistory({
  fights,
  showAll,
  onToggleShowAll,
}: {
  fights: ProfileFight[];
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const visible = showAll ? fights : fights.slice(0, 3);
  return (
    <section
      id="peleas"
      aria-labelledby="fight-history-heading"
      className="overflow-hidden border border-white/10 bg-[#211a15]"
    >
      <SectionHeading
        id="fight-history-heading"
        icon={Swords}
        label="Historial de peleas"
        index="03"
      />
      {fights.length === 0 ? (
        <div className="flex items-center gap-4 p-5 sm:p-7">
          <div className="grid h-12 w-12 shrink-0 place-items-center border border-[#c48a4a]/25 bg-[#c48a4a]/[0.05] text-[#c48a4a]">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <p className="font-game text-sm font-bold uppercase tracking-[0.12em] text-white/75">
              Sin peleas registradas todavía
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              Cuando haya sets finalizados, aquí verás el marcador, los dos equipos y la fusión de cada lado.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.08]">
          {visible.map((fight) => (
            <FightCard key={fight.id} fight={fight} />
          ))}
          {fights.length > 3 && (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d0ca53] transition hover:bg-white/[0.03] hover:text-[#ffe787] sm:px-5"
            >
              {showAll
                ? 'Ver solo las últimas 3'
                : `Ver todas las peleas (${fights.length})`}
            </button>
          )}
          <p className="px-4 py-2.5 text-[10px] text-white/35 sm:px-5">
            Se muestran hasta 25 peleas finalizadas, de la más reciente a la más antigua.
          </p>
        </div>
      )}
    </section>
  );
}

function FightCard({ fight }: { fight: ProfileFight }) {
  const won = fight.result === 'WIN';
  const opponent = fight.opponentTag || 'Rival';
  const date = new Date(fight.playedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);

  return (
    <article className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time
          dateTime={fight.playedAt}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-white/35"
        >
          <CalendarDays className="h-3 w-3" />
          {dateLabel}
        </time>
        <div className="flex items-center gap-2">
          <span
            className={`border px-2 py-1 font-game text-[10px] font-bold uppercase tracking-[0.15em] ${
              won
                ? 'border-[#50d484]/30 bg-[#50d484]/[0.08] text-[#72dda0]'
                : 'border-[#f07070]/30 bg-[#f07070]/[0.08] text-[#f18a82]'
            }`}
          >
            {won ? 'Victoria' : 'Derrota'}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
            FT{fight.targetFT || 3}
          </span>
        </div>
      </div>

      <div className="mt-4 grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <TeamDisplay label="Tu equipo" team={fight.playerTeam} />
        <div className="flex items-center justify-center gap-3 py-1 lg:flex-col lg:px-2">
          <span className="font-game text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
            VS
          </span>
          <div className="flex items-center gap-2 font-game text-2xl font-bold">
            <span className={won ? 'text-[#50d484]' : 'text-white/70'}>
              {fight.scoreFor}
            </span>
            <span className="text-white/20">:</span>
            <span className={!won ? 'text-[#f07070]' : 'text-white/70'}>
              {fight.scoreAgainst}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 lg:max-w-28 lg:flex-col">
            {fight.opponentAvatar && (
              <img
                src={fight.opponentAvatar}
                alt=""
                className="h-5 w-5 border border-white/10 object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="max-w-32 truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45">
              vs. {opponent}
            </span>
          </div>
        </div>
        <TeamDisplay label={`Equipo rival · ${opponent}`} team={fight.opponentTeam} />
      </div>
    </article>
  );
}

function TeamDisplay({
  label,
  team,
}: {
  label: string;
  team: ProfileFight['playerTeam'];
}) {
  const fighters = [team?.point, team?.assist].filter(
    (fighter) => fighter?.id || fighter?.name,
  );

  return (
    <div className="min-w-0 border border-white/[0.07] bg-[#1b1511] p-3">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {fighters.length > 0 ? (
          fighters.map((fighter, index) => (
            <div
              key={`${fighter.id}-${index}`}
              className="flex min-w-0 items-center gap-2 border border-white/[0.06] bg-white/[0.02] p-1.5"
            >
              {fighter.id && (
                <img
                  src={`/fighters/${encodeURIComponent(fighter.id)}.png`}
                  alt=""
                  className="h-10 w-9 shrink-0 object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="truncate font-game text-[10px] font-semibold uppercase text-white/75">
                {fighter.name || fighter.id}
              </span>
            </div>
          ))
        ) : (
          <p className="col-span-2 py-3 text-xs text-white/30">
            Personajes no registrados
          </p>
        )}
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-white/[0.06] pt-2">
        {team?.fuse?.id ? (
          <img
            src={fuseIconUrl(team.fuse.id)}
            alt=""
            className="h-7 w-7 shrink-0 object-contain"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center border border-[#d0ca53]/20 text-[9px] font-bold text-[#d0ca53]/70">
            F
          </span>
        )}
        <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.08em] text-[#d0ca53]/80">
          Fuse · {team?.fuse?.name || 'No registrada'}
        </span>
      </div>
    </div>
  );
}

function TournamentHistory({
  tournaments,
}: {
  tournaments: ProfileTournament[];
}) {
  const winners = tournaments.filter((tournament) => tournament.isWinner);

  return (
    <section
      id="torneos"
      aria-labelledby="tournament-history-heading"
      className="overflow-hidden border border-white/10 bg-[#211a15]"
    >
      <SectionHeading
        id="tournament-history-heading"
        icon={Trophy}
        label="Torneos y posiciones"
        index="04"
      />
      {tournaments.length === 0 ? (
        <div className="flex items-center gap-4 p-5 sm:p-7">
          <div className="grid h-12 w-12 shrink-0 place-items-center border border-[#d0ca53]/25 bg-[#d0ca53]/[0.05] text-[#d0ca53]">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="font-game text-sm font-bold uppercase tracking-[0.12em] text-white/75">
              Aún no hay resultados de torneos
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              Cuando un resultado quede vinculado a tu cuenta de Discord, aparecerá aquí con su puesto final.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="border border-[#d0ca53]/20 bg-[#d0ca53]/[0.035] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center border border-[#d0ca53]/30 bg-[#d0ca53]/[0.07] text-[#d0ca53]">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Campeonatos ganados
                </p>
                <p className="font-game text-3xl font-bold leading-none text-[#ffe787]">
                  {winners.length}
                </p>
              </div>
            </div>
            {winners.length > 0 ? (
              <ul className="mt-4 divide-y divide-white/[0.08]">
                {winners.map((tournament) => (
                  <li
                    key={tournament.eventId}
                    className="flex items-center gap-2 py-2.5 text-xs text-white/75"
                  >
                    <Crown className="h-3.5 w-3.5 shrink-0 text-[#d0ca53]" />
                    <span className="min-w-0 flex-1 truncate">
                      {tournament.name || `Torneo #${tournament.eventId}`}
                    </span>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-[#ffe787]">
                      Campeón
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-white/[0.08] pt-3 text-xs text-white/40">
                Todavía no hay campeonatos registrados.
              </p>
            )}
          </div>

          <div className="overflow-hidden border border-white/[0.08]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
              <p className="font-game text-xs font-bold uppercase tracking-[0.12em] text-white/75">
                Resultados registrados
              </p>
              <span className="font-game text-xs text-[#d0ca53]">
                {tournaments.length}
              </span>
            </div>
            <div className="divide-y divide-white/[0.07]">
              {tournaments.map((tournament) => (
                <TournamentRow key={tournament.eventId} tournament={tournament} />
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="border-t border-white/[0.07] px-4 py-2.5 text-[10px] leading-relaxed text-white/35 sm:px-5">
        El historial antiguo conserva resultados con puntos (Top 8); las nuevas sincronizaciones guardan el puesto completo cuando el jugador está vinculado a Discord.
      </p>
    </section>
  );
}

function TournamentRow({ tournament }: { tournament: ProfileTournament }) {
  const content = (
    <>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center border ${
          tournament.isWinner
            ? 'border-[#d0ca53]/30 bg-[#d0ca53]/[0.07] text-[#d0ca53]'
            : 'border-white/[0.08] bg-white/[0.025] text-white/40'
        }`}
      >
        {tournament.isWinner ? (
          <Crown className="h-4 w-4" />
        ) : (
          <Medal className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-white/80">
          {tournament.name || `Torneo #${tournament.eventId}`}
        </span>
        <span className="mt-0.5 block text-[9px] uppercase tracking-[0.12em] text-white/35">
          {tournament.points} puntos
        </span>
      </span>
      <span
        className={`shrink-0 border px-2 py-1 font-game text-[9px] font-bold uppercase tracking-[0.08em] ${
          tournament.isWinner
            ? 'border-[#d0ca53]/30 text-[#ffe787]'
            : 'border-white/[0.08] text-white/60'
        }`}
      >
        {tournament.placementLabel || 'Puesto registrado'}
      </span>
      {tournament.slug && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/25" />
      )}
    </>
  );

  const className =
    'flex min-w-0 items-center gap-3 px-3 py-3 transition hover:bg-white/[0.025] sm:px-4';

  return tournament.slug ? (
    <a
      href={`https://www.start.gg/tournament/${encodeURIComponent(tournament.slug)}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function NavItem({
  icon: Icon,
  label,
  href,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
}) {
  return (
    <a
      href={href ?? '#'}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-2.5 border px-3 font-game text-xs font-bold uppercase tracking-[0.12em] transition ${
        active
          ? 'border-[#d0ca53]/30 bg-[#d0ca53]/[0.08] text-[#ffe787]'
          : 'border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.03] hover:text-white'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#d0ca53]' : 'text-white/35'}`} />
      {label}
    </a>
  );
}

function ProfileNotice({
  eyebrow,
  title,
  message,
  action,
  href,
  error = false,
}: {
  eyebrow: string;
  title: string;
  message: string;
  action: string;
  href: string;
  error?: boolean;
}) {
  return (
    <div className="flex min-h-[78vh] items-center justify-center py-8">
      <section className="relative w-full max-w-2xl overflow-hidden border border-[#b44d1d]/40 bg-[#21150f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10 [clip-path:polygon(0_0,calc(100%_-_24px)_0,100%_24px,100%_100%,0_100%)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rotate-45 border border-[#d0ca53]/10"
        />
        <a
          href="/"
          className="relative mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45 transition hover:text-[#ffe787]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al ranking
        </a>
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div
            className={`grid h-16 w-16 shrink-0 place-items-center border ${
              error
                ? 'border-[#f07070]/40 bg-[#f07070]/[0.08] text-[#f07070]'
                : 'border-[#d0ca53]/40 bg-[#d0ca53]/[0.08] text-[#d0ca53]'
            } [clip-path:polygon(15%_0,100%_0,100%_85%,85%_100%,0_100%,0_15%)]`}
          >
            <Coffee className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.26em] text-[#c76836]">
              {eyebrow}
            </p>
            <h1
              className={`font-game text-4xl font-bold leading-[0.95] sm:text-5xl ${
                error ? 'text-[#f07070]' : 'text-[#fff4df]'
              }`}
            >
              {title}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">
              {message}
            </p>
            <a
              href={href}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 border border-[#c76836]/70 bg-[#b44d1d] px-5 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#c45b25]"
            >
              {action} <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  label,
  index,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  index: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
      <Icon className="h-4 w-4 text-[#d0ca53]" />
      <h2
        id={id}
        className="font-game text-sm font-bold uppercase tracking-[0.13em] text-white/90"
      >
        {label}
      </h2>
      <span className="ml-auto font-game text-[10px] font-semibold tracking-[0.18em] text-white/25">
        {index}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative flex min-h-32 flex-col justify-between overflow-hidden bg-[#211a15] p-4 sm:p-5">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 opacity-70"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      </div>
      <span
        className="mt-5 truncate font-game text-3xl font-bold leading-none sm:text-4xl"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}