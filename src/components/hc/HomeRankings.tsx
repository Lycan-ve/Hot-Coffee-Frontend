'use client';

// Sección 3 del home (propuesta del admin): rankings de torneos y online
// en la portada, con datos reales del backend y atajo a las tablas completas.
// El estilo usa los tokens café definidos en hotcoffee-home.css.

import Link from "next/link";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronRight, Trophy } from "lucide-react";
import { API_URL } from "@/lib/auth";
import { SectionTitle } from "@/components/hc/shared";
import "./home-rankings.css";

type RankPlayer = {
  id?: number | string;
  ranking: number;
  gamerTag: string;
  sponsor?: string;
  character?: string;
  discordId?: string;
  points: number;
};

type MmPlayer = {
  discordId: string;
  username: string;
  points: number;
  wins: number;
  losses: number;
  ranking: number;
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
  sub?: string;
  points: number;
  profileId?: string;
};

const TOP = 8;
// El ladder de matchmaking parte de Oro I (1.000 pts), igual que en /ranking-matchmaking.
const MM_BASE_POINTS = 1000;

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

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

function Medal({ pos }: { pos: number }) {
  if (pos > 3) return <span className="hm-pos">{pos}</span>;
  return <span className={`hm-medal m${pos}`}>{pos}</span>;
}

export default function HomeRankings() {
  const [mode, setMode] = useState<"torneos" | "online">("torneos");
  const [tournView, setTournView] = useState<"season" | number>("season");

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
          sub: p.character,
          points: p.points,
          profileId: p.discordId || (p.id != null ? String(p.id) : ""),
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
          sub: p.character,
          points: p.points,
          profileId: p.discordId || (p.id != null ? String(p.id) : ""),
        }),
      );
    }
  } else {
    loading = mmLoading;
    (mm ?? []).slice(0, TOP).forEach((p) =>
      rows.push({
        key: p.discordId,
        pos: p.ranking,
        name: p.username,
        sub: `${p.wins}V · ${p.losses}D`,
        points: MM_BASE_POINTS + p.points,
        profileId: p.discordId,
      }),
    );
  }

  const isSeason = mode === "torneos" && tournView === "season";

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
              <Trophy /> Ranking Torneos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "online"}
              className={`hm-rank-tab${mode === "online" ? " on" : ""}`}
              onClick={() => setMode("online")}
            >
              <BarChart3 /> Ranking Online
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

        <div className="hm-rank-table">
          <table>
            <thead>
              <tr>
                <th>Top</th>
                <th>Jugador</th>
                <th className="hm-col-sub">{mode === "torneos" ? "Equipo" : "Récord"}</th>
                <th className="hm-col-pts">{isSeason ? "Total temporada" : "Puntos"}</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={4}>
                      <div className="hm-skeleton" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="hm-rank-empty">
                    Sin datos por ahora. Vuelve cuando el bot procese el próximo evento.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <Medal pos={r.pos} />
                  </td>
                  <td>
                    {r.profileId ? (
                      <Link className="hm-rank-player" href={`/perfil/${r.profileId}`}>
                        {r.name}
                        {r.sponsor ? <em> #{r.sponsor}</em> : null}
                      </Link>
                    ) : (
                      <span className="hm-rank-player">
                        {r.name}
                        {r.sponsor ? <em> #{r.sponsor}</em> : null}
                      </span>
                    )}
                  </td>
                  <td className="hm-col-sub">
                    {r.sub ? <span className="hm-rank-sub">{r.sub}</span> : <span className="hm-rank-none">—</span>}
                  </td>
                  <td className="hm-col-pts">{fmt(r.points)} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
