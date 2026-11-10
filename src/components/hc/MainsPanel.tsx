'use client';

import { useEffect, useState } from "react";
import { fuseIconUrl, saveMains, type MeResponse } from "@/lib/auth";
import { getRoster, type RosterEntry } from "@/lib/sala";

const fighterIcon = (id: string) => "/fighters/" + encodeURIComponent(id) + ".png";

/**
 * MainsPanel: equipo principal del jugador (sus 2 personajes y su fusión).
 * - Perfil propio: panel para elegir entre los íconos del roster y guardar.
 * - Perfil ajeno: vista de solo lectura del equipo configurado.
 */
export function MainsPanel({ me, own }: { me: MeResponse; own: boolean }) {
  const saved = me.mains;
  const [roster, setRoster] = useState<{ characters: RosterEntry[]; fuses: RosterEntry[] } | null>(null);
  const [char1, setChar1] = useState(saved?.point?.id ?? "");
  const [char2, setChar2] = useState(saved?.assist?.id ?? "");
  const [fuse, setFuse] = useState(saved?.fuse?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getRoster().then((r) => setRoster(r));
  }, []);

  // Perfil ajeno: solo lectura, sin controles de edición.
  if (!own) {
    const complete = !!(saved?.point?.id && saved?.assist?.id && saved?.fuse?.id);
    return (
      <article className="panel mains-panel">
        <div className="panel-heading">
          <h3>EQUIPO PRINCIPAL</h3>
          <span>{complete ? "MAINS" : "SIN CONFIGURAR"}</span>
        </div>
        {complete ? (
          <div className="mains-readonly">
            <img src={fighterIcon(saved!.point.id)} alt={saved!.point.name} title={saved!.point.name} />
            <img src={fighterIcon(saved!.assist.id)} alt={saved!.assist.name} title={saved!.assist.name} />
            <img className="fuse" src={fuseIconUrl(saved!.fuse.id)} alt={saved!.fuse.name} title={saved!.fuse.name} />
            <div>
              <strong>{saved!.point.name} + {saved!.assist.name}</strong>
              <span>🔀 {saved!.fuse.name}</span>
            </div>
          </div>
        ) : (
          <p className="hc-empty">Este jugador todavía no configuró su equipo principal.</p>
        )}
      </article>
    );
  }

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
  };

  const characterChips = (selected: string, pick: (id: string) => void) =>
    roster ? (
      roster.characters.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.name}
          aria-label={c.name}
          className={"mains-chip" + (selected === c.id ? " on" : "")}
          onClick={() => pick(c.id)}
        >
          <img src={fighterIcon(c.id)} alt={c.name} />
        </button>
      ))
    ) : (
      <span className="hc-empty">Cargando roster…</span>
    );

  return (
    <article className="panel mains-panel">
      <div className="panel-heading">
        <h3>MIS MAINS</h3>
        <span>EQUIPO PRINCIPAL</span>
      </div>
      <div className="mains-groups">
        <div className="mains-group">
          <small>PERSONAJE 1 · POINT</small>
          <div className="mains-chips">{characterChips(char1, setChar1)}</div>
        </div>
        <div className="mains-group">
          <small>PERSONAJE 2 · ASSIST</small>
          <div className="mains-chips">{characterChips(char2, setChar2)}</div>
        </div>
        <div className="mains-group">
          <small>FUSIÓN</small>
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
        {notice && <span className={"mains-note " + (ok ? "success" : "danger")}>{notice}</span>}
      </div>
    </article>
  );
}
