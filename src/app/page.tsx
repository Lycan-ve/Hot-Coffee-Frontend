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
  Coffee,
  Globe,
  HeartHandshake,
  Languages,
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

type Step = {
  icon: LucideIcon;
  title: string;
  copy: string;
  link: string;
  linkText: string;
  external?: boolean;
};

const STEPS: Step[] = [
  {
    icon: UserPlus,
    title: "ÚNETE AL DISCORD",
    copy: "Forma parte del servidor Hot Coffee 2XKO. Es el punto de encuentro y un requisito para participar en la liga.",
    link: DISCORD_INVITE,
    linkText: "Unirme al Discord",
    external: true,
  },
  {
    icon: User,
    title: "CONECTA TU CUENTA",
    copy: "Pulsa «Iniciar sesión con Discord» en la parte superior. Así podrás usar tu perfil y entrar al matchmaking.",
    link: "/perfil",
    linkText: "Iniciar sesión",
  },
  {
    icon: Swords,
    title: "ELIGE CÓMO JUGAR",
    copy: "Busca un rival en sets FT 3 cuando quieras o participa en los torneos de la comunidad.",
    link: "/matchmaking",
    linkText: "Buscar partida",
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
              title="COMPITE EN"
              accent="HOT COFFEE"
              copy="Torneos, partidas FT 3 y tu progreso competitivo de 2XKO, reunidos en un solo lugar."
            />
            <div className="hm-cta-row">
              <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hm-btn primary"><UserPlus /> Unirme al Discord</a>
              <Link href="/perfil" className="hm-btn ghost"><User /> Ya tengo cuenta</Link>
              <Link href="#empezar" className="hm-btn link"><ArrowRight /> Cómo empezar</Link>
            </div>
            <p className="hm-first-note">
              <strong>¿Primera vez?</strong> Primero únete al Discord y después conecta tu cuenta desde «Ya tengo cuenta».
              Necesitas pertenecer al servidor para competir en la liga.
            </p>
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

        {/* ——— Primeros pasos ——— */}
        <section className="hm-how" id="empezar">
          <SectionTitle
            eyebrow="PRIMERA VEZ EN HOT COFFEE"
            title="EMPIEZA EN"
            accent="3 PASOS"
            copy="Sigue este orden y sabrás exactamente qué necesitas para competir."
          />
          <div className="hm-steps">
            {STEPS.map((s, i) => (
              <article className="panel hm-step" key={s.title}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span className="hm-step-icon"><s.icon /></span>
                <h4>{s.title}</h4>
                <p>{s.copy}</p>
                {s.external ? (
                  <a className="hm-step-link" href={s.link} target="_blank" rel="noopener noreferrer">
                    {s.linkText} <ArrowRight />
                  </a>
                ) : (
                  <Link className="hm-step-link" href={s.link}>
                    {s.linkText} <ArrowRight />
                  </Link>
                )}
              </article>
            ))}
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

        {/* ——— Rankings ——— */}
        <HomeRankings />

        {/* ——— Accesos principales ——— */}
        <section className="hm-arena" id="arena">
          <SectionTitle
            eyebrow="CUANDO YA ESTÉS DENTRO"
            title="ELIGE TU"
            accent="SIGUIENTE PASO"
            copy="Puedes jugar una partida, consultar los resultados de la temporada o revisar tu progreso."
          />
          <div className="hm-arena-grid">
            <Link href="/matchmaking" className="hm-arena-main">
              <span className="hm-arena-ico"><Swords /></span>
              <span className="hm-arena-txt">
                <strong>Buscar partida</strong>
                <small>Entra a la cola y juega un set FT 3 contra alguien de tu nivel</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
            <Link href="/ranking" className="hm-arena-card">
              <span className="hm-arena-ico"><Trophy /></span>
              <span className="hm-arena-txt">
                <strong>Ranking de torneos</strong>
                <small>Consulta tus puntos y posiciones en la temporada</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
            <Link href="/perfil" className="hm-arena-card">
              <span className="hm-arena-ico"><User /></span>
              <span className="hm-arena-txt">
                <strong>Mi perfil</strong>
                <small>Configura tu equipo y revisa tus estadísticas e historial</small>
              </span>
              <ArrowRight className="hm-arena-arrow" />
            </Link>
          </div>
          <p className="hm-motto">SEGUIMOS JUGANDO, SEGUIMOS COMPITIENDO.</p>
        </section>

        {/* ——— Lo esencial sobre los puntos ——— */}
        <section className="hm-points">
          <article className="panel">
            <div className="head"><h3>RANKING DE TORNEOS</h3><Trophy /></div>
            <p className="lead">Los torneos oficiales suman puntos a la clasificación de la temporada.</p>
            <p>El bot procesa los resultados y actualiza la tabla automáticamente. Consulta el ranking para ver posiciones, puntos y resultados por serie.</p>
          </article>
          <article className="panel">
            <div className="head"><h3>RANKING DE MATCHMAKING</h3><Swords /></div>
            <p className="lead">Los sets de matchmaking son partidas FT 3 entre miembros de la comunidad.</p>
            <p>Los primeros 5 sets son de clasificación: al completarlos recibirás tu rango inicial. Después, tus resultados harán subir o bajar tus puntos de liga.</p>
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