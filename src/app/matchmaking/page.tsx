'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { A, AppShell, RankBadge, SectionTitle } from "@/components/hc/shared";
import { displayName, LoginLink } from "@/components/hc/DiscordLogin";
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

function VsCard({ name, avatar, points, rank, ok }: { name: string; avatar?: string; points: number; rank: RankInfo; ok: boolean }) {
  return (
    <div className={`hc-vs-card ${ok ? "ok" : ""}`}>
      {avatar ? <img className="av" src={avatar} alt="" /> : <span className="av">{name[0]}</span>}
      <strong>{name}</strong>
      <RankBadge small rank={rank} />
      <span>{rank.displayName} · {points} pts</span>
      <small>{ok ? "✓ ACEPTÓ" : "ESPERANDO"}</small>
    </div>
  );
}

export default function MatchmakingPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [state, setState] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
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
          <aside className="fighter-summary panel">
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
                  <RankBadge small rank={me.rank} />
                  <div>
                    <span>{displayName(me)}</span>
                    <strong>{me.rank.displayName.toUpperCase()}</strong>
                    <p>
                      {me.stats.points} PTS{me.stats.rankingPosition > 0 ? ` · #${me.stats.rankingPosition}` : ""}
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
                </div>
              </>
            ) : (
              <p className="hc-empty">Inicia sesión para ver tu rango y entrar a la cola.</p>
            )}
          </aside>

          <article className={`queue-console cut-panel ${searching ? "searching" : ""}`}>
            <div className="queue-grid" />
            <span className="queue-kicker">
              {status === "anon" && "INICIA SESIÓN PARA JUGAR"}
              {status === "loading" && "CONECTANDO CON LA COLA…"}
              {status === "idle" && "COLA COMPETITIVA DISPONIBLE"}
              {searching && "BUSCANDO RIVAL · FT 3"}
              {(status === "found" || status === "confirmed") && "¡RIVAL ENCONTRADO!"}
              {status === "matched" && "SET CREADO"}
              {status === "failed" && "ALGO SALIÓ MAL"}
            </span>

            {(status === "found" || status === "confirmed") && state?.proposal ? (
              <>
                <div className="hc-vs">
                  <VsCard name={state.proposal.me.tag} avatar={state.proposal.me.avatarUrl} points={state.proposal.me.points} rank={state.proposal.me.rank} ok={state.proposal.acceptedByMe} />
                  <div className="mid">
                    <b>VS</b>
                    <span>{clock(remaining)}</span>
                  </div>
                  <VsCard name={state.proposal.opponent.tag} avatar={state.proposal.opponent.avatarUrl} points={state.proposal.opponent.points} rank={state.proposal.opponent.rank} ok={state.proposal.acceptedByOpponent} />
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
                  {status === "matched" ? "¡A PELEAR!" : status === "failed" ? "NO SE PUDO CREAR EL SET" : searching ? "BUSCANDO RIVAL" : "LISTO PARA PELEAR"}
                </h2>
                <p>
                  {status === "anon" && "Inicia sesión con Discord (debes ser miembro de Hot Coffee 2XKO)."}
                  {status === "idle" && "Entra a la cola y te encontramos un rival de tu rango."}
                  {status === "loading" && "Consultando el estado de tu cola…"}
                  {searching && "Buscando un rival de tu rango (partidas equitativas)…"}
                  {status === "matched" &&
                    (state?.match?.web
                      ? "Entra a la sala para armar tu equipo, compartir el código, chatear y reportar."
                      : "El hilo del set ya está en Discord. Arma tu equipo y a jugar.")}
                  {status === "failed" && "Hubo un problema lanzando el set (¿está el bot en línea?)."}
                </p>
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
                  <button className="search-button" disabled={busy} onClick={() => act(() => joinQueue())} type="button">
                    <img src={`${A}/3508d.svg`} alt="" /> {status === "failed" ? "REINTENTAR" : "BUSCAR PARTIDA"}
                  </button>
                )}
                {searching && (
                  <button className="search-button cancel" disabled={busy} onClick={() => act(leaveQueue)} type="button">
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
              El emparejamiento es por rango (Gold I, II y III son el mismo nivel). Con racha de 3 victorias se te sube un rival
              de rango superior, y vencer a un rango más alto paga más puntos. Si esperas demasiado, la búsqueda se amplía.
            </p>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
