'use client';

// Ranking unificado (torneos + matchmaking en pestañas, según la maqueta):
// · Podio con el arte de los personajes para el top 3, filas compactas del 4 en adelante.
// · Las series son una fila de logos: las 4 más jugadas con nombre, el resto solo logo.
// · Sincronizar y descargar son iconos; la fila entera abre el perfil.
// · Nada se mueve solo mientras lees (sin carrusel automático).

import "../../hotcoffee-ranking.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RefreshCw, Search, SlidersHorizontal, Swords, Trophy, X } from "lucide-react";
import { API_URL, fetchUserProfile, fuseIconUrl, getToken, type MeResponse } from "@/lib/auth";
import { AppShell, PlayerFlag, RankBadge } from "@/components/hc/shared";

type RankPlayer = {
  id?: number | string;
  ranking: number;
  gamerTag: string;
  sponsor?: string;
  character?: string;
  avatarUrl?: string;
  discordId?: string;
  country?: string;
  state?: string;
  /** Fusión del equipo principal del perfil (la llena el backend). */
  fuse?: string;
  fuseName?: string;
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
  /** Rating de habilidad y desviación RD de Glicko-2. */
  glickoRating?: number;
  glickoRD?: number;
  glickoVolatility?: number;
  /** Sets terminados y si ya obtuvo rango (lo llena el backend). */
  games?: number;
  placed?: boolean;
  country?: string;
  state?: string;
  /** Plataformas de juego (lo llena el backend desde users). */
  platforms?: string[];
};

const fallback: RankPlayer[] = [
  { ranking: 1, gamerTag: "ÑEMBO", sponsor: "RZS", character: "Yasuo, Samira", points: 890 },
  { ranking: 2, gamerTag: "GAPPY", sponsor: "TKF", character: "Blitzcrank, Braum", points: 740 },
  { ranking: 3, gamerTag: "HIAMJOY", sponsor: "HCN", character: "Darius, Illaoi", points: 620 },
];

// Con ?series=<serie> (p. ej. "tns") el backend suma SOLO los torneos de esa
// serie y se ignoran from/to.
async function fetchRanking(from: number, to: number, series = ""): Promise<{ players: RankPlayer[]; live: boolean }> {
  try {
    const params = new URLSearchParams();
    if (from && to) {
      params.set("from", String(from));
      params.set("to", String(to));
    }
    if (series) params.set("series", series);
    const res = await fetch(`${API_URL}/api/rankings/2xko?${params.toString()}`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length) {
      return { players: [...data].sort((a, b) => a.ranking - b.ranking), live: true };
    }
    if (series && Array.isArray(data) && data.length === 0 && res.ok) {
      // Serie válida pero sin jugadores con puntos: tabla vacía de verdad.
      return { players: [], live: true };
    }
  } catch {
    /* sin conexión: usamos datos de respaldo */
  }
  return { players: fallback, live: false };
}

// Torneos procesados con su SERIE (Hot Coffee, TNS, Tacos Tuesday...):
// alimenta el filtro por serie de la fila de logos.
type TournamentInfo = {
  number: number;
  eventId: number;
  name: string;
  slug: string;
  image?: string;
  seriesKey: string;
  series: string;
};

async function fetchTournaments(): Promise<TournamentInfo[]> {
  try {
    const res = await fetch(`${API_URL}/api/tournaments/list`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tournaments) ? (data.tournaments as TournamentInfo[]) : [];
  } catch {
    /* sin conexión */
  }
  return [];
}

async function fetchTournamentCount(): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/tournaments/count`);
    if (res.ok) {
      const data = await res.json();
      const n = Number(data?.count);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* sin conexión: mantenemos el rango por defecto */
  }
  return DEFAULT_RANGE;
}

// Ranking de MATCHMAKING (/ft): lee matchmaking_players, independiente de torneos.
async function fetchMatchmaking(): Promise<MmPlayer[]> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/matchmaking`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data)) return data as MmPlayer[];
  } catch {
    /* sin conexión */
  }
  return [];
}

const PER_PAGE = 10;
const DEFAULT_RANGE = 10;

// Partidas de clasificación: sin las 5 primeras no hay rango; el backend lo
// decide con el RP neto de esos 5 sets y la web muestra los rombos n/5.
const PLACEMENT_GAMES = 5;
const mmGames = (p: MmPlayer) => p.games ?? p.wins + p.losses;
const mmPlaced = (p: MmPlayer) => p.placed ?? mmGames(p) >= PLACEMENT_GAMES;
const rowGames = (r: Row) => (r.wins ?? 0) + (r.losses ?? 0);

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Normaliza el nombre de un personaje para buscar su arte ("YASUO, ekko" -> "Yasuo").
const normFighter = (raw?: string): string | undefined => {
  const n = raw?.split(/[,/]/)[0]?.trim();
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

// Fila unificada: sirve tanto para el ranking de torneos como el de matchmaking.
type Row = {
  key: string;
  ranking: number;
  name: string;
  sponsor?: string | undefined;
  avatar?: string | undefined;
  character?: string | undefined;
  wins?: number | undefined;
  losses?: number | undefined;
  /** Solo matchmaking: false = sigue en clasificación (sin rango). */
  placed?: boolean | undefined;
  points: number;
  glickoRating?: number | undefined;
  glickoRD?: number | undefined;
  profileId?: string | undefined;
  country?: string | undefined;
  state?: string | undefined;
  platforms?: string[] | undefined;
  fuse?: string | undefined;
  fuseName?: string | undefined;
};

// Cadena de arte del podio: personaje principal → avatar. Si ninguna carga,
// el fondo queda en degradado (el ::after del CSS pone la base oscura).
function PodiumArt({ srcs }: { srcs: string[] }) {
  const [idx, setIdx] = useState(0);
  // Si llegan más candidatos (p. ej. carga el perfil y aparecen los mains),
  // se reintenta desde el primero; el error avanza por la cadena.
  useEffect(() => setIdx(0), [srcs.length]);
  const src = srcs[Math.min(idx, srcs.length - 1)];
  if (!src) return null;
  return <img src={src} alt="" loading="lazy" onError={() => setIdx((i) => Math.min(i + 1, srcs.length - 1))} />;
}

// Rombitos de clasificación (estilo maqueta): 5 rombos dorados.
function PlacementPips({ done, total = PLACEMENT_GAMES }: { done: number; total?: number }) {
  return (
    <span className="rk-pips" title={`Clasificación: ${Math.min(done, total)} de ${total} sets`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < Math.min(done, total) ? "f" : ""} />
      ))}
    </span>
  );
}

export default function RankingBoard({ mode }: { mode: "torneos" | "matchmaking" }) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState(mode);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(DEFAULT_RANGE);
  const [series, setSeries] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const boardRef = useRef<HTMLDivElement>(null);
  const mm = activeMode === "matchmaking";

  // Las pestañas viven dentro del Ranking: cambiar de modo actualiza la URL
  // canónica (compartible) sin recargar la página.
  const switchMode = (m: "torneos" | "matchmaking") => {
    if (m === activeMode) return;
    setActiveMode(m);
    setPage(1);
    window.history.replaceState(null, "", m === "torneos" ? "/ranking" : "/ranking-matchmaking");
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ranking", from, to, series],
    queryFn: () => fetchRanking(from, to, series),
    staleTime: 60_000,
    enabled: activeMode === "torneos",
  });
  const { data: fetchedCount } = useQuery({
    queryKey: ["tournament-count"],
    queryFn: fetchTournamentCount,
    staleTime: 300_000,
    enabled: activeMode === "torneos",
  });
  const { data: mmData, isLoading: mmLoading } = useQuery({
    queryKey: ["ranking-matchmaking"],
    queryFn: fetchMatchmaking,
    staleTime: 60_000,
    enabled: mm,
  });
  const { data: tournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: fetchTournaments,
    staleTime: 300_000,
    enabled: activeMode === "torneos",
  });
  const tournamentsList = useMemo(() => tournaments ?? [], [tournaments]);
  // Series únicas: la foto es la del último torneo procesado de la serie.
  const seriesList = useMemo(() => {
    const map = new Map<string, { key: string; name: string; image?: string; count: number }>();
    for (const t of tournamentsList) {
      const cur = map.get(t.seriesKey);
      if (cur) {
        cur.count++;
        if (t.image) cur.image = t.image;
      } else {
        map.set(t.seriesKey, { key: t.seriesKey, name: t.series, image: t.image || undefined, count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [tournamentsList]);
  const currentSeries = seriesList.find((s) => s.key === series);
  const tournamentCount = fetchedCount ?? DEFAULT_RANGE;
  const ranges = useMemo(() => Array.from({ length: tournamentCount }, (_, i) => i + 1), [tournamentCount]);

  // Al conocer el total real de torneos, mostramos la temporada completa (una sola vez).
  const initialized = useRef(false);
  useEffect(() => {
    if (!fetchedCount || initialized.current) return;
    initialized.current = true;
    setTo(fetchedCount);
    setFrom((f) => Math.min(f, fetchedCount));
  }, [fetchedCount]);

  // Si el total baja por debajo de lo seleccionado, acotamos los filtros.
  useEffect(() => {
    if (from > tournamentCount) setFrom(tournamentCount);
    if (to > tournamentCount) setTo(tournamentCount);
  }, [tournamentCount, from, to]);

  const players = data?.players ?? [];
  const mmPlayers = useMemo(() => mmData ?? [], [mmData]);
  const loading = activeMode === "torneos" ? isLoading : mmLoading;

  const rows: Row[] = useMemo(() => {
    if (mm) {
      return mmPlayers.map((p) => ({
        key: p.discordId,
        ranking: p.ranking,
        name: p.username,
        avatar: p.avatarUrl,
        wins: p.wins,
        losses: p.losses,
        placed: mmPlaced(p),
        points: Math.max(0, p.points),
        glickoRating: p.glickoRating ?? 1500,
        glickoRD: p.glickoRD ?? 350,
        country: p.country,
        state: p.state,
        platforms: p.platforms,
        profileId: p.discordId,
      }));
    }
    return players.map((p) => ({
      key: `${p.ranking}-${p.gamerTag}`,
      ranking: p.ranking,
      name: p.gamerTag,
      sponsor: p.sponsor,
      avatar: p.avatarUrl,
      character: p.character,
      fuse: p.fuse,
      fuseName: p.fuseName,
      points: p.points,
      country: p.country,
      state: p.state,
      profileId: p.discordId || (p.id != null ? String(p.id) : ""),
    }));
  }, [mm, players, mmPlayers]);

  const filtered = rows.filter((r) =>
    `${r.name} ${r.sponsor ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  // Podio: top 3 global (del filtro actual); la tabla empieza en el 4.
  const podium = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = rest.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  // Perfiles de las filas visibles (modo matchmaking): rango real, equipo y
  // últimos sets. En el podio dan el arte (mains) de cada jugador.
  const profileQs = useQueries({
    queries: (mm ? [...podium, ...shown] : []).map((r) => ({
      queryKey: ["profile", r.profileId],
      queryFn: () => fetchUserProfile(String(r.profileId)),
      staleTime: 120_000,
    })),
  });
  const profiles: Record<string, MeResponse | null | undefined> = {};
  if (mm) {
    [...podium, ...shown].forEach((r, i) => (profiles[r.key] = profileQs[i]?.data));
  }
  const cols = mm ? 6 : 4;
  const mmSets = useMemo(() => mmPlayers.reduce((n, p) => n + p.wins, 0), [mmPlayers]);

  const sync = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/sync`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => null);
      const message =
        data?.message ?? (res.ok ? "No se pudo sincronizar. Inténtalo de nuevo." : "No se pudo conectar con el servidor del ranking.");
      if (data?.status === "success") {
        toast.success(message);
        // El bot recoge la solicitud en menos de 60 s: refrescamos cuando debería estar lista.
        window.setTimeout(() => refetch(), 70000);
      } else {
        toast.error(message);
      }
    } catch {
      toast.error("No se pudo conectar con el servidor del ranking");
    }
  };

  const exportPng = async () => {
    if (!boardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(boardRef.current, { backgroundColor: "#18100b", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = url;
      a.download = "hot-coffee-ranking.png";
      a.click();
    } catch {
      toast.error("No se pudo generar la imagen");
    }
  };

  const openProfile = (r: Row) => {
    if (r.profileId) router.push(`/perfil/${String(r.profileId)}`);
  };

  const podiumArt = (r: Row): string[] => {
    const out: string[] = [];
    if (mm) {
      const mains = profiles[r.key]?.mains;
      if (mains?.point?.id) out.push(`/fighters/${encodeURIComponent(mains.point.id)}.png`);
      if (mains?.assist?.id) out.push(`/fighters/${encodeURIComponent(mains.assist.id)}.png`);
    } else {
      const fighter = normFighter(r.character);
      if (fighter) out.push(`/fighters/${encodeURIComponent(fighter)}.png`);
    }
    if (r.avatar) out.push(r.avatar);
    return out;
  };

  return (
    <AppShell>
      <main className="page ranking-page">
        {/* ——— Cabecera: un título, una línea y las dos pestañas ——— */}
        <section className="rk-head">
          <div className="rk-head-copy">
            <h1 className="rk-h1">{mm ? "Ranking de matchmaking" : "Ranking de torneos"}</h1>
            <p className="rk-cap">
              {mm
                ? `Sets FT 3 de la liga, ordenados por RP · ${rows.length} jugadores · ${mmSets} sets jugados`
                : series
                  ? `Serie ${currentSeries?.name ?? series} · ${rows.length} jugadores`
                  : `Temporada 2026 · ${tournamentCount} torneos · ${rows.length} jugadores`}
            </p>
          </div>
          <div className="rk-mode-tabs" role="tablist" aria-label="Tipo de ranking">
            <button
              type="button"
              role="tab"
              aria-selected={!mm}
              className={`rk-mode-tab${!mm ? " on" : ""}`}
              onClick={() => switchMode("torneos")}
            >
              <Trophy /> Torneos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mm}
              className={`rk-mode-tab${mm ? " on" : ""}`}
              onClick={() => switchMode("matchmaking")}
            >
              <Swords /> Matchmaking
            </button>
          </div>
        </section>

        {/* ——— Filtro de series: una fila de logos ——— */}
        {activeMode === "torneos" && seriesList.length > 0 && (
          <div className="rk-series-row" role="tablist" aria-label="Filtrar por serie de torneos">
            <button
              type="button"
              className={`rks rks-all ${series === "" ? "on" : ""}`}
              onClick={() => { setSeries(""); setPage(1); }}
              title="Ver todos los torneos procesados (quita el filtro)"
            >
              <span className="rks-ini">☕</span>
              <span className="rks-nm">Todos</span>
              <small>{tournamentsList.length}</small>
            </button>
            {seriesList.slice(0, 4).map((s) => (
              <button
                type="button"
                key={s.key}
                className={`rks ${series === s.key ? "on" : ""}`}
                onClick={() => { setSeries(series === s.key ? "" : s.key); setPage(1); }}
                title={`${s.name} (${s.count} eventos)`}
              >
                {s.image ? (
                  <img src={s.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <span className="rks-ini">{s.name.charAt(0).toUpperCase()}</span>
                )}
                <span className="rks-nm">{s.name}</span>
                <small>{s.count}</small>
              </button>
            ))}
            {seriesList.slice(4).map((s) => (
              <button
                type="button"
                key={s.key}
                className={`rks rks-ico ${series === s.key ? "on" : ""}`}
                onClick={() => { setSeries(series === s.key ? "" : s.key); setPage(1); }}
                title={`${s.name} (${s.count} eventos)`}
                aria-label={`Filtrar por ${s.name}`}
              >
                {s.image ? (
                  <img src={s.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <span className="rks-ini">{s.name.charAt(0).toUpperCase()}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div ref={boardRef}>
          {/* ——— Herramientas: buscar + iconos ——— */}
          <div className="rk-tools">
            <label className="rk-search">
              <Search />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar jugador o personaje"
              />
            </label>
            <button
              type="button"
              className="rk-icon-btn"
              onClick={sync}
              disabled={isFetching}
              title="Sincronizar resultados"
              aria-label="Sincronizar resultados"
            >
              <RefreshCw className={isFetching ? "spin" : ""} />
            </button>
            <button
              type="button"
              className="rk-icon-btn"
              onClick={exportPng}
              title="Descargar como imagen"
              aria-label="Descargar ranking como imagen"
            >
              <Download />
            </button>
            {activeMode === "torneos" && (
              <button
                type="button"
                className={`rk-icon-btn${showFilters ? " on" : ""}`}
                aria-pressed={showFilters}
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
                title={showFilters ? "Ocultar filtros" : "Filtrar por rango de torneos"}
                aria-label={showFilters ? "Ocultar filtros" : "Filtrar por rango de torneos"}
              >
                {showFilters ? <X /> : <SlidersHorizontal />}
              </button>
            )}
          </div>

          {showFilters && activeMode === "torneos" && (
            <div className="rk-filters">
              <span>TORNEOS</span>
              <label title={series ? "Se ignora al elegir una serie" : undefined}>
                Desde
                <select value={from} disabled={!!series} onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (v > to) setTo(v); setPage(1); }}>
                  {ranges.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label title={series ? "Se ignora al elegir una serie" : undefined}>
                Hasta
                <select value={to} disabled={!!series} onChange={(e) => { const v = Number(e.target.value); setTo(v); if (v < from) setFrom(v); setPage(1); }}>
                  {ranges.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          )}

          {/* ——— Podio: el top 3 se ve, no se lee ——— */}
          {!loading && podium.length > 0 && (
            <div className="rk-podium">
              {podium.map((r, i) => (
                <Link
                  key={r.key}
                  href={r.profileId ? `/perfil/${String(r.profileId)}` : "#"}
                  className={`rk-pod p${i + 1}`}
                  aria-label={`#${i + 1} ${r.name}`}
                >
                  <span className="rk-pod-art">
                    <PodiumArt srcs={podiumArt(r)} />
                  </span>
                  <span className="rk-pod-rk">{i + 1}</span>
                  <span className="rk-pod-who">
                    {r.avatar ? (
                      <img className="rk-pod-av" src={r.avatar} alt="" loading="lazy" />
                    ) : (
                      <span className="rk-pod-av">{r.name[0]}</span>
                    )}
                    <span className="rk-pod-name">
                      <b>{r.name}</b>
                      <small>
                        {mm ? (
                          !r.placed ? (
                            <PlacementPips done={rowGames(r)} />
                          ) : profiles[r.key]?.rank ? (
                            profiles[r.key]!.rank!.displayName
                          ) : (
                            `${r.wins ?? 0}V · ${r.losses ?? 0}D`
                          )
                        ) : (
                          r.sponsor ? `#${r.sponsor}` : (normFighter(r.character) ?? "—")
                        )}
                      </small>
                    </span>
                    <span className="rk-pod-pts">
                      {fmt(Math.max(0, r.points))}
                      <small>{mm ? "RP" : "PTS"}</small>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* ——— Tabla: del 4 en adelante, toda la fila abre el perfil ——— */}
          <section className="panel rk-table">
            <div className="rk-scroll">
              <table>
                <thead>
                  <tr>
                    <th>POS.</th>
                    <th>JUGADOR</th>
                    {mm && <th>RANGO</th>}
                    <th>EQUIPO</th>
                    {mm && <th>ÚLTIMOS SETS</th>}
                    <th className="accent">{mm ? "RP ↓" : "PUNTOS ↓"}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}><td colSpan={cols}><div className="rk-skeleton" /></td></tr>
                    ))}
                  {!loading && shown.length === 0 && (
                    <tr><td colSpan={cols} className="c">{podium.length ? "Sin más jugadores en esta vista." : "No hay jugadores con ese nombre."}</td></tr>
                  )}
                  {shown.map((r) => {
                    const top = r.ranking <= 3;
                    const prof = profiles[r.key];
                    const lastTeam = prof?.fights?.find((f) => f.playerTeam?.point?.id)?.playerTeam;
                    return (
                      <tr
                        key={r.key}
                        className={`rk-click${top ? " first" : ""}`}
                        onClick={() => openProfile(r)}
                        tabIndex={r.profileId ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openProfile(r);
                        }}
                      >
                        <td className={`pos ${top ? "top" : ""}`}>{String(r.ranking).padStart(2, "0")}</td>
                        <td>
                          <div className="who">
                            {r.avatar ? (
                              <img className="ini" src={r.avatar} alt="" loading="lazy" />
                            ) : (
                              <span className={`ini ${top ? "top" : ""}`}>{r.name[0]}</span>
                            )}
                            <div>
                              <strong>
                                {r.name}
                                <PlayerFlag country={r.country} state={r.state} className="rk-flag" />
                                {(r.platforms ?? []).map((p) => (
                                  <span key={p} className={`platform-chip is-${p.toLowerCase()}`}>
                                    {p}
                                  </span>
                                ))}
                                {r.sponsor ? <em> #{r.sponsor}</em> : null}
                              </strong>
                              {mm && (
                                <small className="rk-sub">
                                  {!r.placed
                                    ? `${fmt(Math.max(0, r.points))} RP en clasificación`
                                    : lastTeam ? `${lastTeam.point.name} / ${lastTeam.assist.name}` : `${r.wins ?? 0}V — ${r.losses ?? 0}D`}
                                </small>
                              )}
                            </div>
                          </div>
                        </td>
                        {mm && (
                          <td>
                            {!r.placed ? (
                              <span className="rk-placing-wrap">
                                <PlacementPips done={rowGames(r)} />
                                <span className="rk-placing" title="El rango se obtiene al terminar las 5 partidas de clasificación">
                                  {rowGames(r)}/5
                                </span>
                              </span>
                            ) : prof?.rank ? (
                              <div className="rk-rank">
                                <RankBadge small rank={prof.rank} />
                                <span style={{ color: prof.rank.color }}>{prof.rank.displayName}</span>
                              </div>
                            ) : <span className="dim">—</span>}
                          </td>
                        )}
                        <td>
                          {mm ? (
                            lastTeam ? (
                              <div className="rk-team rk-team-icons">
                                {[lastTeam.point, lastTeam.assist].map((c) => (
                                  <span key={c.id} title={c.name}>
                                    <img src={`/fighters/${encodeURIComponent(c.id)}.png`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
                                  </span>
                                ))}
                                {lastTeam.fuse?.id && (
                                  <span className="fuse" title={`Fuse: ${lastTeam.fuse.name}`}>
                                    <img src={fuseIconUrl(lastTeam.fuse.id)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
                                  </span>
                                )}
                              </div>
                            ) : <span className="dim">—</span>
                          ) : (
                            <TeamIcons value={r.character} fuse={r.fuse} fuseName={r.fuseName} />
                          )}
                        </td>
                        {mm && (
                          <td>
                            {prof?.fights?.length ? (
                              <div className="rk-sets">
                                {prof.fights.slice(0, 5).map((f) => (
                                  <b key={f.id} className={f.result === "WIN" ? "w" : "l"} title={`${f.scoreFor}-${f.scoreAgainst} vs ${f.opponentTag}`}>
                                    {f.result === "WIN" ? "V" : "D"}
                                  </b>
                                ))}
                              </div>
                            ) : <span className="dim">—</span>}
                          </td>
                        )}
                        <td>
                          <span className={`pts ${top ? "top" : ""}`}>{fmt(Math.max(0, r.points))}</span>
                          {mm && <small className="rk-rp-sub">Glicko {fmt(Math.round(r.glickoRating ?? 1500))}</small>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rk-foot">
              <span>
                {filtered.length > 3
                  ? `Mostrando ${(current - 1) * PER_PAGE + 4}–${Math.min(current * PER_PAGE + 3, filtered.length)} de ${filtered.length} jugadores`
                  : `${filtered.length} jugadores`}
              </span>
              {pages > 1 && (
                <div className="pager">
                  <small>{PER_PAGE} por página</small>
                  <button type="button" onClick={() => setPage(Math.max(1, current - 1))} aria-label="Página anterior">‹</button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                    <button type="button" key={n} className={n === current ? "on" : ""} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button type="button" onClick={() => setPage(Math.min(pages, current + 1))} aria-label="Página siguiente">›</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

// Equipo como SOLO iconos: el nombre del personaje sale al pasar el cursor.
function TeamIcons({ value, fuse, fuseName }: { value?: string | undefined; fuse?: string | undefined; fuseName?: string | undefined }) {
  // "2XKO_FIGHTER" es el placeholder que la sync guarda sin datos: se ignora.
  const names = (value ?? "")
    .split(/[,+]/)
    .map((n) => n.trim())
    .filter((n) => n && n.toUpperCase() !== "2XKO_FIGHTER");
  if (names.length === 0 && !fuse) return <span className="dim">—</span>;
  return (
    <div className="rk-team rk-team-icons">
      {names.map((n) => {
        const id = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
        return (
          <span key={n} title={id}>
            <img src={`/fighters/${encodeURIComponent(id)}.png`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
          </span>
        );
      })}
      {fuse ? (
        <span className="fuse" title={`Fuse: ${fuseName ?? fuse}`}>
          <img src={fuseIconUrl(fuse)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
        </span>
      ) : null}
    </div>
  );
}
