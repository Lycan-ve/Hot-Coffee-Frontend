'use client';

import Link from "next/link";
import "../hotcoffee-home.css";
import "../hotcoffee-home-steps.css";
import "../hotcoffee-home-credits.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
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

// Invitación a la comunidad Hot Coffee (regla del admin: para entrar a la liga hay que ser miembro).
const DISCORD_INVITE = "https://discord.com/invite/8NbFuJcSCH";

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

type Step = { icon: LucideIcon; title: string; copy: string; link?: string };

const STEPS: Step[] = [
  {
    icon: UserPlus,
    title: "ÚNETE A LA COMUNIDAD",
    copy: "Todo empieza con un café y un Discord. Únete al servidor, preséntate y cuéntanos qué mains traes: ahí se cuecen los torneos, los retos y las bromas. Sin pasar por el servidor no hay liga, así que este es tu primer sorbo.",
    link: DISCORD_INVITE,
  },
  {
    icon: CalendarCheck,
    title: "JUEGA LOS TORNEOS",
    copy: "Inscríbete en Start.gg, juega tu bracket y a disfrutar. Cuando el torneo termina, el bot lo procesa solito: no tienes que reclamar nada, tus puntos aparecen en la tabla. Tú solo juega.",
  },
  {
    icon: Trophy,
    title: "ENTRA AL RANKING (TOP 8)",
    copy: "Cada torneo premia a los 8 mejores: el 1º paga 100 pts y desde ahí baja la escalera hasta el 8º (y en series como TNS y Paragon también suma el Top 16). Es acumulativo: la temporada es una maratón, no un sprint.",
  },
  {
    icon: Swords,
    title: "RETA EN MATCHMAKING",
    copy: "¿Ganas de competir un martes a media noche? No esperes al torneo: entra a la cola desde la web, te cruzamos con alguien de tu nivel y juegan un FT 3. El resultado se reporta aquí mismo y tu LP se mueve al instante.",
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
              copy="La liga competitiva de 2XKO de nuestra comunidad: torneos procesados uno a uno, ranking por puntos y matchmaking directo desde la web. Sin humo: cada puesto suma."
            />
            <div className="hm-cta-row">
              <Link href="/ranking" className="hm-btn primary"><Trophy /> Ver el ranking</Link>
              <Link href="/matchmaking" className="hm-btn ghost"><Swords /> Buscar partida</Link>
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hm-btn link"><UserPlus /> Unirme al Discord</a>
            </div>
            {/* Sobre la comunidad */}
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
              <li><strong>Ranking de torneos.</strong> El acumulado de la temporada: solo el Top 8 de cada torneo suma puntos.</li>
              <li><strong>Ranking de matchmaking.</strong> La escalera de sets /ft entre miembros, con rangos y divisiones propias.</li>
              <li><strong>Perfiles.</strong> Tu ficha con mains, fuse, historial de sets y posición en ambas tablas.</li>
              <li><strong>Matchmaking.</strong> Encuentra rival al instante y reporta el resultado desde la web.</li>
            </ul>
          </article>
        </section>

        {/* ——— Rankings ——— */}
        <HomeRankings />

        {/* ——— Arena ——— */}
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
            copy="Entrar a la liga es más fácil de lo que parece: un Discord, unos torneos y muchas ganas de jugar. Toma un café, que te lo explicamos en cuatro pasos."
          />
          <div className="hm-steps">
            {STEPS.map((s, i) => (
              <article className="panel hm-step" key={s.title}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span className="hm-step-icon"><s.icon /></span>
                <h4>{s.title}</h4>
                <p>{s.copy}</p>
                {s.link ? (
                  <a className="hm-step-link" href={s.link} target="_blank" rel="noopener noreferrer">
                    Unirme al Discord <ArrowRight />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {/* ——— Puntos ——— */}
        <section className="hm-points">
          <article className="panel">
            <div className="head"><h3>PUNTOS EN TORNEOS</h3><Trophy /></div>
            <p className="lead">Cada torneo es una nueva oportunidad de sumar: cuanto más alto llegues en el bracket, más puntos caen en tu taza.</p>
            <p>
              El ranking acumula toda la temporada y se actualiza cuando el bot termina de procesar cada evento:
              tú solo juega, del resto nos encargamos. ¿Sigues una serie en particular? Filtra por Hot Coffee, TNS,
              Frame KO, Tacos Tuesday y más, y la tabla se recalcula solo con esos torneos.
            </p>
          </article>
          <article className="panel">
            <div className="head"><h3>PUNTOS EN MATCHMAKING</h3><Swords /></div>
            <p className="lead">
              Aquí todos los sets son FT 3 y nacen en esta misma página: entras a la cola, te cruzas con alguien de
              tu nivel y cada set mueve tu LP.
            </p>
            <p>
              Nadie empieza con rango: tus primeros 5 sets son de clasificación y con ellos te asignamos tu primer
              rango. Desde ahí, cada 100 LP es una división nueva, de Hierro a Challenger. Vencer a alguien de tu
              nivel paga +15 LP; ganarle a uno superior suma +10 por nivel de diferencia; y perder contra uno
              inferior, eso sí, se siente más en la cartera. Las rachas se celebran: con 3 victorias seguidas te
              emparejan un nivel arriba y cada victoria en racha da +5 LP extra (tope +15), lo mismo que un 3-0
              perfecto. ¿Perdiste por poco?{" "}
              <span className="inline-flex items-center gap-1 align-middle whitespace-nowrap">
                <ShieldCheck className="hm-inline" /> El escudo anti-descenso
              </span>{" "}
              te guarda el sitio en tu división y tienes 15 minutos para pedir la revancha.
            </p>
          </article>
        </section>

        {/* ——— CTA final ——— */}
        {/* <section className="hm-final panel">
          <div>
            <h3><Gamepad2 /> TU PRÓXIMO RIVAL ESTÁ AQUÍ.</h3>
            <p>Entra al Discord, lanza tu reto y sube de rango. El café ya se está sirviendo.</p>
          </div>
          <div className="hm-cta-row">
            <Link href="/matchmaking" className="hm-btn primary"><Swords /> Buscar partida</Link>
            <Link href="/ranking" className="hm-btn ghost"><Trophy /> Ver el ranking</Link>
          </div>
        </section> */}

        {/* ——— Créditos ——— */}
        <section className="hm-credits panel">
          <div className="head"><h3>CRÉDITOS</h3><Coffee /></div>
          <ul className="hm-credits-people">
            <li>
              <img
                className="hm-credit-avatar"
                src="https://cdn.discordapp.com/avatars/1067139507922681978/85145fc1cf5b160564d2dea9c48551d5.png?size=128"
                alt="Avatar de Discord de Lycan"
              />
              <div>
                <strong>Lycan</strong>
                <small>Desarrollador del sitio</small>
              </div>
            </li>
            <li>
              <img
                className="hm-credit-avatar"
                src="https://cdn.discordapp.com/avatars/391306186831691778/6ac60d95b933d94e2f0b09448e71b7dc.png?size=128"
                alt="Avatar de Discord de Baneado Sensei"
              />
              <div>
                <strong>Baneado Sensei</strong>
                <small>Admin de la comunidad de Discord</small>
              </div>
            </li>
          </ul>
        </section>
      </main>
    </AppShell>
  );
}