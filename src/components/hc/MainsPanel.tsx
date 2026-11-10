'use client';

import { useEffect, useState } from "react";
import { fuseIconUrl, saveMains, type MeResponse } from "@/lib/auth";
import { getRoster, type RosterEntry } from "@/lib/sala";
import "./mains-panel.css";

const fighterIcon = (id: string) => "/fighters/" + encodeURIComponent(id) + ".png";

type MainChar = { id: string; name: string };

/** Marco 2XKO: recuadro blanco con borde negro grueso y la imagen adentro. */
function Frame({
  x,
  y,
  size,
  src,
  meet = false,
  delay = 0,
}: {
  x: number;
  y: number;
  size: number;
  src?: string;
  meet?: boolean;
  delay?: number;
}) {
  const inset = 8;
  return (
    <g className="mains-art" style={delay ? { animationDelay: delay + "s" } : undefined}>
      <rect className="mains-frame-fill" x={x} y={y} width={size} height={size} />
      {src ? (
        <image
          href={src}
          x={x + inset}
          y={y + inset}
          width={size - inset * 2}
          height={size - inset * 2}
          preserveAspectRatio={meet ? "xMidYMid meet" : "xMidYMin slice"}
        />
      ) : null}
      <rect className="mains-frame-line" x={x} y={y} width={size} height={size} />
    </g>
  );
}

/**
 * MainsPanel: equipo principal del jugador con el diseño de la maqueta 2XKO
 * (marcos blancos con borde negro, logo del juego y la taza Hot Coffee).
 * - Perfil propio: muestra el equipo guardado; el botón CAMBIAR EQUIPO
 *   despliega la selección de fighters y fuse (GUARDAR / CANCELAR).
 * - Perfil ajeno: vista de solo lectura del equipo configurado.
 */
export function MainsPanel({ me, own }: { me: MeResponse; own: boolean }) {
  const saved = me.mains;
  const [roster, setRoster] = useState<{ characters: RosterEntry[]; fuses: RosterEntry[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [char1, setChar1] = useState(saved?.point?.id ?? "");
  const [char2, setChar2] = useState(saved?.assist?.id ?? "");
  const [fuse, setFuse] = useState(saved?.fuse?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getRoster().then((r) => setRoster(r));
  }, []);

  const pick = (id: string, fallback?: MainChar, list?: RosterEntry[]): MainChar | undefined =>
    list?.find((c) => c.id === id) ?? (id ? fallback : undefined);

  const point = pick(char1, saved?.point, roster?.characters);
  const assist = pick(char2, saved?.assist, roster?.characters);
  const fuseChar = pick(fuse, saved?.fuse, roster?.fuses);
  const complete = !!(point && assist && fuseChar);

  const resetToSaved = () => {
    setChar1(saved?.point?.id ?? "");
    setChar2(saved?.assist?.id ?? "");
    setFuse(saved?.fuse?.id ?? "");
  };

  const save = async () => {
    if (!char1 || !char2 || !fuse || saving) return;
    setSaving(true);
    setOk(false);
    setNotice(null);
    const err = await saveMains(char1, char2, fuse);
    setSaving(false);
    if (err) {
      setNotice(err);
      return;
    }
    setOk(true);
    setNotice("¡Equipo guardado!");
    setEditing(false);
  };

  const characterChips = (selected: string, choose: (id: string) => void) =>
    roster ? (
      roster.characters.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.name}
          aria-label={c.name}
          className={"mains-chip" + (selected === c.id ? " on" : "")}
          onClick={() => choose(c.id)}
        >
          <img src={fighterIcon(c.id)} alt={c.name} />
        </button>
      ))
    ) : (
      <span className="hc-empty">Cargando roster…</span>
    );

  const label = complete
    ? point!.name + " / " + assist!.name + " - " + fuseChar!.name
    : "FIGHTER 1 / FIGHTER 2 - FUSES";

  const hint = complete
    ? own
      ? "EQUIPO PRINCIPAL · VISIBLE EN TU PERFIL PÚBLICO"
      : "EQUIPO PRINCIPAL DE ESTE JUGADOR"
    : own
      ? editing
        ? "ELIGE TUS DOS FIGHTERS Y SU FUSE"
        : "PULSA CONFIGURAR EQUIPO PARA ARMAR TU DUO"
      : "SIN EQUIPO CONFIGURADO";

  return (
    <article className={"panel mains-panel" + (own ? "" : " readonly") + (editing ? " editing" : "")}>
      <div className="mains-stage">
        <svg className="mains-graphic" viewBox="0 0 438 106" role="img" aria-label="Equipo principal 2XKO">
          <Frame x={4} y={4} size={98} src={point ? fighterIcon(point.id) : undefined} />
          <Frame x={76} y={4} size={98} src={assist ? fighterIcon(assist.id) : undefined} delay={0.06} />
          <Frame
            x={188}
            y={21}
            size={64}
            src={fuseChar ? fuseIconUrl(fuseChar.id) : undefined}
            meet
            delay={0.12}
          />
          <g className="mains-art" style={{ animationDelay: "0.18s" }}>
            <image href="/logo.png" x={266} y={27} width={76} height={52} preserveAspectRatio="xMidYMid meet" />
          </g>
          <Frame x={352} y={12} size={82} src="/logo-Hot.jpg" delay={0.24} />
        </svg>
        <p className="mains-team-label">{label}</p>
        <p className="mains-hint">{hint}</p>
      </div>

      {own ? (
        editing ? (
          <>
            <div className="mains-groups">
              <div className="mains-group">
                <small>FIGHTER 1 · POINT</small>
                <div className="mains-chips">{characterChips(char1, setChar1)}</div>
              </div>
              <div className="mains-group">
                <small>FIGHTER 2 · ASSIST</small>
                <div className="mains-chips">{characterChips(char2, setChar2)}</div>
              </div>
              <div className="mains-group">
                <small>FUSE</small>
                <div className="mains-chips">
                  {roster ? (
                    roster.fuses.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        title={f.name}
                        aria-label={f.name}
                        className={"mains-chip fuse" + (fuse === f.id ? " on" : "")}
                        onClick={() => setFuse(f.id)}
                      >
                        <img src={fuseIconUrl(f.id)} alt={f.name} />
                      </button>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mains-actions">
              <button
                type="button"
                className="mains-save"
                disabled={saving || !char1 || !char2 || !fuse}
                onClick={save}
              >
                {saving ? "GUARDANDO…" : "GUARDAR EQUIPO"}
              </button>
              <button
                type="button"
                className="mains-cancel"
                disabled={saving}
                onClick={() => {
                  resetToSaved();
                  setNotice(null);
                  setEditing(false);
                }}
              >
                CANCELAR
              </button>
              {notice && <span className={"mains-note " + (ok ? "success" : "danger")}>{notice}</span>}
            </div>
          </>
        ) : (
          <div className="mains-actions">
            <button type="button" className="mains-save" onClick={() => setEditing(true)}>
              {complete ? "CAMBIAR EQUIPO" : "CONFIGURAR EQUIPO"}
            </button>
            {notice && <span className={"mains-note " + (ok ? "success" : "danger")}>{notice}</span>}
          </div>
        )
      ) : null}
    </article>
  );
}
