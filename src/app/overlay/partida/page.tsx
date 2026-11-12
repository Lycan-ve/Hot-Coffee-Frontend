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

// Overlay de PARTIDA 1920×1080 para OBS — diseño TSH 2XKO (barras skewX 12°,
// chips tintados, barra superior central, banner inferior) conectado al
// MATCHMAKING de Hot Coffee y respetando las Death Zones del HUD.
//
// Con &token=<token de Hot Coffee> sigue la cola en vivo:
//   BUSCANDO → RIVAL ENCONTRADO (VS + cuenta atrás) → SET EN VIVO → RESULTADO.
// Sin token funciona en modo manual (?p1=&p2=&s1=&s2=…).
//
// Parámetros:
//   &token=<jwt>      token de Hot Coffee (la web te da la URL lista para copiar)
//   &id1=<discordId>  tu perfil (tarjeta al esperar, modo manual)
//   &p1=&p2=&s1=&s2=  nombres y marcador manuales
//   &p1chars=EKKO,JINX&p2chars=BRAUM,ILLAOI   chip de equipo
//   &p1fuse=DOUBLE DOWN&p2fuse=FREESTYLE      chip de fuse
//   &p1tw=@canal&p1pr=Él              chips de redes/pronombres
//   &round=&event=    textos de la barra superior / banner inferior
//   &zones=1          pinta las Death Zones (verificación)
//   &bg=dark          fondo sólido de prueba
//   &bgimg=<url>      imagen de fondo detrás del overlay (prueba o uso sin captura del juego)
//   &bgimg=0          sin imagen de fondo (transparente, para OBS sobre el juego)

// Zonas "Death": el HUD del juego vive aquí. PROHIBIDO tocar.
const DEATH_ZONES = [
  { x: 0, y: 168, w: 560, h: 302 },    // panel HUD superior izquierda (ASSIST/HITS)
  { x: 1360, y: 168, w: 560, h: 302 }, // panel HUD superior derecha
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

type Chip = { text: string; rank?: RankInfo; tone?: "ok" | "wait" | "fuse1" | "fuse2" } | null;

function RankIcon({ rank }: { rank?: RankInfo }) {
  if (!rank?.iconPath) return null;
  return (
    <img
      className="tsh-rank-ico"
      src={rankIconUrl(rank.iconPath)}
      alt=""
      onError={(e) => {
        const fb = rankIconFallbackUrl(rank.iconPath);
        if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
      }}
    />
  );
}

/** Bloque de jugador estilo TSH: avatar + nombre + marcador, y chips debajo. */
function PlayerBlock(props: {
  right?: boolean;
  name: string;
  avatar?: string;
  score: string;
  chips: Chip[];
  show?: boolean;
}) {
  const { right, name, avatar, score, chips, show = true } = props;
  if (!show) return null;
  return (
    <>
      <div className={`tsh-player ${right ? "tsh-p2" : "tsh-p1"}`}>
        <div className="tsh-avatar">
          {avatar ? (
            <img src={avatar} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <span>☕</span>
          )}
        </div>
        <div className="tsh-name" data-len={name.length > 16 ? "xl" : name.length > 12 ? "l" : undefined}>{name}</div>
        <div className="tsh-score"><span>{score}</span></div>
      </div>
      {chips.some(Boolean) && (
        <div className={`tsh-chips ${right ? "tsh-p2chips" : "tsh-p1chips"}`}>
          {chips.filter(Boolean).map((c, i) => (
            <span key={i} className={`tsh-chip ${c?.tone ? `tsh-chip-${c.tone}` : ""}`}>
              {c?.rank && <RankIcon rank={c.rank} />}
              {c?.text}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function OverlayInner() {
  const params = useSearchParams();
  const q = (k: string, d = "") => params.get(k) ?? d;
  const bg = q("bg");
  const bgimgParam = q("bgimg");
  // Fondo por defecto: imagen del repo. Con &bgimg=0 se apaga
  // (necesario en OBS cuando el browser source va sobre la captura del juego).
  const bgimg = bgimgParam === "0" ? "" : (bgimgParam || "/overlay/stage.png");
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

  // Tarjeta personal en espera (modo manual, con &id1=).
  const id1 = q("id1");
  const meCard = useQuery({
    queryKey: ["ov2-me", id1],
    queryFn: () => fetchUserProfile(id1),
    enabled: !!id1 && !token,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  // ——— Estado → contenido ———
  let p1: React.ReactNode = null;
  let p2: React.ReactNode = null;
  let matchTxt = q("round", "HOT COFFEE · 2XKO").toUpperCase();
  let phaseTxt = "";
  let bottomTxt = q("event", "HOT COFFEE · MATCHMAKING").toUpperCase();
  let bottomSub = "";

  const rankChip = (p: { points: number; rank: RankInfo; wins?: number; losses?: number }): Chip[] => [
    { text: p.rank?.displayName ?? "—", rank: p.rank },
    { text: `${p.points} PTS` },
    typeof p.wins === "number" ? { text: `${p.wins}W — ${p.losses ?? 0}L` } : null,
  ];

  if (token && st === "searching") {
    const since = queue.data?.queue?.since ? new Date(queue.data.queue.since).getTime() : now;
    matchTxt = "BUSCANDO RIVAL";
    phaseTxt = `EN COLA ${clock(now - since)} · FT ${queue.data?.queue?.ft ?? 3}`;
    bottomTxt = q("event", "HOT COFFEE · MATCHMAKING").toUpperCase();
    bottomSub = `${queue.data?.queue?.players ?? 1} EN COLA · RIVAL DE TU RANGO`;
  } else if (token && prop && (st === "found" || st === "confirmed")) {
    const remaining = new Date(prop.expiresAt).getTime() - now;
    p1 = (
      <PlayerBlock
        name={prop.me.tag}
        avatar={prop.me.avatarUrl}
        score="0"
        chips={[...rankChip(prop.me), prop.acceptedByMe ? { text: "✓ LISTO", tone: "ok" } : { text: "ESPERANDO…", tone: "wait" }]}
      />
    );
    p2 = (
      <PlayerBlock
        right
        name={prop.opponent.tag}
        avatar={prop.opponent.avatarUrl}
        score="0"
        chips={[...rankChip(prop.opponent), prop.acceptedByOpponent ? { text: "✓ LISTO", tone: "ok" } : { text: "ESPERANDO…", tone: "wait" }]}
      />
    );
    matchTxt = st === "confirmed" ? "CREANDO EL SET…" : "¡RIVAL ENCONTRADO!";
    phaseTxt = st === "confirmed" ? `FT ${prop.ft}` : `ACEPTA EN ${clock(remaining)}`;
    bottomTxt = `FT ${prop.ft} · ${prop.pointsAtStake} PTS EN JUEGO`;
  } else if (token && live && match) {
    const teamChip = (t: SalaTeam): Chip =>
      t?.complete ? { text: `${t.char1Name} / ${t.char2Name}${t.fuseName ? ` · ${t.fuseName}` : ""}` } : null;
    p1 = (
      <PlayerBlock
        name={match.me.tag}
        avatar={match.me.avatarUrl}
        score={String(match.me.score)}
        chips={[...rankChip(match.me), teamChip(match.me.team)]}
      />
    );
    p2 = (
      <PlayerBlock
        right
        name={match.opponent.tag}
        avatar={match.opponent.avatarUrl}
        score={String(match.opponent.score)}
        chips={[...rankChip(match.opponent), teamChip(match.opponent.team)]}
      />
    );
    matchTxt = `FT ${match.ft} · EN VIVO`;
    phaseTxt = q("round", "").toUpperCase();
    bottomTxt = `SALA #${match.id}${match.roomCode ? ` · CÓDIGO ${match.roomCode}` : ""}`;
  } else if (token && finished && match) {
    p1 = <PlayerBlock name={match.me.tag} avatar={match.me.avatarUrl} score={String(match.me.score)} chips={rankChip(match.me)} />;
    p2 = <PlayerBlock right name={match.opponent.tag} avatar={match.opponent.avatarUrl} score={String(match.opponent.score)} chips={rankChip(match.opponent)} />;
    matchTxt = match.status === "CANCELLED" ? "SET CANCELADO" : "SET TERMINADO";
    phaseTxt = `MARCADOR FINAL ${match.me.score} — ${match.opponent.score}`;
    bottomTxt = "GRACIAS POR JUGAR · HOT COFFEE";
  } else if (!token) {
    // Modo manual (o tarjeta personal con &id1=).
    const me = meCard.data;
    const chars = (key: string, fallback?: string) =>
      (q(key) || fallback || "").split(",").map((c) => c.trim()).filter(Boolean).join(" / ");
    p1 = (
      <PlayerBlock
        name={q("p1") || me?.user.globalName || me?.user.username || "PLAYER 1"}
        avatar={me?.user.avatarUrl}
        score={q("s1", "0")}
        chips={[
          q("p1chars") || me?.mains ? { text: chars("p1chars", [me?.mains?.point?.name, me?.mains?.assist?.name].filter(Boolean).join(",")) } : null,
          q("p1fuse") ? { text: q("p1fuse").toUpperCase(), tone: "fuse1" } : null,
          q("p1tw") ? { text: q("p1tw") } : null,
          q("p1pr") ? { text: q("p1pr") } : null,
        ]}
        show={!!(q("p1") || me)}
      />
    );
    p2 = (
      <PlayerBlock
        right
        name={q("p2") || "PLAYER 2"}
        score={q("s2", "0")}
        chips={[
          q("p2chars") ? { text: chars("p2chars") } : null,
          q("p2fuse") ? { text: q("p2fuse").toUpperCase(), tone: "fuse2" } : null,
          q("p2tw") ? { text: q("p2tw") } : null,
          q("p2pr") ? { text: q("p2pr") } : null,
        ]}
        show={!!q("p2")}
      />
    );
  }

  // URL lista para OBS (solo visible en navegador con sesión).
  const obsUrl =
    typeof window !== "undefined" && token && !isOBS
      ? `${window.location.origin}/overlay/partida?token=${encodeURIComponent(token)}${id1 ? `&id1=${encodeURIComponent(id1)}` : ""}`
      : null;

  return (
    <div className={`tsh-viewport ${bg === "dark" ? "tsh-dark" : ""}`}>
      {bgimg && <img className="tsh-bgimg" src={bgimg} alt="" />}
      <div className="tsh-stage" style={{ transform: `scale(${k})` }}>
        {showZones &&
          DEATH_ZONES.map((z, i) => (
            <div key={i} className="tsh-zone" style={{ left: z.x, top: z.y, width: z.w, height: z.h }} title="Death Zone" />
          ))}

        {p1}
        {p2}

        {/* Barra superior central: estado del matchmaking / ronda */}
        <div className="tsh-top">
          <div className="tsh-top-bg tsh-top-bg1" />
          <div className="tsh-top-bg tsh-top-bg2" />
          <div className="tsh-match">{matchTxt}</div>
          {phaseTxt && <div className="tsh-phase">{phaseTxt}</div>}
        </div>

        {/* Banner inferior: evento / sala */}
        <div className="tsh-bottom">
          <div className="tsh-bottom-bg tsh-bottom-bg1" />
          <div className="tsh-bottom-bg tsh-bottom-bg2" />
          <div className="tsh-tname">{bottomTxt}</div>
          {bottomSub && <div className="tsh-phase">{bottomSub}</div>}
        </div>

        {obsUrl && (
          <div className="tsh-setup">
            <strong>URL PARA OBS (fuente Navegador, 1920×1080):</strong>
            <code>{obsUrl}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(obsUrl).catch(() => {})}>
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