'use client';

import { useCallback, useEffect, useState } from 'react';
import DiscordLoginButton from '@/components/DiscordLoginButton';
import { fetchMe, getToken, MeResponse, RankInfo, rankIconUrl } from '@/lib/auth';
import {
  QueueState,
  acceptProposal,
  declineProposal,
  getQueueState,
  joinQueue,
  leaveQueue,
} from '@/lib/matchmaking';

type Status =
  | 'loading'
  | 'anon'
  | 'idle'
  | 'searching'
  | 'found'
  | 'confirmed'
  | 'matched'
  | 'failed';

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function RankIcon({ rank, size = 44 }: { rank: RankInfo; size?: number }) {
  return (
    <img
      src={rankIconUrl(rank.iconPath)}
      alt={rank.displayName}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

function VsCard({
  name,
  avatar,
  points,
  rank,
  highlight,
}: {
  name: string;
  avatar?: string;
  points: number;
  rank: RankInfo;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-5"
      style={{ boxShadow: `inset 0 -3px 0 0 ${rank.color}${highlight ? '' : '55'}` }}
    >
      <img
        src={avatar || '/favicon.ico'}
        alt={name}
        className="h-16 w-16 rounded-full border-2 object-cover"
        style={{ borderColor: rank.color }}
      />
      <span className="max-w-40 truncate font-condensed text-xl font-bold text-white">
        {name}
      </span>
      <RankIcon rank={rank} size={52} />
      <span className="text-sm font-bold" style={{ color: rank.color }}>
        {rank.displayName}
      </span>
      <span className="text-xs text-white/50">{points} pts</span>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        ok
          ? 'border-[#50d484]/40 bg-[#50d484]/10 text-[#50d484]'
          : 'border-white/10 bg-white/5 text-white/45'
      }`}
    >
      {ok ? '✓' : '•'} {label}
    </span>
  );
}

export default function MatchmakingPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [state, setState] = useState<QueueState | null>(null);
  const [ft, setFt] = useState<3 | 5>(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const authed = !!getToken();

  useEffect(() => {
    let alive = true;
    fetchMe().then((data) => {
      if (alive) setMe(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    const poll = async () => {
      const s = await getQueueState();
      if (alive) setState(s);
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [authed]);

  // Reloj de 1 s: cronómetro de la cola y cuenta atrás de la propuesta.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const act = useCallback(
    async (fn: () => Promise<string | null>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const err = await fn();
      if (err) setError(err);
      setState(await getQueueState());
      setBusy(false);
    },
    [busy]
  );

  const status: Status = !authed
    ? 'anon'
    : state === null
      ? 'loading'
      : (state.status as Status);

  const now = Date.now();
  const elapsed = state?.queue
    ? Math.max(0, now - new Date(state.queue.since).getTime())
    : 0;
  const remaining = state?.proposal
    ? Math.max(0, new Date(state.proposal.expiresAt).getTime() - now)
    : 0;

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      {/* Barra superior */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <a
            href="/"
            className="text-[11px] uppercase tracking-widest text-white/40 transition hover:text-white/70"
          >
            ← Hot Coffee 2XKO
          </a>
          <h1 className="font-condensed text-2xl font-bold">⚔️ Matchmaking</h1>
        </div>
        <DiscordLoginButton />
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Mi tarjeta (visible solo logueado) */}
        {me && (
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <img
              src={me.user.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full border-2 object-cover"
              style={{ borderColor: me.rank.color }}
            />
            <div className="min-w-0">
              <p className="truncate font-condensed text-xl font-bold">
                {me.user.guildNickname || me.user.globalName || me.user.username}
              </p>
              <p className="text-xs text-white/50">
                {me.stats.points} pts · {me.stats.wins}W {me.stats.losses}L
                {me.stats.rankingPosition > 0
                  ? ` · #${me.stats.rankingPosition}`
                  : ''}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <RankIcon rank={me.rank} size={56} />
              <div className="text-right">
                <p
                  className="font-condensed text-lg font-bold leading-tight"
                  style={{ color: me.rank.color }}
                >
                  {me.rank.displayName}
                </p>
                <p className="text-[11px] text-white/45">
                  {me.rank.isRp
                    ? `${me.rank.rp} RP`
                    : `${me.rank.lp} LP · faltan ${me.rank.lpToNext}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No autenticado */}
        {status === 'anon' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <span className="text-5xl">🎮</span>
            <h2 className="font-condensed text-2xl font-bold">
              Entra a la cola de matchmaking
            </h2>
            <p className="max-w-md text-sm text-white/50">
              Inicia sesión con Discord (debes ser miembro de Hot Coffee 2XKO),
              elige el formato y el sistema buscará un rival de tu nivel.
            </p>
            <DiscordLoginButton />
          </div>
        )}

        {status === 'loading' && (
          <div className="py-20 text-center text-sm text-white/40">
            Cargando estado de la cola…
          </div>
        )}

        {authed && status !== 'loading' && status !== 'anon' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {/* ---------- IDLE: elegir formato y entrar ---------- */}
            {status === 'idle' && (
              <div className="flex flex-col items-center gap-5">
                <h2 className="font-condensed text-3xl font-bold">
                  Buscar rival
                </h2>
                <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                  {([3, 5] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setFt(n)}
                      disabled={busy}
                      className={`rounded-xl border p-4 transition ${
                        ft === n
                          ? 'border-[#f5d060]/70 bg-[#f5d060]/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <p className="font-condensed text-2xl font-bold">FT {n}</p>
                      <p className="text-xs text-white/45">{n * 5} pts en juego</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => act(() => joinQueue(ft))}
                  disabled={busy}
                  className="w-full max-w-sm rounded-xl bg-[#5865F2] px-6 py-4 font-condensed text-xl font-bold transition hover:bg-[#4752c4] disabled:opacity-50"
                >
                  🎲 Entrar a la cola
                </button>
                <p className="max-w-md text-center text-xs text-white/40">
                  El sistema busca rivales con puntos parecidos a los tuyos.
                  El rango de búsqueda se amplía mientras esperas.
                </p>
              </div>
            )}

            {/* ---------- SEARCHING ---------- */}
            {status === 'searching' && (
              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5865F2] opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-[#5865F2]" />
                  </span>
                  <h2 className="font-condensed text-2xl font-bold">
                    Buscando rival (FT {state?.queue?.ft})…
                  </h2>
                </div>
                <p
                  key={tick}
                  className="font-mono text-4xl font-bold tabular-nums text-white/90"
                >
                  {fmtClock(elapsed)}
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <Chip ok label={`${state?.queue?.players ?? 1} en cola`} />
                  <Chip ok label={`Búsqueda: ±${state?.queue?.radius ?? 25} pts`} />
                  <Chip ok label="Se amplía con la espera" />
                </div>
                <button
                  onClick={() => act(() => leaveQueue())}
                  disabled={busy}
                  className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                >
                  ✕ Salir de la cola
                </button>
                <p className="max-w-md text-center text-xs text-white/40">
                  Puedes dejar esta pestaña abierta: te avisamos aquí cuando
                  aparezca el rival. Si la cierras, sales de la cola.
                </p>
              </div>
            )}

            {/* ---------- FOUND: propuesta con doble aceptación ---------- */}
            {(status === 'found' || status === 'confirmed') && state?.proposal && (
              <div className="flex flex-col gap-5">
                <div className="text-center">
                  <h2 className="font-condensed text-3xl font-bold">
                    ⚔️ ¡Rival encontrado!
                  </h2>
                  <p className="text-sm text-white/50">
                    FT {state.proposal.ft} ·{' '}
                    <span className="font-semibold text-[#f5d060]">
                      {state.proposal.pointsAtStake} pts
                    </span>{' '}
                    en juego
                  </p>
                </div>

                <div className="flex items-stretch gap-3">
                  <VsCard
                    name={state.proposal.me.tag}
                    avatar={state.proposal.me.avatarUrl}
                    points={state.proposal.me.points}
                    rank={state.proposal.me.rank}
                    highlight={state.proposal.acceptedByMe}
                  />
                  <div className="flex flex-col items-center justify-center gap-1 px-1">
                    <span className="font-condensed text-3xl font-black text-white/30">
                      VS
                    </span>
                    <span
                      key={tick}
                      className="font-mono text-lg font-bold tabular-nums text-white/60"
                    >
                      {fmtClock(remaining)}
                    </span>
                  </div>
                  <VsCard
                    name={state.proposal.opponent.tag}
                    avatar={state.proposal.opponent.avatarUrl}
                    points={state.proposal.opponent.points}
                    rank={state.proposal.opponent.rank}
                    highlight={state.proposal.acceptedByOpponent}
                  />
                </div>

                <div className="flex justify-center gap-2">
                  <Chip ok={state.proposal.acceptedByMe} label="Tú" />
                  <Chip
                    ok={state.proposal.acceptedByOpponent}
                    label={state.proposal.opponent.tag}
                  />
                </div>

                {status === 'found' && !state.proposal.acceptedByMe ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => act(() => acceptProposal())}
                      disabled={busy}
                      className="rounded-xl bg-[#50d484] px-6 py-4 font-condensed text-xl font-bold text-[#06130b] transition hover:brightness-110 disabled:opacity-50"
                    >
                      ✅ Aceptar
                    </button>
                    <button
                      onClick={() => act(() => declineProposal())}
                      disabled={busy}
                      className="rounded-xl border border-[#f07070]/40 bg-[#f07070]/10 px-6 py-4 font-condensed text-xl font-bold text-[#f07070] transition hover:bg-[#f07070]/20 disabled:opacity-50"
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    {status === 'confirmed' ? (
                      <>
                        <span className="animate-pulse text-sm font-semibold text-[#50d484]">
                          Ambos aceptaron — creando el set en Discord…
                        </span>
                        <span className="text-xs text-white/40">
                          En segundos se abre el hilo del set con los paneles de
                          equipo. También te llega un MD.
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-white/70">
                          ✓ Aceptaste — esperando al rival…
                        </span>
                        <button
                          onClick={() => act(() => declineProposal())}
                          disabled={busy}
                          className="text-xs font-semibold uppercase tracking-wide text-white/35 transition hover:text-[#f07070]"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ---------- MATCHED: set creado ---------- */}
            {status === 'matched' && state?.match && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <span className="text-5xl">🏁</span>
                <h2 className="font-condensed text-3xl font-bold text-[#50d484]">
                  ¡Set creado!
                </h2>
                <p className="max-w-md text-sm text-white/50">
                  El hilo del set ya está en Discord. Arma tu equipo en el panel
                  del hilo (o en el MD del bot), compartan el código de sala y a
                  jugar. El reporte de games va game a game como siempre.
                </p>
                <a
                  href={state.match.threadUrl || 'https://discord.com/channels/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#5865F2] px-8 py-4 font-condensed text-xl font-bold transition hover:bg-[#4752c4]"
                >
                  🥊 Abrir el hilo en Discord
                </a>
              </div>
            )}

            {/* ---------- FAILED ---------- */}
            {status === 'failed' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="text-4xl">⚠️</span>
                <h2 className="font-condensed text-2xl font-bold">
                  No se pudo crear el set
                </h2>
                <p className="max-w-md text-sm text-white/50">
                  Hubo un problema lanzando el set en Discord (¿está el bot en
                  línea?). Vuelve a intentarlo.
                </p>
                <button
                  onClick={() => act(() => joinQueue(ft))}
                  disabled={busy}
                  className="rounded-xl bg-[#5865F2] px-6 py-3 font-condensed text-lg font-bold transition hover:bg-[#4752c4] disabled:opacity-50"
                >
                  Reintentar
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 text-center text-sm text-[#f07070]">{error}</p>
            )}
          </div>
        )}

        {/* Cómo funciona */}
        {authed && (
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-[11px] text-white/40">
            <div className="rounded-xl border border-white/5 p-3">
              <p className="mb-1 text-lg">1️⃣</p>
              Entras a la cola y el sistema busca rival de tu nivel
            </div>
            <div className="rounded-xl border border-white/5 p-3">
              <p className="mb-1 text-lg">2️⃣</p>
              Ambos aceptan y el bot crea el hilo del set
            </div>
            <div className="rounded-xl border border-white/5 p-3">
              <p className="mb-1 text-lg">3️⃣</p>
              Arman equipo, juegan y reportan; los puntos van al ranking
            </div>
          </div>
        )}
      </div>
    </main>
  );
}