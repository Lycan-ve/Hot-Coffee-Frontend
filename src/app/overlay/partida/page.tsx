'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "@/lib/auth";
import "../../../hotcoffee-overlay-partida.css";

// Overlay de PARTIDA a pantalla completa (1920×1080) para OBS, con las
// "Death Zones" del HUD de 2XKO respetadas: ningún elemento pisa esas áreas.
//
// Parámetros de la URL:
//   ?id1=<discordId>&id2=<discordId>  autocompleta nombres/personajes desde Hot Coffee
//   &p1=Nombre&p2=Nombre              nombres manuales (tienen prioridad)
//   &s1=0&s2=0                        marcador de la serie
//   &round=GANADORES · CUARTOS        ronda (barra central superior)
//   &mid=120                          texto central grande (cronómetro/lo que sea)
//   &event=...                        nombre del evento (banner inferior)
//   &p1fuse=DOUBLE DOWN&p2fuse=FREESTYLE
//   &p1chars=EKKO,JINX&p2chars=BRAUM,ILLAOI
//   &p1tag=P1&p2tag=Bot               etiqueta junto a cada personaje
//   &p1tw=@canal&p1pr=Él              píldoras de redes/pronombres (vacías = ocultas)
//   &zones=1                          pinta las Death Zones en rojo (para verificar)
//   &bg=dark                          fondo sólido en vez de transparente

// Zonas "Death": el HUD del juego vive aquí. PROHIBIDO tocar.
const DEATH_ZONES = [
  { x: 0, y: 165, w: 560, h: 305 },    // panel HUD superior izquierda (ASSIST/HITS)
  { x: 1360, y: 165, w: 560, h: 305 }, // panel HUD superior derecha
  { x: 0, y: 690, w: 560, h: 324 },    // HUD inferior izquierda (controles/barras)
  { x: 1360, y: 690, w: 560, h: 324 }, // HUD inferior derecha
  { x: 0, y: 1014, w: 1920, h: 66 },   // franja inferior (versión/IDs del juego)
];

const norm = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function OverlayInner() {
  const params = useSearchParams();
  const q = (k: string, d = "") => params.get(k) ?? d;
  const bg = q("bg");
  const showZones = q("zones") === "1";
  const extra = Number(q("scale")) || 1;

  // Fondo transparente para OBS, sin tocar el resto de la web.
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  // Escalado del escenario 1920×1080 al tamaño de la fuente de OBS.
  const [k, setK] = useState(1);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / 1920, window.innerHeight / 1080) * extra);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [extra]);

  const id1 = q("id1");
  const id2 = q("id2");
  const prof1 = useQuery({ queryKey: ["ov2-p1", id1], queryFn: () => fetchUserProfile(id1), enabled: !!id1, refetchInterval: 15_000, refetchIntervalInBackground: true });
  const prof2 = useQuery({ queryKey: ["ov2-p2", id2], queryFn: () => fetchUserProfile(id2), enabled: !!id2, refetchInterval: 15_000, refetchIntervalInBackground: true });

  const name1 = q("p1") || prof1.data?.user.globalName || prof1.data?.user.username || "PLAYER 1";
  const name2 = q("p2") || prof2.data?.user.globalName || prof2.data?.user.username || "PLAYER 2";
  const chars1 = (q("p1chars") || [prof1.data?.mains?.point?.name, prof1.data?.mains?.assist?.name].filter(Boolean).join(",") || "EKKO,JINX").split(",").map((c) => c.trim()).filter(Boolean);
  const chars2 = (q("p2chars") || [prof2.data?.mains?.point?.name, prof2.data?.mains?.assist?.name].filter(Boolean).join(",") || "BRAUM,ILLAOI").split(",").map((c) => c.trim()).filter(Boolean);
  const tag1 = q("p1tag", "P1");
  const tag2 = q("p2tag", "P2");

  const s1 = q("s1", "0");
  const s2 = q("s2", "0");
  const round = q("round", "WINNERS QUARTER-FINAL").toUpperCase();
  const mid = q("mid", "120");
  const event = q("event", "THE MOST AMAZING TOURNAMENT EVER").toUpperCase();
  const fuse1 = q("p1fuse", "DOUBLE DOWN").toUpperCase();
  const fuse2 = q("p2fuse", "FREESTYLE").toUpperCase();
  const tw1 = q("p1tw");
  const tw2 = q("p2tw");
  const pr1 = q("p1pr");
  const pr2 = q("p2pr");

  return (
    <div className={`ov2-viewport ${bg === "dark" ? "ov2-dark" : ""}`}>
      <div className="ov2-stage" style={{ transform: `scale(${k})` }}>
        {showZones &&
          DEATH_ZONES.map((z, i) => (
            <div key={i} className="ov2-zone" style={{ left: z.x, top: z.y, width: z.w, height: z.h }} title="Death Zone" />
          ))}

        {/* ——— Jugador 1 (izquierda) ——— */}
        <div className="ov2-side ov2-p1">
          {chars1[0] && <img className="ov2-portrait" src={`/fighters/${encodeURIComponent(norm(chars1[0]))}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
          <div className="ov2-stack">
            <div className="ov2-row">
              <span className="ov2-fuse ov2-fuse-p1">{fuse1}</span>
              <span className="ov2-name">{name1}</span>
              <span className="ov2-score ov2-score-p1">{s1}</span>
            </div>
            <div className="ov2-chars">
              {chars1.slice(0, 2).map((c) => (
                <span key={c} className="ov2-char ov2-char-p1">{norm(c)} <i>{tag1}</i></span>
              ))}
            </div>
            {(tw1 || pr1) && (
              <div className="ov2-chips">
                {tw1 && <span className="ov2-chip ov2-chip-dark">{tw1}</span>}
                {pr1 && <span className="ov2-chip">{pr1}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ——— Centro: ronda + marcador grande ——— */}
        <div className="ov2-center">
          <span className="ov2-round">{round}</span>
          <span className="ov2-mid">{mid}</span>
        </div>

        {/* ——— Jugador 2 (derecha, espejado) ——— */}
        <div className="ov2-side ov2-p2">
          <div className="ov2-stack">
            <div className="ov2-row">
              <span className="ov2-score ov2-score-p2">{s2}</span>
              <span className="ov2-name">{name2}</span>
              <span className="ov2-fuse ov2-fuse-p2">{fuse2}</span>
            </div>
            <div className="ov2-chars ov2-chars-right">
              {chars2.slice(0, 2).map((c) => (
                <span key={c} className="ov2-char ov2-char-p2"><i>{tag2}</i> {norm(c)}</span>
              ))}
            </div>
            {(tw2 || pr2) && (
              <div className="ov2-chips ov2-chips-right">
                {pr2 && <span className="ov2-chip">{pr2}</span>}
                {tw2 && <span className="ov2-chip ov2-chip-dark">{tw2}</span>}
              </div>
            )}
          </div>
          {chars2[0] && <img className="ov2-portrait" src={`/fighters/${encodeURIComponent(norm(chars2[0]))}.png`} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        </div>

        {/* ——— Banner inferior (zona segura central) ——— */}
        <div className="ov2-event">
          <span>{event}</span>
        </div>
      </div>
    </div>
  );
}

export default function OverlayPartidaPage() {
  return (
    <Suspense fallback={null}>
      <OverlayInner />
    </Suspense>
  );
}
