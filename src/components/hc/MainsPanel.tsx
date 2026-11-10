'use client';

import { useEffect, useState } from "react";
import { fuseIconUrl, saveMains, type MeResponse } from "@/lib/auth";
import { getRoster, type RosterEntry } from "@/lib/sala";

const fighterIcon = (id: string) => "/fighters/" + encodeURIComponent(id) + ".png";

type MainChar = { id: string; name: string };

/**
 * MainsPanel: equipo principal del jugador (sus 2 personajes y su fusión),
 * con el estilo de la maqueta 2XKO.
 * - Perfil propio: vista previa en vivo + selector con los íconos del roster.
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

  const pick = (id: string, fallback?: MainChar, list?: RosterEntry[]): MainChar | undefined =>
    list?.find((c) => c.id === id) ?? (id ? fallback : undefined);

  const point = pick(char1, saved?.point, roster?.characters);
  const assist = pick(char2, saved?.assist, roster?.characters);
  const fuseChar = pick(fuse, saved?.fuse, roster?.fuses);
  const complete = !!(point && assist && fuseChar);

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

  return (
    <article className={"panel mains-panel" + (own ? "" : " readonly")}>
      <div className="mains-head">
        <div className="mains-brand">
          <strong className="mains-2xko">2XKO</strong>
          <span className="mains-logo">
            <img src="/assets/5fb79.svg" alt="Hot Coffee" />
          </span>
        </div>
        <span className="mains-sub">FIGHTER 1 / FIGHTER 2 - FUSES</span>
      </div>

      <div className="mains-team">
        <div className="mains-duo">
          {point ? (
            <img src={fighterIcon(point.id)} alt={point.name} title={point.name} />
          ) : (
            <span className="mains-slot">F1</span>
          )}
          {assist ? (
            <img src={fighterIcon(assist.id)} alt={assist.name} title={assist.name} />
          ) : (
            <span className="mains-slot">F2</span>
          )}
        </div>
        {fuseChar ? (
          <img className="mains-fuse" src={fuseIconUrl(fuseChar.id)} alt={fuseChar.name} title={fuseChar.name} />
        ) : (
          <span className="mains-slot fuse">2X</span>
        )}
      </div>
      <p className="mains-team-label">
        {complete
          ? (point!.name + " / " + assist!.name + " - " + fuseChar!.name).toUpperCase()
          : own
            ? "ELIGE TUS DOS FIGHTERS Y SU FUSE"
            : "SIN EQUIPO CONFIGURADO"}
      </p>

      {own ? (
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
            {notice && <span className={"mains-note " + (ok ? "success" : "danger")}>{notice}</span>}
          </div>
        </>
      ) : null}
    </article>
  );
}
