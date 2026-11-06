'use client';

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Crown, Download, Info, RefreshCw, Search, SlidersHorizontal, Swords, Users } from "lucide-react";
import { API_URL, getToken } from "@/lib/auth";
import { A, AppShell, SectionTitle } from "@/components/hc/shared";

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

async function fetchRanking(from: number, to: number): Promise<{ players: RankPlayer[]; live: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/2xko?from=${from}&to=${to}`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length) {
      return { players: [...data].sort((a, b) => a.ranking - b.ranking), live: true };
    }
  } catch {
    /* sin conexión: usamos datos de respaldo */
  }
  return { players: fallback, live: false };
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

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Fila unificada: sirve tanto para el ranking de torneos como el de matchmaking.
type Row = {
  key: string;
  ranking: number;
  name: string;
  sponsor?: string;
  avatar?: string;
  character?: string;
  wins?: number;
  losses?: number;
  points: number;
  profileId?: string;
};

export default function RankingPage() {
  const [mode, setMode] = useState<"torneos" | "matchmaking">("torneos");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(DEFAULT_RANGE);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const boardRef = useRef<HTMLElement>(null);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ranking", from, to],
    queryFn: () => fetchRanking(from, to),
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
        points: p.points,
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
  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const leader = rows[0];
  const mmSets = useMemo(() => mmPlayers.reduce((n, p) => n + p.wins, 0), [mmPlayers]);

  const switchMode = (m: "torneos" | "matchmaking") => {
    setMode(m);
    setPage(1);
  };

  const sync = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/sync`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
              <p><strong>{loading ? "—" : String(rows.length).padStart(2, "0")}</strong> jugadores en la liga</p>
            </div>
          </div>
          <div className="rk-stat">
            <Swords />
            <div>
              <small>{mode === "torneos" ? "TORNEOS CONTADOS" : "SETS JUGADOS"}</small>
              {mode === "torneos" ? (
                <p><strong>{String(to - from + 1).padStart(2, "0")}</strong> torneos {from}—{to}</p>
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

        <section className="rk-layout">
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
                  ? `ACUMULADO · TORNEOS ${String(from).padStart(2, "0")}—${String(to).padStart(2, "0")}`
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
                  Desde
                  <select value={from} onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (v > to) setTo(v); setPage(1); }}>
                    {ranges.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>
                  Hasta
                  <select value={to} onChange={(e) => { const v = Number(e.target.value); setTo(v); if (v < from) setFrom(v); setPage(1); }}>
                    {ranges.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="rk-scroll">
              <table>
                <thead>
                  <tr>
                    <th>POS.</th><th>JUGADOR</th><th>{mode === "torneos" ? "EQUIPO" : "RECORD"}</th><th className="accent">PUNTOS ↓</th><th className="r">PERFIL</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}><td colSpan={5}><div className="rk-skeleton" /></td></tr>
                    ))}
                  {!loading && shown.length === 0 && (
                    <tr><td colSpan={5} className="c">No hay jugadores con ese nombre.</td></tr>
                  )}
                  {shown.map((r) => {
                    const top = r.ranking <= 3;
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
                            </div>
                          </div>
                        </td>
                        <td>
                          {mode === "torneos" ? (
                            <Team value={r.character} />
                          ) : (
                            <span>
                              <b className="chg up">{r.wins ?? 0}V</b> · <b className="chg down">{r.losses ?? 0}D</b>
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="pts-cell">
                            <span className={`pts ${top ? "top" : ""}`}>{fmt(r.points)}</span>
                            <i><b style={{ width: `${Math.max(6, Math.round((r.points / maxPoints) * 100))}%` }} /></i>
                          </div>
                        </td>
                        <td className="r">
                          {r.profileId ? (
                            <Link href={`/perfil/${r.profileId}`} className="rk-link" aria-label={`Ver perfil de ${r.name}`}>
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
              <img src={`${A}/6237f.png`} alt="" />
              <span className="tag"><Crown /> JUGADOR DESTACADO</span>
              <div className="info">
                <small>#1 {mode === "torneos" ? "DE LA LIGA" : "DEL MATCHMAKING"}</small>
                <div className="row">
                  <h2>{leader?.name?.toUpperCase() ?? "—"}</h2>
                  <strong>{leader ? fmt(leader.points) : "—"} <em>PTS</em></strong>
                </div>
                <p>
                  {[leader?.character, leader?.sponsor ? `#${leader.sponsor}` : ""].filter(Boolean).join(" · ") ||
                    (mode === "matchmaking" && leader ? `${leader.wins ?? 0}V — ${leader.losses ?? 0}D en sets /ft` : "")}
                </p>
                {leader?.profileId ? (
                  <div className="meta">
                    <Link href={`/perfil/${leader.profileId}`}>Ver ficha completa →</Link>
                  </div>
                ) : null}
              </div>
            </article>

            <article className="panel rk-points">
              <div className="head"><h3>¿CÓMO SE SUMA?</h3><Info /></div>
              <p className="lead">Los puntos se acumulan con cada torneo de la temporada y con los sets de matchmaking.</p>
              <p>Cada torneo cuenta. Cada puesto suma.</p>
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
