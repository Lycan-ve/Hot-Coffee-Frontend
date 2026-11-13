'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { A, AppShell, PlayerFlag, RankBadge, SectionTitle } from "@/components/hc/shared";
import { displayName, LoginLink } from "@/components/hc/DiscordLogin";
import { RankFx } from "@/components/hc/RankFx";
import { fetchMe, getToken, type MeResponse, type RankInfo } from "@/lib/auth";
import {
  acceptProposal,
  declineProposal,
  getQueueState,
  joinQueue,
  leaveQueue,
  type QueueState,
} from "@/lib/matchmaking";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Búsqueda con mínimo dramático: aunque la cola empareje al instante, se
// muestran al menos MIN_SEARCH_MS de búsqueda con mensajes de progreso.
const MIN_SEARCH_MS = 3500;
const SEARCH_FLAVORS = [
  "ANALIZANDO TU RANGO…",
  "MIDIENDO EL NIVEL DE LA COLA…",
  "CONTACTANDO RIVALES CERCANOS…",
  "PREPARANDO EL ESCENARIO…",
];

function VsCard({
  name,
  avatar,
  points,
  rank,
  ok,
  wins,
  losses,
  streak,
  country,
  state,
}: {
  name: string;
  avatar?: string;
  points: number;
  rank: RankInfo;
  ok: boolean;
  wins?: number;
  losses?: number;
  streak?: number;
  country?: string;
  state?: string;
}) {
  const unplaced = rank.placed === false;
  return (
    <div className={`hc-vs-card rfx-card-host ${ok ? "ok" : ""}`}>
      <RankFx rank={rank} variant="card" />
      {avatar ? <img className="av" src={avatar} alt="" /> : <span className="av">{name[0]}</span>}
      <strong>
        <PlayerFlag country={country} state={state} />
        {name}
      </strong>
      <RankBadge small fx rank={rank} />
      <span>{unplaced ? "SIN RANGO · CLASIFICANDO" : `${rank.displayName} · ${points} pts`}</span>
      <small>
        <span className="success">{wins ?? 0}W</span> <span className="danger">{losses ?? 0}L</span>
        {(streak ?? 0) >= 3 ? ` · 🔥 racha de ${streak}` : ""}
      </small>
      <small>{ok ? "✓ ACEPTÓ" : "ESPERANDO"}</small>
    </div>
  );
}

export default function MatchmakingPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [state, setState] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchStart, setSearchStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setAuthed(!!getToken());
    fetchMe().then(setMe);
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
    [busy],
  );

  const status = authed === false ? "anon" : !state ? "loading" : state.status;
  const now = Date.now();
  const elapsed = state?.queue ? now - new Date(state.queue.since).getTime() : 0;
  const remaining = state?.proposal ? new Date(state.proposal.expiresAt).getTime() - now : 0;
  const searching = status === "searching";
  const found = status === "found" || status === "confirmed";
  // Puerta de búsqueda mínima: el rival encontrado no se revela antes de tiempo.
  const revealFound = found && (!searchStart || now - searchStart >= MIN_SEARCH_MS);
  const searchingView = searching || (found && !revealFound);
  const flavorBase = searchStart ?? (state?.queue ? new Date(state.queue.since).getTime() : now);
  const flavor = SEARCH_FLAVORS[Math.floor(Math.max(0, now - flavorBase) / 1500) % SEARCH_FLAVORS.length];
  const games = me ? me.stats.wins + me.stats.losses : 0;

  return (
    <AppShell>
      <main className="page matchmaking-page">
        <section className="hero matchmaking-hero">
          <div className="hero-copy">
            <SectionTitle
              eyebrow="CENTRO DE COMBATE / EN LÍNEA"
              title="MATCHMAKING"
              copy="Todos los sets son FT 3. Te emparejamos con un rival de tu rango."
            />
          </div>
          <div className="hero-motto">
            <span>LA ARENA ESTÁ ABIERTA</span>
            <strong>ARMA TU EQUIPO. SIRVE LA PELEA.</strong>
          </div>
        </section>

        <section className="queue-layout">
          <aside className={`fighter-summary panel ${me ? "rfx-card-host" : ""}`}>
            {me ? <RankFx rank={me.rank} variant="card" /> : null}
            <div className="panel-heading">
              <h3>TU PERFIL</h3>
              {me ? (
                <span className="online">
                  <i /> LISTO
                </span>
              ) : (
                <span>SIN SESIÓN</span>
              )}
            </div>
            {me ? (
              <>
                <div className="fighter-rank">
                  <RankBadge small fx rank={me.rank} />
                  <div>
                    <span>
                      <PlayerFlag country={me.user.country} state={me.user.state} />
                      {displayName(me)}
                    </span>
                    <strong>{me.rank.placed === false ? "SIN RANGO" : me.rank.displayName.toUpperCase()}</strong>
                    <p>
                      {me.rank.placed === false
                        ? `CLASIFICANDO ${Math.min(games, 5)}/5`
                        : `${me.stats.points} PTS${me.stats.rankingPosition > 0 ? ` · #${me.stats.rankingPosition}` : ""}`}
                    </p>
                  </div>
                </div>
                <div className="compact-stats">
                  <div>
                    <small>WIN RATE</small>
                    <strong>{games ? Math.round((me.stats.wins / games) * 100) : 0}%</strong>
                  </div>
                  <div>
                    <small>RÉCORD</small>
                    <strong>
                      <span className="success">{me.stats.wins}W</span>{" "}
                      <span className="danger">{me.stats.losses}L</span>
                    </strong>
                  </div>
                </div>
                <div className="roster">
                  <small>PROGRESO DE RANGO</small>
                  {me.rank.placed === false ? (
                    <div>
                      <span>◆</span>
                      <strong>CLASIFICANDO</strong>
                      <b>{Math.max(0, 5 - games)} SETS PARA RANGO</b>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span>◆</span>
                        <strong>{me.rank.isRp ? `${me.rank.rp} RP` : `${me.rank.lp} LP`}</strong>
                        <b>{me.rank.isRp ? "" : `FALTAN ${me.rank.lpToNext}`}</b>
                      </div>
                      <div>
                        <span>→</span>
                        <strong>{me.rank.next?.toUpperCase()}</strong>
                        <b>SIGUIENTE</b>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="hc-empty">Inicia sesión para ver tu rango y entrar a la cola.</p>
            )}
          </aside>

          <article className={`queue-console cut-panel ${searchingView ? "searching" : ""}`}>
            <div className="queue-grid" />
            <span className="queue-kicker">
              {status === "anon" && "INICIA SESIÓN PARA JUGAR"}
              {status === "loading" && "CONECTANDO CON LA COLA…"}
              {status === "idle" && "COLA COMPETITIVA DISPONIBLE"}
              {searchingView && "BUSCANDO RIVAL · FT 3"}
              {found && revealFound && "¡RIVAL ENCONTRADO!"}
              {status === "matched" && "SET CREADO"}
              {status === "failed" && "ALGO SALIÓ MAL"}
            </span>

            {found && revealFound && state?.proposal ? (
              <>
                <div className="hc-vs">
                  <VsCard name={state.proposal.me.tag} avatar={state.proposal.me.avatarUrl} points={state.proposal.me.points} rank={state.proposal.me.rank} ok={state.proposal.acceptedByMe} wins={state.proposal.me.wins} losses={state.proposal.me.losses} streak={state.proposal.me.streak} country={state.proposal.me.country} state={state.proposal.me.state} />
                  <div className="mid">
                    <b>VS</b>
                    <span>{clock(remaining)}</span>
                  </div>
                  <VsCard name={state.proposal.opponent.tag} avatar={state.proposal.opponent.avatarUrl} points={state.proposal.opponent.points} rank={state.proposal.opponent.rank} ok={state.proposal.acceptedByOpponent} wins={state.proposal.opponent.wins} losses={state.proposal.opponent.losses} streak={state.proposal.opponent.streak} country={state.proposal.opponent.country} state={state.proposal.opponent.state} />
                </div>
                <p>
                  FT {state.proposal.ft} · <strong className="gold">{state.proposal.pointsAtStake} pts</strong> en juego
                </p>
                {status === "found" && !state.proposal.acceptedByMe ? (
                  <div className="hc-actions">
                    <button className="search-button" disabled={busy} onClick={() => act(acceptProposal)} type="button">
                      ACEPTAR
                    </button>
                    <button className="search-button cancel" disabled={busy} onClick={() => act(declineProposal)} type="button">
                      RECHAZAR
                    </button>
                  </div>
                ) : status === "confirmed" ? (
                  <span className="queue-note success">Ambos aceptaron — creando el set…</span>
                ) : (
                  <button className="secondary-button" disabled={busy} onClick={() => act(declineProposal)} type="button">
                    ACEPTASTE · CANCELAR
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="versus-mark">
                  <span className="orbit one" />
                  <span className="orbit two" />
                  <img src={`${A}/1985f.svg`} alt="" />
                </div>
                <h2>
                  {status === "matched" ? "¡A PELEAR!" : status === "failed" ? "NO SE PUDO CREAR EL SET" : searchingView ? "BUSCANDO RIVAL" : "LISTO PARA PELEAR"}
                </h2>
                <p>
                  {status === "anon" && "Inicia sesión con Discord (debes ser miembro de Hot Coffee 2XKO)."}
                  {status === "idle" && "Entra a la cola y te encontramos un rival de tu rango."}
                  {status === "loading" && "Consultando el estado de tu cola…"}
                  {searching && (state?.queue?.wide ? "Hay poca gente activa: ampliamos la búsqueda (puede tocarte una revancha)…" : "Buscando un rival de tu rango (partidas equitativas)…")}
                  {status === "matched" &&
                    (state?.match?.web
                      ? "Entra a la sala para armar tu equipo, compartir el código, chatear y reportar."
                      : "El hilo del set ya está en Discord. Arma tu equipo y a jugar.")}
                  {status === "failed" && "Hubo un problema lanzando el set (¿está el bot en línea?)."}
                </p>
                {searchingView && <span className="queue-flavor">{flavor}</span>}
                {searching && (
                  <div className="queue-time">
                    <strong>{clock(elapsed)}</strong>
                    <span>
                      {state?.queue?.players ?? 1} EN COLA · RIVAL DE TU RANGO
                    </span>
                  </div>
                )}
                {status === "anon" && <LoginLink className="search-button" />}
                {(status === "idle" || status === "failed") && (
                  <button
                    className="search-button"
                    disabled={busy}
                    onClick={() => {
                      setSearchStart(Date.now());
                      act(() => joinQueue());
                    }}
                    type="button"
                  >
                    <img src={`${A}/3508d.svg`} alt="" /> {status === "failed" ? "REINTENTAR" : "BUSCAR PARTIDA"}
                  </button>
                )}
                {searching && (
                  <button
                    className="search-button cancel"
                    disabled={busy}
                    onClick={() => {
                      setSearchStart(null);
                      act(() => leaveQueue());
                    }}
                    type="button"
                  >
                    CANCELAR BÚSQUEDA
                  </button>
                )}
                {status === "matched" &&
                  (state?.match?.web ? (
                    <Link href="/sala" className="search-button">
                      ENTRAR A LA SALA WEB
                    </Link>
                  ) : (
                    <a className="search-button" href={state?.match?.threadUrl || "https://discord.com/channels/"} target="_blank" rel="noreferrer">
                      ABRIR EL HILO EN DISCORD
                    </a>
                  ))}
              </>
            )}
            {error && <span className="queue-note danger">{error}</span>}
            <span className="queue-note">
              {searching ? "Puedes dejar esta pestaña abierta: te avisamos aquí cuando aparezca el rival." : "Al buscar, aceptas las reglas competitivas de Hot Coffee."}
            </span>
          </article>

          <aside className="match-rules panel">
            <div className="panel-heading">
              <h3>CÓMO FUNCIONA</h3>
              <span>AUTOMÁTICO</span>
            </div>
            <div className="rule">
              <span>1</span>
              <div>
                <small>ENTRAS A LA COLA</small>
                <strong>RIVAL DE TU RANGO</strong>
              </div>
            </div>
            <div className="rule">
              <span>2</span>
              <div>
                <small>AMBOS ACEPTAN</small>
                <strong>SE CREA EL SET FT 3</strong>
              </div>
            </div>
            <div className="rule">
              <span>3</span>
              <div>
                <small>JUEGAN Y REPORTAN</small>
                <strong>PUNTOS AL RANKING</strong>
              </div>
            </div>
            <p className="rule-note">
              Nadie parte con rango: juegas 5 sets de clasificación y tu desempeño en ellos define tu rango inicial.
              El emparejamiento es por rango (Gold I, II y III son el mismo nivel), con racha de 3 victorias se te sube
              un rival de rango superior y vencer a un rango más alto paga más puntos. Si esperas demasiado, la búsqueda se amplía.
            </p>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
