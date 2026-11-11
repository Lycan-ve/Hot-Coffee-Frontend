'use client';

import Link from "next/link";
import "../hotcoffee-ranking.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Crown, Download, Info, RefreshCw, Search, SlidersHorizontal, Swords, Trophy, Users } from "lucide-react";
import { API_URL, fetchUserProfile, fuseIconUrl, getToken, type MeResponse } from "@/lib/auth";
import { A, AppShell, RankBadge, SectionTitle } from "@/components/hc/shared";

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
// alimenta el banner de la portada y el filtro por serie.
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

// El ranking de matchmaking parte de Gold I (1.000 pts): el total mostrado
// incluye la base, igual que la escalera de rangos que calcula el backend.
const MM_BASE_POINTS = 1000;

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Normaliza el nombre de un personaje para buscar su arte ("YASUO, ekko" -> "Yasuo").
const normFighter = (raw?: string): string | undefined => {
  const n = raw?.split(/[,/]/)[0]?.trim();
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

// Arte del jugador destacado: splash art de public/jugadores_destacados
// (las extensiones están mezcladas: png/jpg/jpeg, se prueban en cadena),
// luego el sprite del personaje y al final el artwork genérico.
const featuredArtCandidates = (name: string) => [
  `/jugadores_destacados/${encodeURIComponent(name)}.png`,
  `/jugadores_destacados/${encodeURIComponent(name)}.jpg`,
  `/jugadores_destacados/${encodeURIComponent(name)}.jpeg`,
  `/fighters/${encodeURIComponent(name)}.png`,
  `${A}/b5469.png`,
];

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
  points: number;
  profileId?: string | undefined;
};

// Jugador destacado de la portada (columna derecha del ranking).
// En TORNEOS es el campeón del último torneo; en MATCHMAKING, el #1.
type Featured = {
  name: string;
  sponsor?: string | undefined;
  avatar?: string | undefined;
  character?: string | undefined;
  wins?: number | undefined;
  losses?: number | undefined;
  points: number;
  profileId?: string | undefined;
};

export default function RankingPage() {
  const [mode, setMode] = useState<"torneos" | "matchmaking">("torneos");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(DEFAULT_RANGE);
  const [series, setSeries] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const boardRef = useRef<HTMLElement>(null);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ranking", from, to, series],
    queryFn: () => fetchRanking(from, to, series),
    staleTime: 60_000,
  });
  const { data: fetchedCount } = useQuery({
    queryKey: ["tournament-count"],
    queryFn: fetchTournamentCount,
    staleTime: 300_000,
  });
  const { data: mmData, isLoading: mmLoading } = useQuery({
    queryKey: ["ranking-matchmaking"],
    queryFn: fetchMatchmaking,
    staleTime: 60_000,
    enabled: mode === "matchmaking",
  });
  const { data: tournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: fetchTournaments,
    staleTime: 300_000,
    enabled: mode === "torneos",
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
    return [...map.values()];
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
  const loading = mode === "torneos" ? isLoading : mmLoading;

  const rows: Row[] = useMemo(() => {
    if (mode === "matchmaking") {
      return mmPlayers.map((p) => ({
        key: p.discordId,
        ranking: p.ranking,
        name: p.username,
        avatar: p.avatarUrl,
        wins: p.wins,
        losses: p.losses,
        points: MM_BASE_POINTS + p.points,
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
      points: p.points,
      profileId: p.discordId || (p.id != null ? String(p.id) : ""),
    }));
  }, [mode, players, mmPlayers]);

  const filtered = rows.filter((r) =>
    `${r.name} ${r.sponsor ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const profileQs = useQueries({
    queries: (mode === "matchmaking" ? shown : []).map((r) => ({
      queryKey: ["profile", r.profileId],
      queryFn: () => fetchUserProfile(String(r.profileId)),
      staleTime: 120_000,
    })),
  });
  const profiles: Record<string, MeResponse | null | undefined> = {};
  if (mode === "matchmaking") shown.forEach((r, i) => (profiles[r.key] = profileQs[i]?.data));
  const mm = mode === "matchmaking";
  const cols = mm ? 7 : 5;
  const leader = rows[0];
  // 🏆 Jugador destacado: en TORNEOS es el campeón del último torneo (el #1
  // del ranking calculado solo con ese torneo); en MATCHMAKING es el #1 de
  // la liga. Se calcula en la web, sin endpoint adicional.
  const { data: lastTourney } = useQuery({
    queryKey: ["last-tournament", tournamentCount],
    queryFn: () => fetchRanking(tournamentCount, tournamentCount),
    enabled: mode === "torneos" && tournamentCount > 0,
    staleTime: 60_000,
  });
  const featured: Featured | undefined = useMemo(() => {
    if (mode === "matchmaking") return rows[0];
    const champ = lastTourney?.live ? lastTourney.players[0] : undefined;
    if (!champ) return undefined;
    return {
      name: champ.gamerTag,
      sponsor: champ.sponsor,
      avatar: champ.avatarUrl,
      character: champ.character,
      points: champ.points,
      profileId: champ.discordId || (champ.id != null ? String(champ.id) : ""),
    };
  }, [mode, rows, lastTourney]);
  const { data: featuredProf } = useQuery({
    queryKey: ["profile", featured?.profileId],
    queryFn: () => fetchUserProfile(String(featured?.profileId)),
    enabled: mm && !!featured?.profileId,
    staleTime: 120_000,
  });
  const featuredChar = mm
    ? normFighter(featuredProf?.fights?.find((f) => f.playerTeam?.point?.id)?.playerTeam?.point?.id)
    : normFighter(featured?.character);
  // Arte del destacado: candidatos en cadena (extensiones mixtas del arte).
  const [artIdx, setArtIdx] = useState(0);
  useEffect(() => {
    setArtIdx(0);
  }, [featuredChar]);
  const artFallback = `${A}/b5469.png`;
  const artSrc = featuredChar ? featuredArtCandidates(featuredChar)[artIdx] ?? artFallback : artFallback;
  const mmSets = useMemo(() => mmPlayers.reduce((n, p) => n + p.wins, 0), [mmPlayers]);

  const switchMode = (m: "torneos" | "matchmaking") => {
    setMode(m);
    setPage(1);
  };

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

  // Con series cargadas en modo torneos, la portada pasa a 3 columnas:
  // torneos procesados | tabla de ranking | sidebar.
  const showTourneys = mode === "torneos" && seriesList.length > 0;

  return (
    <AppShell>
      <main className="page ranking-page">
        <section className="hero">
          <div className="hero-copy">
            <SectionTitle
              eyebrow="TEMPORADA DE TORNEOS / 2026"
              note={data && !data.live && mode === "torneos" ? "Datos de respaldo" : undefined}
              title="CLASIFICACIÓN DE JUGADORES"
              copy="El progreso competitivo de la comunidad, en un solo lugar."
            />
          </div>
          <div className="hero-motto">
            <span>EL GRIND NUNCA PARA.</span>
            <strong>BUEN CAFÉ. BUENAS PELEAS.</strong>
          </div>
        </section>

        <section className="rk-stats">
          <div className="rk-stat">
            <Users />
            <div>
              <small>PARTICIPANTES</small>
              {/* Con un torneo elegido se aclara de dónde salen los jugadores. */}
              <p>
                <strong>{loading ? "—" : String(rows.length).padStart(2, "0")}</strong>{" "}
                {series ? `jugadores de la liga (${currentSeries?.name ?? series})` : "jugadores en la liga"}
              </p>
            </div>
          </div>
          <div className="rk-stat">
            <Swords />
            <div>
              <small>{mode === "torneos" ? "TORNEOS CONTADOS" : "SETS JUGADOS"}</small>
              {mode === "torneos" ? (
                <p>
                  <strong>{String(series ? currentSeries?.count ?? 0 : to - from + 1).padStart(2, "0")}</strong>{" "}
                  torneos {series ? `de ${currentSeries?.name ?? series}` : `${from}—${to}`}
                </p>
              ) : (
                <p><strong>{String(mmSets).padStart(2, "0")}</strong> sets /ft confirmados</p>
              )}
            </div>
          </div>
          <div className="rk-stat leader">
            <Crown />
            <div>
              <small>LÍDER ACTUAL</small>
              <p><strong>{leader?.name ?? "—"}</strong> {leader ? `${fmt(leader.points)} puntos` : ""}</p>
            </div>
            <b>#1</b>
          </div>
        </section>

        <section className={`rk-layout ${showTourneys ? "with-tourneys" : ""}`}>
          {/* Torneos procesados: columna izquierda fija, con el botón TODOS
              para quitar el filtro de un toque y no confundir a nadie. */}
          {showTourneys && (
            <article className="panel rk-tourneys">
              <div className="head">
                <h3>TORNEOS PROCESADOS</h3>
                <Trophy />
              </div>
              <div className="rk-tourneys-grid">
                <button
                  type="button"
                  className={`chip chip-all ${series === "" ? "on" : ""}`}
                  onClick={() => { setSeries(""); setPage(1); }}
                  title="Ver todos los torneos procesados (quita el filtro)"
                >
                  <span className="badge-ini">☕</span>
                  <span className="nm">TODOS</span>
                  <small>{tournamentsList.length} {tournamentsList.length === 1 ? "TORNEO" : "TORNEOS"}</small>
                </button>
                {seriesList.map((s) => (
                  <button
                    type="button"
                    key={s.key}
                    className={`chip ${series === s.key ? "on" : ""}`}
                    onClick={() => { setSeries(series === s.key ? "" : s.key); setPage(1); }}
                    title={`Ver solo los resultados de ${s.name}`}
                  >
                    {s.image ? (
                      <img src={s.image} alt={s.name} onError={(e) => (e.currentTarget.style.display = "none")} />
                    ) : (
                      <span className="badge-ini">{s.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="nm">{s.name.toUpperCase()}</span>
                    <small>{s.count} {s.count === 1 ? "EVENTO" : "EVENTOS"}</small>
                  </button>
                ))}
              </div>
            </article>
          )}

          <article className="panel rk-table" ref={boardRef}>
            <div className="rk-tabs">
              <button type="button" className={mode === "torneos" ? "on" : ""} onClick={() => switchMode("torneos")}>
                RANKING TORNEOS
              </button>
              <button type="button" className={mode === "matchmaking" ? "on" : ""} onClick={() => switchMode("matchmaking")}>
                RANKING MATCHMAKING
              </button>
              <span>
                {mode === "torneos"
                  ? series
                    ? `SERIE · ${currentSeries?.name?.toUpperCase() ?? series}`
                    : `ACUMULADO · TORNEOS ${String(from).padStart(2, "0")}—${String(to).padStart(2, "0")}`
                  : "SETS /FT · LIGA 2XKO"}
              </span>
            </div>
            <div className="rk-tools">
              <label className="rk-search">
                <Search />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar jugador o equipo"
                />
              </label>
              {mode === "torneos" && (
                <button type="button" className={showFilters ? "on" : ""} onClick={() => setShowFilters((v) => !v)}>
                  <SlidersHorizontal /> Filtrar torneos
                </button>
              )}
              <button type="button" onClick={sync} disabled={isFetching}>
                <RefreshCw className={isFetching ? "spin" : ""} /> {isFetching ? "Sincronizando" : "Sincronizar"}
              </button>
              <button type="button" onClick={exportPng}><Download /> PNG</button>
            </div>
            {showFilters && mode === "torneos" && (
              <div className="rk-filters">
                <span>TORNEOS</span>
                <label>
                  Serie
                  <select
                    value={series}
                    onChange={(e) => { setSeries(e.target.value); setPage(1); }}
                    title="Filtra por una serie de torneos (p. ej. TNS muestra solo los resultados de TNS)"
                  >
                    <option value="">TODAS</option>
                    {seriesList.map((s) => (
                      <option key={s.key} value={s.key}>{`${s.name} (${s.count})`}</option>
                    ))}
                  </select>
                </label>
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
            <div className="rk-scroll">
              <table>
                <thead>
                  <tr>
                    <th>POS.</th><th>JUGADOR</th>{mm && <th>RANGO</th>}<th>EQUIPO</th>{mm && <th>ÚLTIMOS SETS</th>}<th className="accent">PUNTOS ↓</th><th className="r">PERFIL</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}><td colSpan={cols}><div className="rk-skeleton" /></td></tr>
                    ))}
                  {!loading && shown.length === 0 && (
                    <tr><td colSpan={cols} className="c">No hay jugadores con ese nombre.</td></tr>
                  )}
                  {shown.map((r) => {
                    const top = r.ranking <= 3;
                    const prof = profiles[r.key];
                    const lastTeam = prof?.fights?.find((f) => f.playerTeam?.point?.id)?.playerTeam;
                    return (
                      <tr key={r.key} className={r.ranking === 1 ? "first" : ""}>
                        <td className={`pos ${top ? "top" : ""}`}>{String(r.ranking).padStart(2, "0")}</td>
                        <td>
                          <div className="who">
                            {r.avatar ? (
                              <img className="ini" src={r.avatar} alt="" />
                            ) : (
                              <span className={`ini ${top ? "top" : ""}`}>{r.name[0]}</span>
                            )}
                            <div>
                              <strong>{r.name} {r.sponsor ? <em>#{r.sponsor}</em> : null}</strong>
                              {mm && (
                                <small className="rk-sub">
                                  {lastTeam ? `${lastTeam.point.name} / ${lastTeam.assist.name}` : `${r.wins ?? 0}V — ${r.losses ?? 0}D`}
                                </small>
                              )}
                            </div>
                          </div>
                        </td>
                        {mm && (
                          <td>
                            {prof?.rank ? (
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
                              <div className="rk-team">
                                {[lastTeam.point, lastTeam.assist].map((c) => (
                                  <span key={c.id} title={c.name}>
                                    <img src={`/fighters/${encodeURIComponent(c.id)}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                                    {c.name}
                                  </span>
                                ))}
                                {lastTeam.fuse?.id && (
                                  <span className="fuse" title={`Fuse: ${lastTeam.fuse.name}`}>
                                    <img src={fuseIconUrl(lastTeam.fuse.id)} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                                    {lastTeam.fuse.name}
                                  </span>
                                )}
                              </div>
                            ) : <span className="dim">—</span>
                          ) : (
                            <Team value={r.character} />
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
                          <span className={`pts ${top ? "top" : ""}`}>{fmt(r.points)}</span>
                        </td>
                        <td className="r">
                          {r.profileId ? (
                            <Link href={`/perfil/${String(r.profileId)}`} className="rk-link" aria-label={`Ver perfil de ${r.name}`}>
                              <ChevronRight />
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rk-foot">
              <span>
                Mostrando {filtered.length ? (current - 1) * PER_PAGE + 1 : 0}–{Math.min(current * PER_PAGE, filtered.length)} de {filtered.length} jugadores
              </span>
              <div className="pager">
                <small>{PER_PAGE} por página</small>
                <button type="button" onClick={() => setPage(Math.max(1, current - 1))} aria-label="Página anterior">‹</button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button type="button" key={n} className={n === current ? "on" : ""} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button type="button" onClick={() => setPage(Math.min(pages, current + 1))} aria-label="Página siguiente">›</button>
              </div>
            </div>
          </article>

          <aside className="rk-side">
            <article className="rk-featured">
              <img
                key={featuredChar ?? "default"}
                src={artSrc}
                alt={featuredChar ? `Arte de ${featuredChar}` : ""}
                onError={() => setArtIdx((i) => Math.min(i + 1, 4))}
              />
              <span className="tag"><Crown /> JUGADOR DESTACADO</span>
              <div className="info">
                <small>{mode === "torneos" ? "CAMPEÓN DEL ÚLTIMO TORNEO" : "#1 DEL MATCHMAKING"}</small>
                <div className="row">
                  <h2>{featured?.name?.toUpperCase() ?? "—"}</h2>
                  <strong>{featured ? fmt(featured.points) : "—"} <em>PTS</em></strong>
                </div>
                <p>
                  {[featured?.character, featured?.sponsor ? `#${featured.sponsor}` : ""].filter(Boolean).join(" · ") ||
                    (mode === "matchmaking" && featured ? `${featured.wins ?? 0}V — ${featured.losses ?? 0}D en sets /ft` : "") ||
                    (mode === "torneos" ? "Ganador del último torneo de la temporada" : "")}
                </p>
                {featured?.profileId ? (
                  <div className="meta">
                    <Link href={`/perfil/${String(featured.profileId)}`}>Ver ficha completa →</Link>
                  </div>
                ) : null}
              </div>
            </article>

            <article className="panel rk-cta">
              <h3><img src={`${A}/5fb79.svg`} alt="" /> TU PRÓXIMO RIVAL ESTÁ AQUÍ.</h3>
              <p>Ranked, torneos y café. Encuentra partidas y sube de nivel.</p>
              <Link href="/matchmaking" className="discord">
                <img src={`${A}/3508d.svg`} alt="" /> Buscar partida
              </Link>
            </article>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function Team({ value }: { value?: string | undefined }) {
  if (!value) return <span className="dim">—</span>;
  const names = value.split(/[,+]/).map((n) => n.trim()).filter(Boolean);
  return (
    <div className="rk-team">
      {names.map((n) => {
        const id = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
        return (
          <span key={n} title={id}>
            <img src={`/fighters/${encodeURIComponent(id)}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
            {id}
          </span>
        );
      })}
    </div>
  );
}
