'use client';

import { useEffect, useState } from "react";
import { fuseIconUrl, saveMains, type MeResponse } from "@/lib/auth";
import { getRoster, type RosterEntry } from "@/lib/sala";

const fighterArt = (id: string) => "/fighters/" + encodeURIComponent(id) + ".png";

type MainChar = { id: string; name: string };

/**
 * MainsPanel: tarjeta EQUIPO PRINCIPAL con el diseño Figma
 * (fighter cards grandes con POINT/ASSIST, badge de fusión entre ambas y
 * resumen del equipo a la derecha).
 * - Perfil propio: botón EDITAR EQUIPO → modal con la grilla de fighters
 *   y la selección de fuse.
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

  // Igual que en el diseño: la selección entra como ASSIST y empuja al
  // anterior a POINT; los huecos vacíos se rellenan en orden.
  const changeCharacter = (id: string) => {
    if (id === char1 || id === char2) return;
    if (!char1) setChar1(id);
    else if (!char2) setChar2(id);
    else {
      setChar1(char2);
      setChar2(id);
    }
  };

  const resetToSaved = () => {
    setChar1(saved?.point?.id ?? "");
    setChar2(saved?.assist?.id ?? "");
    setFuse(saved?.fuse?.id ?? "");
  };

  const cancelEdit = () => {
    resetToSaved();
    setNotice(null);
    setEditing(false);
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

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) cancelEdit();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, saving]);

  return (
    <article className={"panel team-card" + (editing ? " editing" : "")}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EQUIPO PRINCIPAL</span>
          <h3>
            {complete
              ? point!.name.toUpperCase() + " / " + assist!.name.toUpperCase()
              : "SIN EQUIPO"}
          </h3>
        </div>
        {own ? (
          <button onClick={() => setEditing(true)} type="button">
            EDITAR EQUIPO
          </button>
        ) : null}
      </div>

      <div className="team-body">
        <div className="fighter-stack">
          {[point, assist].map((fighter, index) => (
            <div className="fighter-card" key={(fighter?.id ?? "vacio") + "-" + index}>
              {fighter ? <img alt={fighter.name} src={fighterArt(fighter.id)} /> : null}
              <span>{index === 0 ? "POINT" : "ASSIST"}</span>
              <strong>{fighter?.name ?? "—"}</strong>
            </div>
          ))}
          <div className="synergy">
            {fuseChar ? <img alt="" src={fuseIconUrl(fuseChar.id)} /> : null}
            <span>FUSIÓN</span>
            <strong>{fuseChar ? "ON" : "—"}</strong>
          </div>
        </div>
        <div className="team-summary">
          <span>FUSIÓN SELECCIONADA</span>
          <strong>{fuseChar?.name ?? "Sin configurar"}</strong>
          <p>
            {complete
              ? "Equipo sincronizado con el perfil y utilizado como selección rápida para tus próximos sets."
              : own
                ? "Pulsa EDITAR EQUIPO para elegir tus dos fighters y su fusión."
                : "Este jugador todavía no configuró su equipo principal."}
          </p>
          <div className="traits">
            <span>{point?.name ?? "POINT"}</span>
            <span>{assist?.name ?? "ASSIST"}</span>
          </div>
        </div>
      </div>

      {own && editing ? (
        <div
          aria-label="Editar equipo principal"
          aria-modal="true"
          className="team-modal"
          onClick={() => {
            if (!saving) cancelEdit();
          }}
          role="dialog"
        >
          <div className="team-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="team-modal-head">
              <div>
                <span className="eyebrow">EDITAR EQUIPO</span>
                <h3>ELIGE TU DÚO Y SU FUSIÓN</h3>
              </div>
              <button
                aria-label="Cerrar"
                className="team-modal-close"
                disabled={saving}
                onClick={cancelEdit}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="team-modal-body">
              <span>LUCHADORES · LA SIGUIENTE SELECCIÓN REEMPLAZA AL POINT</span>
              <div className="fighter-grid">
                {(roster?.characters ?? []).map((fighter) => (
                  <button
                    className={char1 === fighter.id || char2 === fighter.id ? "selected" : ""}
                    key={fighter.id}
                    onClick={() => changeCharacter(fighter.id)}
                    type="button"
                  >
                    <img alt="" src={fighterArt(fighter.id)} />
                    <strong>{fighter.name}</strong>
                    <small>2XKO</small>
                  </button>
                ))}
              </div>
              <span className="fuse-label">FUSIÓN</span>
              <div className="fuse-grid">
                {(roster?.fuses ?? []).map((f) => (
                  <button
                    className={"fuse-tile" + (fuse === f.id ? " selected" : "")}
                    key={f.id}
                    onClick={() => setFuse(f.id)}
                    type="button"
                  >
                    <img alt="" src={fuseIconUrl(f.id)} />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="team-modal-foot">
              <button
                className="team-save"
                disabled={saving || !char1 || !char2 || !fuse}
                onClick={save}
                type="button"
              >
                {saving ? "GUARDANDO..." : "GUARDAR EQUIPO"}
              </button>
              <button className="team-cancel" disabled={saving} onClick={cancelEdit} type="button">
                CANCELAR
              </button>
              {notice ? <span className={"team-note " + (ok ? "success" : "danger")}>{notice}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
