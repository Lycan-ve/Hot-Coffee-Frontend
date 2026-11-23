'use client';

// Rankings de torneos y online en la portada: podio con el arte de los
// personajes para el top 3 y filas compactas del 4 al 8, con datos reales
// del backend y atajo a las tablas completas.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronRight, Swords, Trophy } from "lucide-react";
import { API_URL, fetchMe, fetchUserProfile, type MeResponse } from "@/lib/auth";
import { SectionTitle } from "@/components/hc/shared";
import "./home-rankings.css";

type RankPlayer = {
  id?: number | string;
  ranking: number;
  gamerTag: string;
  sponsor?: string;
  character?: string;
  avatarUrl?: string;
  discordId?: string;
  points: number;
};

type MmPlayer = {
  discordId: string;
  username: string;
  avatarUrl?: string;
  points: number;
  wins: number;
  losses: number;
  ranking: number;
  glickoRating?: number;
  glickoRD?: number;
};

type TournamentInfo = {
  number: number;
  name: string;
};

type Row = {
  key: string;
  pos: number;
  name: string;
  sponsor?: string;
  avatar?: string;
  character?: string;
  discordId?: string;
  sub?: string;
  // null = jugador aún en clasificación (sin rango): se muestra "—".
  points: number | null;
  profileId?: string;
  isMe?: boolean;
  /** Solo matchmaking: sets jugados (alimenta los rombos de clasificación). */
  games?: number;
};

const TOP = 8;
// Puntos base que el ladder de matchmaking suma a los puntos ganados
// (mismo criterio que /ranking-matchmaking). Los jugadores en clasificación
// (menos de 5 sets) no muestran puntos todavía.
const PLACEMENT_GAMES = 5;

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Normaliza el nombre de un personaje para localizar su arte
// ("YASUO, ekko" → "Yasuo").
const normFighter = (raw?: string): string | undefined => {
  const n = raw?.split(/[,/]/)[0]?.trim();
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

async function fetchTournamentCount(): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/tournaments/count`);
    const data = res.ok ? await res.json() : null;
    const n = Number(data?.count);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function fetchTournaments(): Promise<TournamentInfo[]> {
  try {
    const res = await fetch(`${API_URL}/api/tournaments/list`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tournaments) ? (data.tournaments as TournamentInfo[]) : [];
  } catch {
    return [];
  }
}

async function fetchSeasonRanking(): Promise<RankPlayer[]> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/2xko`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length) {
      return [...(data as RankPlayer[])].sort((a, b) => a.ranking - b.ranking);
    }
  } catch {
    /* sin conexión */
  }
  return [];
}

async function fetchTournamentRanking(n: number): Promise<RankPlayer[]> {
  try {
    const params = new URLSearchParams({ from: String(n), to: String(n) });
    const res = await fetch(`${API_URL}/api/rankings/2xko?${params.toString()}`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length) {
      return [...(data as RankPlayer[])].sort((a, b) => a.ranking - b.ranking);
    }
  } catch {
    /* sin conexión */
  }
  return [];
}

async function fetchMatchmaking(): Promise<MmPlayer[]> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/matchmaking`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data as MmPlayer[];
    }
  } catch {
    /* sin conexión */
  }
  return [];
}

// Rombo de clasificación (estilo pips de la maqueta): 5 rombos, los
// completados en dorado. Se lee de un vistazo, sin texto.
function PlacementPips({ done, total = PLACEMENT_GAMES }: { done: number; total?: number }) {
  return (
    <span className="hm-pips" title={`Clasificación: ${Math.min(done, total)} de ${total} sets`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? "f" : ""} />
      ))}
    </span>
  );
}

// Arte del podio: cadena de candidatos (personaje → avatar), con fallback
// silencioso al siguiente.
function PodiumArt({ srcs, alt }: { srcs: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (!srcs.length) return null;
  return (
    <img
      src={srcs[Math.min(idx, srcs.length - 1)]}
      alt={alt}
      loading="lazy"
      onError={() => setIdx((i) => Math.min(i + 1, srcs.length - 1))}
    />
  );
}

export default function HomeRankings() {
  const [mode, setMode] = useState<"torneos" | "online">("torneos");
  const [tournView, setTournView] = useState<"season" | number>("season");
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMe().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { data: count, isLoading: countLoading } = useQuery({
    queryKey: ["home-tourney-count"],
    queryFn: fetchTournamentCount,
    staleTime: 300_000,
  });
  const total = count ?? 0;
  const { data: tournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: fetchTournaments,
    staleTime: 300_000,
  });

  // Acumulado de la temporada completa.
  const { data: season, isLoading: seasonLoading } = useQuery({
    queryKey: ["home-ranking-season"],
    queryFn: fetchSeasonRanking,
    enabled: mode === "torneos",
    staleTime: 60_000,
  });

  // Últimos 3 torneos individuales (mismo patrón from/to que el ranking).
  const lastNs = [0, 1, 2].map((off) => total - off).filter((n) => n >= 1);
  const perQs = useQueries({
    queries: lastNs.map((n) => ({
      queryKey: ["home-ranking-tourney", n],
      queryFn: () => fetchTournamentRanking(n),
      enabled: mode === "torneos" && total > 0,
      staleTime: 300_000,
    })),
  });

  const { data: mm, isLoading: mmLoading } = useQuery({
    queryKey: ["ranking-matchmaking"],
    queryFn: fetchMatchmaking,
    enabled: mode === "online",
    staleTime: 60_000,
  });

  const tourneyName = (n: number) => {
    const t = (tournaments ?? []).find((x) => x.number === n);
    return t ? t.name : `Torneo #${n}`;
  };

  const rows: Row[] = [];
  let loading = false;

  if (mode === "torneos") {
    if (tournView === "season") {
      loading = seasonLoading || countLoading;
      (season ?? []).slice(0, TOP).forEach((p) =>
        rows.push({
          key: `${p.ranking}-${p.gamerTag}`,
          pos: p.ranking,
          name: p.gamerTag,
          sponsor: p.sponsor,
          character: p.character,
          avatar: p.avatarUrl,
          points: p.points,
          profileId: p.discordId || (p.id != null ? String(p.id) : ""),
          isMe: !!me && !!p.discordId && p.discordId === me.user.discordId,
        }),
      );
    } else {
      const qi = lastNs.indexOf(tournView);
      const q = qi >= 0 ? perQs[qi] : undefined;
      loading = q?.isLoading ?? false;
      (q?.data ?? []).slice(0, TOP).forEach((p) =>
        rows.push({
          key: `${p.ranking}-${p.gamerTag}`,
          pos: p.ranking,
          name: p.gamerTag,
          sponsor: p.sponsor,
          character: p.character,
          avatar: p.avatarUrl,
          points: p.points,
          profileId: p.discordId || (p.id != null ? String(p.id) : ""),
          isMe: !!me && !!p.discordId && p.discordId === me.user.discordId,
        }),
      );
    }
  } else {
    loading = mmLoading;
    (mm ?? []).slice(0, TOP).forEach((p) => {
      const games = p.wins + p.losses;
      const placing = games < PLACEMENT_GAMES;
      rows.push({
        key: p.discordId,
        pos: p.ranking,
        name: p.username,
        avatar: p.avatarUrl,
        discordId: p.discordId,
        sub: placing
          ? `Clasificando ${games}/${PLACEMENT_GAMES}`
          : `${p.wins}V · ${p.losses}D`,
        points: Math.max(0, p.points),
        profileId: p.discordId,
        isMe: !!me && p.discordId === me.user.discordId,
        games,
      });
    });
  }

  // Perfiles del podio en modo online: dan el arte (personajes) de cada uno.
  const podium = rows.slice(0, 3);
  const podiumProfQs = useQueries({
    queries:
      mode === "online"
        ? podium.map((r) => ({
            queryKey: ["profile", r.profileId],
            queryFn: () => fetchUserProfile(String(r.profileId)),
            staleTime: 120_000,
          }))
        : [],
  });
  const podiumArt = (i: number, r: Row): string[] => {
    if (mode === "online") {
      const mains = podiumProfQs[i]?.data?.mains;
      const out: string[] = [];
      if (mains?.point?.id) out.push(`/fighters/${encodeURIComponent(mains.point.id)}.png`);
      if (mains?.assist?.id) out.push(`/fighters/${encodeURIComponent(mains.assist.id)}.png`);
      if (r.avatar) out.push(r.avatar);
      return out;
    }
    const fighter = normFighter(r.character);
    return fighter ? [`/fighters/${encodeURIComponent(fighter)}.png`] : r.avatar ? [r.avatar] : [];
  };

  const isSeason = mode === "torneos" && tournView === "season";

  // Podio: el top 3 se ve (arte + nombre + puntos), no se lee en tabla.
  const podiumHtml = (
    <div className="hm-podium">
      {podium.map((r, i) => {
        const href = r.profileId ? `/perfil/${String(r.profileId)}` : "#rankings";
        return (
          <Link key={r.key} href={href} className={`hm-pod p${i + 1}`}>
            <span className="hm-pod-art">
              <PodiumArt srcs={podiumArt(i, r)} alt="" />
            </span>
            <span className="hm-pod-rk">{i + 1}</span>
            {r.isMe ? <i className="hm-pod-you">Tú</i> : null}
            <span className="hm-pod-who">
              {r.avatar ? (
                <img className="hm-pod-av" src={r.avatar} alt="" loading="lazy" />
              ) : (
                <span className="hm-pod-av">{r.name.trim()[0].toUpperCase()}</span>
              )}
              <span className="hm-pod-name">
                <b>{r.name}</b>
                <small>
                  {r.sponsor ? `#${r.sponsor} · ` : ""}
                  {mode === "online" ? r.sub : (r.character ?? "—")}
                </small>
              </span>
              <span className="hm-pod-pts">
                {r.points == null ? "—" : fmt(r.points)}
                <small>{mode === "online" ? "RP" : isSeason ? "PTS TEMP." : "PTS"}</small>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <section className="hm-rankings" id="rankings">
      <SectionTitle
        eyebrow="TABLAS DE CLASIFICACIÓN OFICIALES"
        title="VISUALIZA TU"
        accent="RANKING"
        copy="Top 8 en vivo: acumulado de la temporada de torneos y escalera de matchmaking. La tabla completa vive en su propia página."
      />
      <article className="panel hm-rank-panel">
        <div className="hm-rank-head">
          <div className="hm-rank-tabs" role="tablist" aria-label="Tipo de ranking">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "torneos"}
              className={`hm-rank-tab${mode === "torneos" ? " on" : ""}`}
              onClick={() => setMode("torneos")}
            >
              <Trophy /> Torneos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "online"}
              className={`hm-rank-tab${mode === "online" ? " on" : ""}`}
              onClick={() => setMode("online")}
            >
              <Swords /> Matchmaking
            </button>
          </div>
          <Link className="hm-rank-more" href={mode === "torneos" ? "/ranking" : "/ranking-matchmaking"}>
            Ver tabla completa <ChevronRight />
          </Link>
        </div>

        {mode === "torneos" && total > 0 && (
          <div className="hm-rank-filters">
            <button
              type="button"
              className={`hm-rank-chip${tournView === "season" ? " on" : ""}`}
              onClick={() => setTournView("season")}
            >
              Temporada completa ({total} torneos)
            </button>
            {lastNs.map((n) => (
              <button
                key={n}
                type="button"
                className={`hm-rank-chip${tournView === n ? " on" : ""}`}
                onClick={() => setTournView(n)}
              >
                {tourneyName(n)}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="hm-rank-loading" aria-label="Cargando ranking">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="hm-skeleton" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p className="hm-rank-empty">Sin datos por ahora. Vuelve cuando el bot procese el próximo evento.</p>
        )}

        {!loading && rows.length > 0 && (
          <>
            {podiumHtml}
            <ul className="hm-rows">
              {rows.slice(3).map((r, i) => (
                <li key={r.key}>
                  <Link href={r.profileId ? `/perfil/${String(r.profileId)}` : "#rankings"} className={`hm-row${r.isMe ? " you" : ""}`}>
                    <span className="hm-row-pos">{i + 4}</span>
                    <span className="hm-row-who">
                      {r.avatar ? (
                        <img className="hm-row-av" src={r.avatar} alt="" loading="lazy" />
                      ) : (
                        <span className="hm-row-av">{r.name.trim()[0].toUpperCase()}</span>
                      )}
                      <span className="hm-row-name">
                        <b>
                          {r.name}
                          {r.isMe ? <i className="hm-you-chip">Tú</i> : null}
                        </b>
                        {r.sponsor ? <em>#{r.sponsor}</em> : null}
                      </span>
                    </span>
                    <span className="hm-row-sub">
                      {mode === "torneos" ? (
                        r.character ?? "—"
                      ) : (
                        <>
                          <PlacementPips done={r.games ?? 0} />
                          {r.sub}
                        </>
                      )}
                    </span>
                    <span className="hm-row-pts">
                      {r.points == null ? "—" : fmt(r.points)}
                      <small>{mode === "online" ? "RP" : "PTS"}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Cómo se puntúa: explicaciones en un desplegable, en letra legible. */}
        <details className="hm-rank-note">
          <summary>¿Cómo se puntúa?</summary>
          <div>
            <p>
              <strong>Ranking de torneos.</strong> Los torneos oficiales suman puntos a la clasificación de la
              temporada. El bot procesa los resultados y actualiza la tabla automáticamente.
            </p>
            <p>
              <strong>Ranking de matchmaking.</strong> Los sets son FT 3 entre miembros de la comunidad. Los
              primeros {PLACEMENT_GAMES} sets son de clasificación: al completarlos recibes tu rango inicial, y
              después tus resultados hacen subir o bajar tus puntos de liga (RP).
            </p>
          </div>
        </details>
      </article>
    </section>
  );
}
