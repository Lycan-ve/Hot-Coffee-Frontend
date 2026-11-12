'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  API_URL,
  fetchUserProfile,
  getToken,
  rankIconFallbackUrl,
  rankIconUrl,
  type RankInfo,
} from "@/lib/auth";
import "../../../hotcoffee-overlay-partida.css";

// Overlay de PARTIDA 1920×1080 para OBS — conectado al MATCHMAKING.
// Con &token=<token de Hot Coffee> el overlay sigue la cola en vivo:
//   BUSCANDO → RIVAL ENCONTRADO (VS con cuenta atrás) → SET EN VIVO
//   (marcador, equipos, código de sala) → RESULTADO.
// Sin token sigue funcionando el modo manual (?p1=&p2=&s1=&s2=…).
//
// Parámetros:
//   &token=<jwt>     token de Hot Coffee (la web te da la URL lista para copiar)
//   &id1=<discordId> tu perfil (tarjeta personal cuando no hay partida)
//   &round=&event=   textos de ronda/banner en espera
//   &zones=1         pinta las Death Zones (verificación)
//   &bg=dark         fondo sólido de prueba

// Zonas "Death": el HUD del juego vive aquí. PROHIBIDO tocar.
const DEATH_ZONES = [
  { x: 0, y: 165, w: 560, h: 305 },    // panel HUD superior izquierda (ASSIST/HITS)
  { x: 1360, y: 165, w: 560, h: 305 }, // panel HUD superior derecha
  { x: 0, y: 690, w: 560, h: 324 },    // HUD inferior izquierda (controles/barras)
  { x: 1360, y: 690, w: 560, h: 324 }, // HUD inferior derecha
  { x: 0, y: 1014, w: 1920, h: 66 },   // franja inferior (versión/IDs del juego)
];

interface QPlayer {
  discordId: string;
  tag: string;
  avatarUrl: string;
  points: number;
  rank: RankInfo;
  wins?: number;
  losses?: number;
  streak?: number;
}
interface QueueState {
  status: "idle" | "searching" | "found" | "confirmed" | "matched" | "failed";
  queue?: { ft: number; since: string; players: number };
  proposal?: {
    ft: number;
    pointsAtStake: number;
    me: QPlayer;
    opponent: QPlayer;
    acceptedByMe: boolean;
    acceptedByOpponent: boolean;
    expiresAt: string;
  };
  match?: { id: number; web: boolean };
}
interface SalaTeam { char1Name: string; char2Name: string; fuseName: string; complete: boolean }
interface SalaPlayer { discordId: string; tag: string; avatarUrl: string; points: number; rank: RankInfo; score: number; team: SalaTeam }
interface SalaMatch {
  id: number;
  ft: number;
  pointsAtStake: number;
  roomCode: string;
  status: "IN_PROGRESS" | "PENDING_VERIFY" | "PENDING_CLOSE" | "FINISHED" | "CANCELLED";
  me: SalaPlayer;
  opponent: SalaPlayer;
}
interface SalaState { match: SalaMatch | null }

async function fetchQueue(token: string): Promise<QueueState | null> {
  try {
    const res = await fetch(`${API_URL}/api/matchmaking/queue/state`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as QueueState) : null;
  } catch {
    return null;
  }
}

async function fetchSala(token: string): Promise<SalaState | null> {
  try {
    const res = await fetch(`${API_URL}/api/matchmaking/match/state?after=0`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as SalaState) : null;
  } catch {
    return null;
  }
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function RankIcon({ rank }: { rank?: RankInfo }) {
  if (!rank?.iconPath) return null;
  return (
    <img
      className="ov2-rank-ico"
      src={rankIconUrl(rank.iconPath)}
      alt=""
      onError={(e) => {
        const fb = rankIconFallbackUrl(rank.iconPath);
        if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
      }}
    />
  );
}

/** Tarjeta de jugador en la franja superior segura. */
function Side(props: {
  p: { tag: string; avatarUrl: string; points: number; rank: RankInfo; wins?: number; losses?: number };
  right?: boolean;
  score?: string;
  ready?: boolean | null; // true = aceptó, false = esperando, null = no aplica
}) {
  const { p, right, score, ready } = props;
  const portrait = p.avatarUrl ? (
    <img className="ov2-portrait" src={p.avatarUrl} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
  ) : (
    <span className="ov2-portrait ov2-portrait-fb">☕</span>
  );
  const scoreBox = score !== undefined ? <span className={`ov2-score ${right ? "ov2-score-p2" : "ov2-score-p1"}`}>{score}</span> : null;
  return (
    <div className={`ov2-side ${right ? "ov2-p2" : "ov2-p1"}`}>
      {!right && portrait}
      <div className="ov2-stack">
        <div className="ov2-row">
          {right && scoreBox}
          <span className="ov2-name">{p.tag}</span>
          {!right && scoreBox}
        </div>
        <div className={`ov2-chips ${right ? "ov2-chips-right" : ""}`}>
          <span className="ov2-chip ov2-chip-dark">
            <RankIcon rank={p.rank} />
            <b style={{ color: p.rank?.color || "#fff" }}>{p.rank?.displayName ?? "—"}</b>
          </span>
          <span className="ov2-chip">{p.points} PTS</span>
          {typeof p.wins === "number" && (
            <span className="ov2-chip">
              {p.wins}W — {p.losses ?? 0}L
            </span>
          )}
          {ready === true && <span className="ov2-chip ov2-chip-ok">✓ LISTO</span>}
          {ready === false && <span className="ov2-chip ov2-chip-wait">ESPERANDO…</span>}
        </div>
      </div>
      {right && portrait}
    </div>
  );
}

function OverlayInner() {
  const params = useSearchParams();
  const q = (k: string, d = "") => params.get(k) ?? d;
  const bg = q("bg");
  const showZones = q("zones") === "1";
  const extra = Number(q("scale")) || 1;

  // Token: por URL (OBS) o sesión del navegador (configuración).
  const [sessToken, setSessToken] = useState<string>("");
  useEffect(() => setSessToken(getToken() ?? ""), []);
  const token = q("token") || sessToken;
  const isOBS = typeof navigator !== "undefined" && /OBS/i.test(navigator.userAgent);

  // Fondo transparente para OBS, sin tocar el resto de la web.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  // Escalado del escenario 1920×1080 al tamaño de la fuente de OBS.
  const [k, setK] = useState(1);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / 1920, window.innerHeight / 1080) * extra);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [extra]);

  // Segundero para cuentas atrás y cronómetros.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // AUTO: cola y sala en vivo (solo con token).
  const queue = useQuery({
    queryKey: ["ov2-queue", token],
    queryFn: () => fetchQueue(token),
    enabled: !!token,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });
  const st = queue.data?.status;
  const prop = queue.data?.proposal;
  const inMatch = st === "matched";
  const sala = useQuery({
    queryKey: ["ov2-sala", token],
    queryFn: () => fetchSala(token),
    enabled: !!token && inMatch,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });
  const match = sala.data?.match ?? null;
  const live = !!match && match.status !== "FINISHED" && match.status !== "CANCELLED";
  const finished = !!match && (match.status === "FINISHED" || match.status === "CANCELLED");

  // Tarjeta personal en espera (opcional, con &id1=).
  const id1 = q("id1");
  const meCard = useQuery({
    queryKey: ["ov2-me", id1],
    queryFn: () => fetchUserProfile(id1),
    enabled: !!id1 && !token,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  // ——— Qué se muestra en cada zona ———
  let left: React.ReactNode = null;
  let right: React.ReactNode = null;
  let roundTxt = q("round", "MATCHMAKING · HOT COFFEE").toUpperCase();
  let mid: React.ReactNode = null;
  let banner = q("event", "HOT COFFEE · 2XKO").toUpperCase();

  if (token && st === "searching") {
    const since = queue.data?.queue?.since ? new Date(queue.data.queue.since).getTime() : now;
    roundTxt = "BUSCANDO RIVAL";
    mid = <span className="ov2-mid ov2-dim">{clock(now - since)}</span>;
    banner = `COLA ACTIVA · ${queue.data?.queue?.players ?? 1} EN COLA · RIVAL DE TU RANGO`;
  } else if (token && prop && (st === "found" || st === "confirmed")) {
    const remaining = new Date(prop.expiresAt).getTime() - now;
    left = <Side p={prop.me} ready={prop.acceptedByMe} />;
    right = <Side p={prop.opponent} right ready={prop.acceptedByOpponent} />;
    roundTxt = st === "confirmed" ? "CREANDO EL SET…" : "¡RIVAL ENCONTRADO!";
    mid = st === "confirmed" ? <span className="ov2-mid ov2-dim">FT {prop.ft}</span> : <span className="ov2-mid ov2-dim">{clock(remaining)}</span>;
    banner = `FT ${prop.ft} · ${prop.pointsAtStake} PTS EN JUEGO`;
  } else if (token && live && match) {
    left = (
      <Side
        p={match.me}
        score={String(match.me.score)}
      />
    );
    right = (
      <Side
        p={match.opponent}
        right
        score={String(match.opponent.score)}
      />
    );
    roundTxt = `FT ${match.ft} · EN VIVO`;
    mid = (
      <span className="ov2-mid ov2-live">
        {match.me.score}<i>—</i>{match.opponent.score}
      </span>
    );
    banner = `SALA #${match.id}${match.roomCode ? ` · CÓDIGO ${match.roomCode}` : ""}`;
  } else if (token && finished && match) {
    left = <Side p={{ ...match.me, wins: undefined, losses: undefined }} />;
    right = <Side p={{ ...match.opponent, wins: undefined, losses: undefined }} right />;
    roundTxt = match.status === "CANCELLED" ? "SET CANCELADO" : "SET TERMINADO";
    mid = (
      <span className="ov2-mid">
        {match.me.score}<i>—</i>{match.opponent.score}
      </span>
    );
    banner = "GRACIAS POR JUGAR · HOT COFFEE";
  } else if (!token && meCard.data) {
    // Modo compacto (sin token): tarjeta personal del streamer.
    const me = meCard.data;
    left = (
      <Side
        p={{
          tag: me.user.globalName || me.user.username,
          avatarUrl: me.user.avatarUrl,
          points: me.rank.points ?? me.stats.points,
          rank: me.rank,
          wins: me.stats.wins,
          losses: me.stats.losses,
        }}
        score={undefined}
      />
    );
    roundTxt = q("round", "HOT COFFEE · 2XKO").toUpperCase();
  }

  // URL lista para OBS (solo visible en navegador con sesión).
  const obsUrl =
    typeof window !== "undefined" && token && !isOBS
      ? `${window.location.origin}/overlay/partida?token=${encodeURIComponent(token)}${id1 ? `&id1=${encodeURIComponent(id1)}` : ""}`
      : null;

  return (
    <div className={`ov2-viewport ${bg === "dark" ? "ov2-dark" : ""}`}>
      <div className="ov2-stage" style={{ transform: `scale(${k})` }}>
        {showZones &&
          DEATH_ZONES.map((z, i) => (
            <div key={i} className="ov2-zone" style={{ left: z.x, top: z.y, width: z.w, height: z.h }} title="Death Zone" />
          ))}

        {left}
        {right}

        <div className="ov2-center">
          <span className="ov2-round">{roundTxt}</span>
          {mid}
        </div>

        <div className="ov2-event"><span>{banner}</span></div>

        {obsUrl && (
          <div className="ov2-setup">
            <strong>URL PARA OBS (fuente Navegador, 1920×1080):</strong>
            <code>{obsUrl}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(obsUrl).catch(() => {})}
            >
              Copiar
            </button>
            <small>El token da acceso a tu cuenta: no compartas esa URL ni la pegues en chats.</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OverlayPartidaPage() {
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
