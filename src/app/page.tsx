'use client';

import Link from "next/link";
import { useRef, useState } from "react";
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

const PER_PAGE = 10;
const RANGES = Array.from({ length: 10 }, (_, i) => i + 1);

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default function RankingPage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const boardRef = useRef<HTMLElement>(null);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ranking", from, to],
    queryFn: () => fetchRanking(from, to),
    staleTime: 60_000,
  });
  const players = data?.players ?? [];
  const filtered = players.filter((p) =>
    `${p.gamerTag} ${p.sponsor ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const maxPoints = Math.max(1, ...players.map((p) => p.points));
  const leader = players[0];

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
              note={data && !data.live ? "Datos de respaldo" : undefined}
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
              <p><strong>{isLoading ? "—" : String(players.length).padStart(2, "0")}</strong> jugadores en la liga</p>
            </div>
          </div>
          <div className="rk-stat">
            <Swords />
            <div>
              <small>TORNEOS CONTADOS</small>
              <p><strong>{String(to - from + 1).padStart(2, "0")}</strong> torneos {from}—{to}</p>
            </div>
          </div>
          <div className="rk-stat leader">
            <Crown />
            <div>
              <small>LÍDER ACTUAL</small>
              <p><strong>{leader?.gamerTag ?? "—"}</strong> {leader ? `${fmt(leader.points)} puntos` : ""}</p>
            </div>
            <b>#1</b>
          </div>
        </section>

        <section className="rk-layout">
          <article className="panel rk-table" ref={boardRef}>
            <div className="rk-tabs">
              <button className="on" type="button">RANKING GENERAL</button>
              <span>ACUMULADO · TORNEOS {String(from).padStart(2, "0")}—{String(to).padStart(2, "0")}</span>
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
              <button type="button" className={showFilters ? "on" : ""} onClick={() => setShowFilters((v) => !v)}>
                <SlidersHorizontal /> Filtrar torneos
              </button>
              <button type="button" onClick={sync} disabled={isFetching}>
                <RefreshCw className={isFetching ? "spin" : ""} /> {isFetching ? "Sincronizando" : "Sincronizar"}
              </button>
              <button type="button" onClick={exportPng}><Download /> PNG</button>
            </div>
            {showFilters && (
              <div className="rk-filters">
                <span>TORNEOS</span>
                <label>
                  Desde
                  <select value={from} onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (v > to) setTo(v); setPage(1); }}>
                    {RANGES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>
                  Hasta
                  <select value={to} onChange={(e) => { const v = Number(e.target.value); setTo(v); if (v < from) setFrom(v); setPage(1); }}>
                    {RANGES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="rk-scroll">
              <table>
                <thead>
                  <tr>
                    <th>POS.</th><th>JUGADOR</th><th>EQUIPO</th><th className="accent">PUNTOS ↓</th><th className="r">PERFIL</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}><td colSpan={5}><div className="rk-skeleton" /></td></tr>
                    ))}
                  {!isLoading && shown.length === 0 && (
                    <tr><td colSpan={5} className="c">No hay jugadores con ese nombre.</td></tr>
                  )}
                  {shown.map((p) => {
                    const top = p.ranking <= 3;
                    const profileId = p.discordId || (p.id != null ? String(p.id) : "");
                    return (
                      <tr key={`${p.ranking}-${p.gamerTag}`} className={p.ranking === 1 ? "first" : ""}>
                        <td className={`pos ${top ? "top" : ""}`}>{String(p.ranking).padStart(2, "0")}</td>
                        <td>
                          <div className="who">
                            {p.avatarUrl ? (
                              <img className="ini" src={p.avatarUrl} alt="" />
                            ) : (
                              <span className={`ini ${top ? "top" : ""}`}>{p.gamerTag[0]}</span>
                            )}
                            <div>
                              <strong>{p.gamerTag} {p.sponsor ? <em>#{p.sponsor}</em> : null}</strong>
                            </div>
                          </div>
                        </td>
                        <td><Team value={p.character} /></td>
                        <td>
                          <div className="pts-cell">
                            <span className={`pts ${top ? "top" : ""}`}>{fmt(p.points)}</span>
                            <i><b style={{ width: `${Math.max(6, Math.round((p.points / maxPoints) * 100))}%` }} /></i>
                          </div>
                        </td>
                        <td className="r">
                          {profileId ? (
                            <Link href={`/perfil/${profileId}`} className="rk-link" aria-label={`Ver perfil de ${p.gamerTag}`}>
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
                <small>#1 DE LA LIGA</small>
                <div className="row">
                  <h2>{leader?.gamerTag?.toUpperCase() ?? "—"}</h2>
                  <strong>{leader ? fmt(leader.points) : "—"} <em>PTS</em></strong>
                </div>
                <p>{[leader?.character, leader?.sponsor ? `#${leader.sponsor}` : ""].filter(Boolean).join(" · ")}</p>
                {leader?.discordId ? (
                  <div className="meta">
                    <Link href={`/perfil/${leader.discordId}`}>Ver ficha completa →</Link>
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
