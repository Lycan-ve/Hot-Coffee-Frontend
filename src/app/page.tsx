'use client';

import Link from "next/link";
import "../hotcoffee-home.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  Coffee,
  Gamepad2,
  Globe,
  HeartHandshake,
  Languages,
  ShieldCheck,
  Swords,
  Trophy,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { API_URL } from "@/lib/auth";
import { A, AppShell, SectionTitle } from "@/components/hc/shared";
import HomeRankings from "@/components/hc/HomeRankings";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Contadores en vivo para la portada (fallan en silencio a "—").
async function fetchTournamentCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/tournaments/count`);
    const data = res.ok ? await res.json() : null;
    const n = Number(data?.count);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function fetchPlayerCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/2xko`);
    const data = res.ok ? await res.json() : null;
    return Array.isArray(data) && data.length ? data.length : null;
  } catch {
    return null;
  }
}

async function fetchSetCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/rankings/matchmaking`);
    const data = res.ok ? await res.json() : null;
    if (!Array.isArray(data)) return null;
    const sets = data.reduce((n: number, p: { wins?: number }) => n + (p.wins ?? 0), 0);
    return sets > 0 ? sets : null;
  } catch {
    return null;
  }
}

const STEPS = [
  {
    icon: UserPlus,
    title: "CONECTA TU DISCORD",
    copy: "Entra en \u201cMi perfil\u201d con tu cuenta de Discord y deja listo tu ficha: mains, fuse y gamertag. Es tu identidad en toda la liga.",
  },
  {
    icon: CalendarCheck,
    title: "JUEGA LOS TORNEOS",
    copy: "Inscríbete en los torneos de la comunidad. Cada torneo procesado suma: cada puesto cuenta, y más arriba suma más.",
  },
  {
    icon: Trophy,
    title: "SUBE EN EL RANKING",
    copy: "El bot procesa cada torneo y actualiza el acumulado de la temporada solo. Puedes ver el total o filtrar por serie: TNS, Frame KO, Tacos Tuesday...",
  },
  {
    icon: Swords,
    title: "RETA EN MATCHMAKING",
    copy: "Busca rival desde la web o Discord y juega tus sets al mejor de 3. Cada set mueve tus puntos y tu rango, sin esperar al fin de semana.",
  },
];

export default function HomePage() {
  const { data: tourneyCount } = useQuery({ queryKey: ["home-tourney-count"], queryFn: fetchTournamentCount, staleTime: 300_000 });
  const { data: playerCount } = useQuery({ queryKey: ["home-player-count"], queryFn: fetchPlayerCount, staleTime: 300_000 });
  const { data: setCount } = useQuery({ queryKey: ["home-set-count"], queryFn: fetchSetCount, staleTime: 300_000 });
  const [artOk, setArtOk] = useState(true);

  return (
    <AppShell>
      <main className="page inicio-page">
        {/* ——— Portada ——— */}
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <SectionTitle
              eyebrow="COMUNIDAD 2XKO · TEMPORADA 2026"
              title="BIENVENIDOS A"
              accent="HOT COFFEE"
              copy="La liga competitiva de 2XKO de nuestra comunidad: torneos procesados uno a uno, ranking por puntos y matchmaking directo desde Discord. Sin humo: cada puesto suma."
            />
            <div className="hm-cta-row">
              <Link href="/ranking" className="hm-btn primary"><Trophy /> Ver el ranking</Link>
              <Link href="/matchmaking" className="hm-btn ghost"><Swords /> Buscar partida</Link>
              <a href="#como-funciona" className="hm-btn link"><ChevronDown /> Cómo funciona</a>
            </div>
            {/* Sobre la comunidad (propuesta del admin) */}
            <div className="hm-details">
              <div>
                <Globe />
                <div>
                  <strong>ALCANCE</strong>
                  <span>Abierta a jugadores de todo el continente americano.</span>
                </div>
              </div>
              <div>
                <Languages />
                <div>
                  <strong>IDIOMAS</strong>
                  <span>Español como base, con espacio para inglés y portugués.</span>
                </div>
              </div>
              <div>
                <HeartHandshake />
                <div>
                  <strong>FILOSOFÍA</strong>
                  <span>No somos un equipo: mantenemos viva la escena jugando.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hm-art panel">
            {artOk ? (
              <img
                src="/home/lycan-megaman.jpg"
                alt="Lycan y Rockman con las banderas de Venezuela y Ecuador"
                onError={() => setArtOk(false)}
              />
            ) : (
              <div className="hm-art-fallback">
                <img src={`${A}/5fb79.svg`} alt="" />
                <span>ARTE DE LA COMUNIDAD</span>
              </div>
            )}
            <span className="hm-art-tag"><Coffee /> LYCAN &amp; BANEADO SENSEI</span>
          </div>
        </section>

        {/* ——— Contadores en vivo ——— */}
        <section className="hm-stats">
          <div className="hm-stat">
            <Trophy />
            <div>
              <small>TORNEOS PROCESADOS</small>
              <strong>{tourneyCount ? fmt(tourneyCount) : "—"}</strong>
            </div>
          </div>
          <div className="hm-stat">
            <Users />
            <div>
              <small>JUGADORES EN LA LIGA</small>
              <strong>{playerCount ? fmt(playerCount) : "—"}</strong>
            </div>
          </div>
          <div className="hm-stat">
            <Swords />
            <div>
              <small>SETS /FT JUGADOS</small>
              <strong>{setCount ? fmt(setCount) : "—"}</strong>
            </div>
          </div>
        </section>

        {/* ——— Qué es ——— */}
        <section className="hm-about">
          <article className="panel">
            <div className="head"><h3>¿QUÉ ES HOT COFFEE?</h3><Coffee /></div>
            <p className="lead">
              Hot Coffee es el hub competitivo de 2XKO de la comunidad: un solo lugar donde vive todo lo que importa
              de la temporada.
            </p>
            <ul>
              <li><strong>Ranking de torneos.</strong> El acumulado de puntos de toda la temporada, torneo a torneo y por serie.</li>
              <li><strong>Ranking de matchmaking.</strong> La escalera de sets /ft entre miembros, con rangos y divisiones propias.</li>
              <li><strong>Perfiles.</strong> Tu ficha con mains, fuse, historial de sets y posición en ambas tablas.</li>
              <li><strong>Matchmaking.</strong> Encuentra rival al instante y reporta el resultado desde Discord.</li>
            </ul>
          </article>
        </section>

        {/* ——— Rankings: torneos y online (sección 3, propuesta del admin) ——— */}
        <HomeRankings />

        {/* ——— Arena: accesos rápidos (propuesta del admin) ——— */}
        <section className="hm-arena" id="arena">
          <SectionTitle
            eyebrow="CENTRAL DE ACCESO RÁPIDO"
            title="ENTRA A LA"
            accent="ARENA"
            copy="Todo Hot Coffee a un clic: busca rival al instante, revisa tu ficha o consulta las tablas oficiales."
          />
          <div className="hm-arena-grid">
            <Link href="/matchmaking" className="hm-arena-main">
              <span className="hm-arena-ico"><Swords /></span>
              <span className="hm-arena-txt">
                <strong>Buscar partida</strong>
                <small>Ingresa a la cola de Online Matchmaking y juega tus sets /ft</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
            <Link href="/perfil" className="hm-arena-card">
              <span className="hm-arena-ico"><User /></span>
              <span className="hm-arena-txt">
                <strong>Ver mi perfil</strong>
                <small>Historial, mains y estadísticas</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
            <Link href="/ranking" className="hm-arena-card">
              <span className="hm-arena-ico"><Trophy /></span>
              <span className="hm-arena-txt">
                <strong>Rank de torneos</strong>
                <small>Acumulado de la temporada, filtrable por serie</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
            <Link href="/ranking-matchmaking" className="hm-arena-card">
              <span className="hm-arena-ico"><BarChart3 /></span>
              <span className="hm-arena-txt">
                <strong>Rank matchmaking</strong>
                <small>Escalera de sets con rangos y divisiones</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
          </div>
          <p className="hm-motto">SEGUIMOS JUGANDO, SEGUIMOS COMPITIENDO.</p>
        </section>

        {/* ——— Cómo funciona ——— */}
        <section className="hm-how" id="como-funciona">
          <SectionTitle
            eyebrow="PASO A PASO"
            title="CÓMO"
            accent="FUNCIONA"
            copy="Cuatro pasos y ya estás dentro de la liga. El bot hace el trabajo sucio; tú solo juega."
          />
          <div className="hm-steps">
            {STEPS.map((s, i) => (
              <article className="panel hm-step" key={s.title}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span className="hm-step-icon"><s.icon /></span>
                <h4>{s.title}</h4>
                <p>{s.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ——— Puntos ——— */}
        <section className="hm-points">
          <article className="panel">
            <div className="head"><h3>PUNTOS EN TORNEOS</h3><Trophy /></div>
            <p className="lead">Cada torneo cuenta y cada puesto suma: más arriba en la tabla, más puntos para tu acumulado.</p>
            <p>
              El ranking de torneos acumula toda la temporada y se actualiza solo cuando el bot procesa un evento.
              ¿Solo te interesa una serie? Filtra por Hot Coffee, TNS, Frame KO, Tacos Tuesday y más, y verás la tabla
              recalculada solo con esos torneos.
            </p>
          </article>
          <article className="panel">
            <div className="head"><h3>PUNTOS EN MATCHMAKING</h3><Swords /></div>
            <p className="lead">Cada set /ft confirmado mueve tu puntuación: ganarle a un rival mejor posicionado suma más.</p>
            <p>
              La escalera de matchmaking tiene rangos y divisiones propias, con <ShieldCheck className="hm-inline" /> escudo
              anti-descenso para que una mala racha no te tire de golpe, y revancha rápida: si acabas de perder, tienes
              15 minutos para pedir la revancha con un toque.
            </p>
          </article>
        </section>

        {/* ——— CTA final ——— */}
        <section className="hm-final panel">
          <div>
            <h3><Gamepad2 /> TU PRÓXIMO RIVAL ESTÁ AQUÍ.</h3>
            <p>Entra al Discord, lanza tu reto y sube de rango. El café ya se está sirviendo.</p>
          </div>
          <div className="hm-cta-row">
            <Link href="/matchmaking" className="hm-btn primary"><Swords /> Buscar partida</Link>
            <Link href="/ranking" className="hm-btn ghost"><Trophy /> Ver el ranking</Link>
          </div>
        </section>

        {/* ——— Créditos (imágenes y arte, propuesta del admin) ——— */}
        <section className="hm-credits panel">
          <div className="head"><h3>CRÉDITOS</h3><Coffee /></div>
          <ul className="hm-credits-list">
            <li>
              <strong>Arte de portada.</strong> Ilustración de la comunidad: Lycan &amp; Baneado Sensei.
            </li>
            <li>
              <strong>2XKO.</strong> Personajes, nombres e imágenes © Riot Games. Sitio hecho por fans, sin
              afiliación ni respaldo oficial.
            </li>
            <li>
              <strong>Torneos.</strong> Brackets e inscripción en{" "}
              <a href="https://start.gg" target="_blank" rel="noopener noreferrer">Start.gg</a>.
            </li>
            <li>
              <strong>Concepto del sitio.</strong> Estructura del home: Miguel “Baneado Sensei”.
            </li>
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
