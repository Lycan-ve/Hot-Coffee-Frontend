'use client';

import Link from "next/link";
import "../hotcoffee-home.css";
import "../hotcoffee-home-steps.css";
import "../hotcoffee-home-credits.css";
import "../hotcoffee-home-hero.css";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
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
import { API_URL, fetchMe, type MeResponse } from "@/lib/auth";
import { A, AppShell, RankBadge, SectionTitle } from "@/components/hc/shared";
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
    copy: "El punto de encuentro de la liga y un requisito para competir.",
    link: DISCORD_INVITE,
    linkText: "Unirme",
    external: true,
  },
  {
    icon: User,
    title: "CONECTA TU CUENTA",
    copy: "Inicia sesión con Discord para usar tu perfil y el matchmaking.",
    link: "/perfil",
    linkText: "Iniciar sesión",
  },
  {
    icon: Swords,
    title: "ELIGE CÓMO JUGAR",
    copy: "Sets FT 3 cuando quieras o los torneos de la comunidad.",
    link: "/matchmaking",
    linkText: "Buscar partida",
  },
];

export default function HomePage() {
  const { data: tourneyCount } = useQuery({ queryKey: ["home-tourney-count"], queryFn: fetchTournamentCount, staleTime: 300_000 });
  const { data: playerCount } = useQuery({ queryKey: ["home-player-count"], queryFn: fetchPlayerCount, staleTime: 300_000 });
  const { data: setCount } = useQuery({ queryKey: ["home-set-count"], queryFn: fetchSetCount, staleTime: 300_000 });
  const [artOk, setArtOk] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  // Con sesión, el hero cambia: tu estado y un solo botón naranja (Buscar partida).
  useEffect(() => {
    let alive = true;
    fetchMe().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const meGames = me ? me.stats.wins + me.stats.losses : 0;
  const mePlaced = me ? me.rank.placed !== false : false;

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

            {me ? (
              /* Con sesión: el estado del jugador es el protagonista. */
              <div className="hm-status panel">
                <div className="hm-status-rank">
                  <RankBadge small rank={me.rank} />
                </div>
                <div className="hm-status-who">
                  {me.user.avatarUrl ? (
                    <img className="hm-status-av" src={me.user.avatarUrl} alt="" />
                  ) : (
                    <span className="hm-status-av">{(me.user.guildNickname || me.user.globalName || me.user.username)[0]}</span>
                  )}
                  <div>
                    <strong>{me.user.guildNickname || me.user.globalName || me.user.username}</strong>
                    <span>
                      {mePlaced
                        ? `${me.rank.displayName} · ${me.stats.points} RP${me.stats.rankingPosition > 0 ? ` · #${me.stats.rankingPosition}` : ""}`
                        : `Clasificando ${Math.min(meGames, 5)}/5 · ${me.rank.rp} RP`}
                    </span>
                  </div>
                </div>
                <Link href="/matchmaking" className="hm-btn primary">
                  <Swords /> Buscar partida
                </Link>
              </div>
            ) : (
              /* Invitado: un solo titular grande y un solo botón naranja. */
              <div className="hm-cta-row">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hm-btn primary big">
                  <UserPlus /> Unirme al Discord
                </a>
              </div>
            )}

            <p className="hm-first-note">
              <strong>¿Primera vez?</strong> Primero únete al Discord y después conecta tu cuenta desde{" "}
              <Link className="link" href="/perfil">«Ya tengo cuenta»</Link>. Necesitas pertenecer al servidor para
              competir en la liga.{" "}
              <Link className="link" href="#empezar">Cómo empezar ↓</Link>
            </p>

            {/* Las cifras y explicaciones bajan de volumen: un desplegable. */}
            <details className="hm-more">
              <summary>
                <Globe /> Sobre la comunidad
              </summary>
              <div className="hm-more-grid">
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
            </details>
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

        {/* ——— Primeros pasos: una franja con iconos ——— */}
        <section className="hm-how" id="empezar">
          <SectionTitle
            eyebrow="PRIMERA VEZ EN HOT COFFEE"
            title="EMPIEZA EN"
            accent="3 PASOS"
            copy="Sigue este orden y sabrás exactamente qué necesitas para competir."
          />
          <ol className="panel hm-steps-strip">
            {STEPS.map((s, i) => (
              <li className="hm-step" key={s.title}>
                <span className="hm-step-icon">
                  <s.icon />
                  <b>{i + 1}</b>
                </span>
                <div className="hm-step-txt">
                  <strong>{s.title}</strong>
                  <span>{s.copy}</span>
                </div>
                {s.external ? (
                  <a className="hm-step-link" href={s.link} target="_blank" rel="noopener noreferrer">
                    {s.linkText} <ArrowRight />
                  </a>
                ) : (
                  <Link className="hm-step-link" href={s.link}>
                    {s.linkText} <ArrowRight />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ——— Contadores en vivo: una línea, sin tarjetas ——— */}
        <p className="hm-stats-line">
          <b>{tourneyCount ? fmt(tourneyCount) : "—"}</b> torneos procesados
          <i>·</i>
          <b>{playerCount ? fmt(playerCount) : "—"}</b> jugadores en la liga
          <i>·</i>
          <b>{setCount ? fmt(setCount) : "—"}</b> sets FT 3 jugados
        </p>

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
