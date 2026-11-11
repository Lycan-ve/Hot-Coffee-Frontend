'use client';

/**
 * Hot Coffee · Sala del set (v2)
 * Componente de presentación + estado de UI. No hace fetch por su cuenta:
 * recibe el estado del set y las acciones desde la página, así se puede
 * usar igual en Next.js (datos reales) o en una demo.
 */
import {
  type CSSProperties,
  type ComponentType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { ProfileTeam } from '@/lib/auth';
import type {
  RosterEntry,
  SalaClose,
  SalaFinished,
  SalaMatch,
  SalaMessage,
  SalaPending,
  SalaPlayer,
  SalaTeam,
} from '@/lib/sala';
import './sala.css';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type Roster = { characters: RosterEntry[]; fuses: RosterEntry[] };
type ActionResult = Promise<string | null>;

export interface SalaActions {
  refresh: () => Promise<void>;
  saveTeam: (char1: string, char2: string, fuse: string) => ActionResult;
  saveRoom: (room: string) => ActionResult;
  sendChat: (content: string) => ActionResult;
  reportGame: (winner: 'me' | 'opponent') => ActionResult;
  confirmReport: () => ActionResult;
  rejectReport: () => ActionResult;
  correctLastGame: () => ActionResult;
  reportFinal: (myScore: number, oppScore: number) => ActionResult;
  closeSet: () => ActionResult;
  respondClose: (accept: boolean) => ActionResult;
}

export interface SalaAssets {
  fighterArt: (id: string) => string;
  fuseIcon: (id: string) => string;
  rankIcon: (iconPath: string) => string;
}

export type SalaLink = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

interface Notice {
  text: string;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Sala en vivo
// ---------------------------------------------------------------------------

export function SalaRoom(props: {
  match: SalaMatch;
  messages: SalaMessage[];
  roster: Roster | null;
  mains: ProfileTeam | null;
  reconnecting: boolean;
  actions: SalaActions;
  assets: SalaAssets;
  Link: SalaLink;
  backHref?: string;
}) {
  const { match, messages, roster, mains, reconnecting, actions, assets, Link } = props;
  const { me, opponent: opp, ft, pending, close } = match;

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [teamModal, setTeamModal] = useState<{ char1: string; char2: string; fuse: string } | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);

  // Los avisos se ocultan solos.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  /** Ejecuta una acción bloqueando los botones hasta que el servidor responde. */
  const run = async (fn: () => ActionResult, okText?: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    const err = await fn();
    await actions.refresh();
    setBusy(false);
    if (err) setNotice({ text: err, ok: false });
    else if (okText) setNotice({ text: okText, ok: true });
    return !err;
  };

  const history = match.roundHistory ?? [];
  const played = me.score + opp.score;
  const teamLocked = me.team.complete && played > 0;

  const status = reconnecting
    ? { label: 'RECONECTANDO', tone: 'warn' }
    : pending
      ? { label: 'POR CONFIRMAR', tone: 'warn' }
      : close
        ? { label: 'CIERRE PROPUESTO', tone: 'danger' }
        : { label: 'EN VIVO', tone: 'live' };

  const openTeam = (preset?: ProfileTeam | null) => {
    if (teamLocked) return;
    if (preset) {
      setTeamModal({ char1: preset.point.id, char2: preset.assist.id, fuse: preset.fuse.id });
      return;
    }
    const t = me.team;
    setTeamModal(t.complete ? { char1: t.char1, char2: t.char2, fuse: t.fuse } : { char1: '', char2: '', fuse: '' });
  };

  return (
    <div className="sx">
      <header className="sx-top">
        <Link href={props.backHref ?? '/matchmaking'} className="sx-back">
          ← Volver
        </Link>
        <div className="sx-title">
          <small>SET #{match.id}</small>
          <h1>Hot Coffee · Sala del set</h1>
        </div>
        <div className="sx-meta">
          <span className={`sx-pill sx-pill--${status.tone}`}>
            <i /> {status.label}
          </span>
          <span className="sx-pill">FT {ft}</span>
        </div>
      </header>

      <Scoreboard match={match} history={history} assets={assets} />

      {pending ? (
        <PendingAlert
          pending={pending}
          match={match}
          busy={busy}
          onConfirm={() => run(actions.confirmReport, 'Reporte confirmado.')}
          onReject={() => run(actions.rejectReport, 'Reporte rechazado.')}
        />
      ) : null}

      {close ? (
        <CloseAlert
          close={close}
          busy={busy}
          onAccept={() => run(() => actions.respondClose(true))}
          onReject={() => run(() => actions.respondClose(false), 'Seguimos jugando.')}
        />
      ) : null}

      <div className="sx-grid">
        <div className="sx-col">
          <TeamPanel
            team={me.team}
            locked={teamLocked}
            hasProfileTeam={!!(mains?.point && mains?.assist && mains?.fuse)}
            assets={assets}
            onEdit={() => openTeam()}
            onUseProfile={() => openTeam(mains)}
          />
          <ReportPanel
            match={match}
            busy={busy}
            hasHistory={history.length > 0}
            onWin={() => run(() => actions.reportGame('me'))}
            onLose={() => run(() => actions.reportGame('opponent'))}
            onCorrect={() => run(actions.correctLastGame)}
            onFinal={() => setFinalOpen(true)}
            onClose={() => run(actions.closeSet)}
          />
        </div>

        <aside className="sx-col sx-aside">
          <RoomCodePanel
            roomCode={match.roomCode}
            busy={busy}
            onSave={(code) => run(() => actions.saveRoom(code), 'Código de sala guardado.')}
          />
          <ChatPanel
            messages={messages}
            opponentTag={opp.tag}
            onSend={async (text) => {
              const err = await actions.sendChat(text);
              await actions.refresh();
              if (err) setNotice({ text: err, ok: false });
              return !err;
            }}
          />
        </aside>
      </div>

      {teamModal ? (
        <TeamModal
          initial={teamModal}
          roster={roster}
          mains={mains}
          serverTeam={me.team}
          assets={assets}
          onCancel={() => setTeamModal(null)}
          onSave={async (c1, c2, f) => {
            const err = await actions.saveTeam(c1, c2, f);
            if (err) return err;
            await actions.refresh();
            setTeamModal(null);
            setNotice({ text: 'Equipo confirmado.', ok: true });
            return null;
          }}
        />
      ) : null}

      {finalOpen ? (
        <FinalModal
          ft={ft}
          me={me}
          opp={opp}
          onCancel={() => setFinalOpen(false)}
          onSend={async (mine, theirs) => {
            setFinalOpen(false);
            await run(() => actions.reportFinal(mine, theirs));
          }}
        />
      ) : null}

      {notice ? (
        <div className={`sx-toast${notice.ok ? ' sx-toast--ok' : ''}`} role="status">
          <span>{notice.text}</span>
          <button aria-label="Cerrar aviso" onClick={() => setNotice(null)} type="button">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marcador
// ---------------------------------------------------------------------------

function Scoreboard({ match, history, assets }: { match: SalaMatch; history: number[]; assets: SalaAssets }) {
  const { me, opponent: opp, ft } = match;
  const mySideNum = match.mySide === 'p1' ? 1 : 2;
  const slots = Math.max(1, ft * 2 - 1);
  const played = me.score + opp.score;
  // Solo marcamos el "siguiente" game si el set se reportó game a game.
  const nextIndex = history.length === played && played < slots ? played : -1;

  return (
    <section className="sx-board" aria-label="Marcador del set">
      <PlayerSide player={me} side="me" ft={ft} assets={assets} />

      <div className="sx-center">
        <div className="sx-score" aria-label={`${me.score} a ${opp.score}`}>
          <b className="is-me">
            <span className="sx-pop" key={'m' + me.score}>
              {me.score}
            </span>
          </b>
          <i className="sx-score-vs">VS</i>
          <b className="is-opp">
            <span className="sx-pop" key={'o' + opp.score}>
              {opp.score}
            </span>
          </b>
        </div>
        <span className="sx-ft">PRIMERO A {ft}</span>
        <span className="sx-stake">+{match.pointsAtStake} PTS EN JUEGO</span>
      </div>

      <PlayerSide player={opp} side="opp" ft={ft} assets={assets} />

      <div className="sx-timeline">
        <span>GAMES</span>
        <ol>
          {Array.from({ length: slots }, (_, i) => {
            const w = history[i];
            const kind = w === undefined ? (i === nextIndex ? 'next' : 'empty') : w === mySideNum ? 'me' : 'opp';
            const title =
              kind === 'me' ? 'Game ' + (i + 1) + ': ganaste' : kind === 'opp' ? 'Game ' + (i + 1) + ': ganó ' + opp.tag : 'Game ' + (i + 1);
            return (
              <li className={`sx-game sx-game--${kind}`} key={i} title={title}>
                G{i + 1}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function PlayerSide({ player, side, ft, assets }: { player: SalaPlayer; side: 'me' | 'opp'; ft: number; assets: SalaAssets }) {
  const art = player.team.complete && player.team.char1 ? assets.fighterArt(player.team.char1) : null;
  return (
    <div className={`sx-side sx-side--${side}`}>
      {art ? <img alt="" aria-hidden="true" className="sx-side-art" src={art} /> : null}
      <div className="sx-side-body">
        {player.avatarUrl ? (
          <img alt={player.tag} className="sx-avatar" src={player.avatarUrl} />
        ) : (
          <span className="sx-avatar" aria-hidden="true">
            ☕
          </span>
        )}
        <div className="sx-side-info">
          <span className="sx-side-label">{side === 'me' ? 'TÚ' : 'RIVAL'}</span>
          <strong className="sx-side-name" title={player.tag}>
            {player.tag}
          </strong>
          <span className="sx-side-rank">
            {player.rank?.iconPath ? (
              <img
                alt=""
                src={assets.rankIcon(player.rank.iconPath)}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            {player.rank?.displayName ? <b>{player.rank.displayName}</b> : null}
            <span>{player.points} pts</span>
          </span>
          <TeamChips team={player.team} />
        </div>
      </div>
      <div className="sx-pips" aria-label={`${player.score} de ${ft} games`}>
        {Array.from({ length: ft }, (_, i) => (
          <span className={'sx-pip' + (i < player.score ? ' is-on' : '')} key={i} />
        ))}
      </div>
    </div>
  );
}

function TeamChips({ team }: { team: SalaTeam }) {
  if (!team.complete) {
    return (
      <div className="sx-chips">
        <span className="sx-chip sx-chip--empty">Equipo sin confirmar…</span>
      </div>
    );
  }
  return (
    <div className="sx-chips">
      <span className="sx-chip">{team.char1Name}</span>
      <span className="sx-chip">{team.char2Name}</span>
      <span className="sx-chip sx-chip--fuse">{team.fuseName}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

function Waiting() {
  return (
    <span className="sx-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function PendingAlert(props: {
  pending: SalaPending;
  match: SalaMatch;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const { pending, match, busy } = props;
  const finalTxt = (pending.finalMine ?? 0) + ' - ' + (pending.finalOpp ?? 0);

  if (pending.byMe) {
    const what =
      pending.kind === 'game'
        ? pending.winnerSide === match.mySide
          ? 'Reportaste que ganaste el game.'
          : 'Reportaste que ganó ' + match.opponent.tag + '.'
        : pending.kind === 'final'
          ? 'Propusiste el resultado final ' + finalTxt + '.'
          : 'Propusiste deshacer el último game.';
    return (
      <section className="sx-alert" role="status">
        <div className="sx-alert-text">
          <span className="sx-alert-icon">⏳</span>
          <div>
            <strong>
              Esperando a {match.opponent.tag}
              <Waiting />
            </strong>
            <p>{what} Tu rival tiene que confirmarlo.</p>
          </div>
        </div>
      </section>
    );
  }

  const iWon = pending.winnerSide === match.mySide;
  const title =
    pending.kind === 'game'
      ? iWon
        ? pending.proposerTag + ' dice que GANASTE el game'
        : pending.proposerTag + ' dice que ganó el game'
      : pending.kind === 'final'
        ? pending.proposerTag + ' propone el resultado final'
        : pending.proposerTag + ' quiere deshacer el último game';
  const detail =
    pending.kind === 'final'
      ? 'Marcador propuesto: ' + finalTxt + ' (tú - rival). ¿Es correcto?'
      : pending.kind === 'correct'
        ? 'El marcador volvería al game anterior. ¿Estás de acuerdo?'
        : '¿Es correcto? Si confirmas, el marcador se actualiza.';

  return (
    <section className="sx-alert" role="alert">
      <div className="sx-alert-text">
        <span className="sx-alert-icon">{pending.kind === 'game' ? (iWon ? '🏆' : '💀') : pending.kind === 'final' ? '🏁' : '↩️'}</span>
        <div>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
      </div>
      <div className="sx-alert-actions">
        <button className="sx-btn sx-btn--success" disabled={busy} onClick={props.onConfirm} type="button">
          ✓ Confirmar
        </button>
        <button className="sx-btn sx-btn--ghost" disabled={busy} onClick={props.onReject} type="button">
          ✗ Rechazar
        </button>
      </div>
    </section>
  );
}

function CloseAlert(props: { close: SalaClose; busy: boolean; onAccept: () => void; onReject: () => void }) {
  const { close, busy } = props;
  const outcome = close.tie ? 'Empate: el set se cancela sin puntos.' : 'Gana ' + close.leader + ' con los puntos completos.';

  if (close.byMe) {
    return (
      <section className="sx-alert sx-alert--danger" role="status">
        <div className="sx-alert-text">
          <span className="sx-alert-icon">🏳️</span>
          <div>
            <strong>
              Cierre propuesto
              <Waiting />
            </strong>
            <p>Si tu rival no responde en 2 minutos: {outcome}</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="sx-alert sx-alert--danger" role="alert">
      <div className="sx-alert-text">
        <span className="sx-alert-icon">🏳️</span>
        <div>
          <strong>{close.requestedBy} propone cerrar el set</strong>
          <p>{outcome}</p>
        </div>
      </div>
      <div className="sx-alert-actions">
        <button className="sx-btn sx-btn--danger" disabled={busy} onClick={props.onAccept} type="button">
          Aceptar cierre
        </button>
        <button className="sx-btn sx-btn--ghost" disabled={busy} onClick={props.onReject} type="button">
          Seguir jugando
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------

function TeamPanel(props: {
  team: SalaTeam;
  locked: boolean;
  hasProfileTeam: boolean;
  assets: SalaAssets;
  onEdit: () => void;
  onUseProfile: () => void;
}) {
  const { team, locked, assets } = props;
  const slots = [
    { role: 'POINT', id: team.char1, name: team.char1Name },
    { role: 'ASSIST', id: team.char2, name: team.char2Name },
  ];
  return (
    <section className="sx-panel">
      <div className="sx-panel-head">
        <h2>
          Tu equipo
          {locked ? (
            <span className="sx-tag sx-tag--lock">🔒 SELLADO</span>
          ) : team.complete ? (
            <span className="sx-tag sx-tag--ok">✓ CONFIRMADO</span>
          ) : (
            <span className="sx-tag sx-tag--todo">SIN CONFIRMAR</span>
          )}
        </h2>
        {team.complete && !locked ? (
          <button className="sx-btn sx-btn--sm sx-btn--outline-orange" onClick={props.onEdit} type="button">
            Cambiar
          </button>
        ) : null}
      </div>
      <div className="sx-panel-body">
        <div className="sx-team">
          {slots.map((s) =>
            team.complete && s.id ? (
              <button className="sx-fighter" disabled={locked} key={s.role} onClick={props.onEdit} type="button">
                <img alt={s.name} src={assets.fighterArt(s.id)} />
                <span>{s.role}</span>
                <strong>{s.name}</strong>
              </button>
            ) : (
              <button className="sx-fighter sx-fighter--empty" key={s.role} onClick={props.onEdit} type="button">
                <b>＋</b>
                <span>{s.role}</span>
                <strong>Elegir</strong>
              </button>
            ),
          )}
          <button className="sx-fuse" disabled={locked} onClick={props.onEdit} type="button">
            {team.complete && team.fuse ? <img alt="" src={assets.fuseIcon(team.fuse)} /> : null}
            <span>FUSIÓN</span>
            <strong>{team.complete ? team.fuseName : '—'}</strong>
          </button>
        </div>

        {!team.complete ? (
          <div className="sx-team-foot">
            <button className="sx-btn sx-btn--primary" onClick={props.onEdit} type="button">
              Elegir equipo
            </button>
            {props.hasProfileTeam ? (
              <button className="sx-btn sx-btn--ghost" onClick={props.onUseProfile} type="button">
                ⟳ Usar el de mi perfil
              </button>
            ) : null}
            <span className="sx-hint">Confírmalo antes del primer game.</span>
          </div>
        ) : locked ? (
          <p className="sx-hint" style={{ marginTop: 12 }}>
            Ya hay games jugados: el equipo quedó sellado para este set.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function useModalBehavior(onClose: () => void, disabled = false) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disabled) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [disabled]);
}

function TeamModal(props: {
  initial: { char1: string; char2: string; fuse: string };
  roster: Roster | null;
  mains: ProfileTeam | null;
  serverTeam: SalaTeam;
  assets: SalaAssets;
  onCancel: () => void;
  onSave: (char1: string, char2: string, fuse: string) => Promise<string | null>;
}) {
  const { roster, mains, assets } = props;
  const [char1, setChar1] = useState(props.initial.char1);
  const [char2, setChar2] = useState(props.initial.char2);
  const [fuse, setFuse] = useState(props.initial.fuse);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Notice | null>(null);
  useModalBehavior(props.onCancel, saving);

  const characters = roster?.characters ?? [];
  const fuses = roster?.fuses ?? [];
  const nameOf = (id: string, list: RosterEntry[]) => list.find((c) => c.id === id)?.name ?? id;

  // La selección entra como ASSIST y empuja al anterior a POINT.
  // Tocar un luchador ya elegido lo quita.
  const toggleCharacter = (id: string) => {
    if (id === char1) {
      setChar1(char2);
      setChar2('');
    } else if (id === char2) {
      setChar2('');
    } else if (!char1) setChar1(id);
    else if (!char2) setChar2(id);
    else {
      setChar1(char2);
      setChar2(id);
    }
  };

  const useProfile = () => {
    if (!mains?.point || !mains?.assist || !mains?.fuse) {
      setNote({ text: 'Primero configura tu equipo principal en tu perfil.', ok: false });
      return;
    }
    setChar1(mains.point.id);
    setChar2(mains.assist.id);
    setFuse(mains.fuse.id);
    setNote({ text: 'Equipo del perfil cargado. Confírmalo para sellarlo.', ok: true });
  };

  const save = async () => {
    if (!char1 || !char2 || !fuse || saving) return;
    setSaving(true);
    setNote(null);
    const err = await props.onSave(char1, char2, fuse);
    setSaving(false);
    if (err) setNote({ text: err, ok: false });
  };

  const ready = !!(char1 && char2 && fuse);

  return createPortal(
    <div aria-label="Elegir equipo del set" aria-modal="true" className="sx-modal" onClick={() => !saving && props.onCancel()} role="dialog">
      <div className="sx-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sx-modal-head">
          <div>
            <small>TU EQUIPO PARA ESTE SET</small>
            <h3>Elige tu dúo y su fusión</h3>
          </div>
          <button aria-label="Cerrar" className="sx-modal-close" disabled={saving} onClick={props.onCancel} type="button">
            ✕
          </button>
        </div>

        <div className="sx-modal-body">
          <div className="sx-modal-label">
            <span>LUCHADORES</span>
            <em>
              POINT: {char1 ? nameOf(char1, characters) : '—'} · ASSIST: {char2 ? nameOf(char2, characters) : '—'}
            </em>
          </div>
          {characters.length === 0 ? <p className="sx-hint">Cargando luchadores…</p> : null}
          <div className="sx-pick">
            {characters.map((f) => {
              const role = f.id === char1 ? 'POINT' : f.id === char2 ? 'ASSIST' : null;
              return (
                <button className={'sx-pick-item' + (role ? ' is-on' : '')} key={f.id} onClick={() => toggleCharacter(f.id)} type="button">
                  <img alt="" loading="lazy" src={assets.fighterArt(f.id)} />
                  {role ? <span className="sx-pick-badge">{role}</span> : null}
                  <strong>{f.name}</strong>
                </button>
              );
            })}
          </div>

          <div className="sx-modal-label">
            <span>FUSIÓN</span>
            <em>{fuse ? nameOf(fuse, fuses) : '—'}</em>
          </div>
          <div className="sx-fuses">
            {fuses.map((f) => (
              <button className={'sx-fuse-item' + (fuse === f.id ? ' is-on' : '')} key={f.id} onClick={() => setFuse(f.id)} type="button">
                <img alt="" src={assets.fuseIcon(f.id)} />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sx-modal-foot">
          <button className="sx-btn sx-btn--success sx-btn--lg" disabled={saving || !ready} onClick={save} type="button">
            {saving ? 'Guardando…' : 'Confirmar equipo'}
          </button>
          <button className="sx-btn sx-btn--ghost" disabled={saving} onClick={useProfile} type="button">
            Usar el de mi perfil
          </button>
          <span className="sx-spacer" />
          <button className="sx-btn sx-btn--ghost" disabled={saving} onClick={props.onCancel} type="button">
            Cancelar
          </button>
          {note ? <span className={'sx-modal-note ' + (note.ok ? 'is-ok' : 'is-bad')}>{note.text}</span> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Reporte de games
// ---------------------------------------------------------------------------

function ReportPanel(props: {
  match: SalaMatch;
  busy: boolean;
  hasHistory: boolean;
  onWin: () => void;
  onLose: () => void;
  onCorrect: () => void;
  onFinal: () => void;
  onClose: () => void;
}) {
  const { match, busy } = props;
  const { me, opponent: opp } = match;
  const blocked = busy || !!match.pending;
  const gameNo = me.score + opp.score + 1;

  // "Cerrar set" pide un segundo toque para evitar errores.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <section className="sx-panel">
      <div className="sx-panel-head">
        <h2>
          Reportar game {gameNo}
          <small>{match.pending ? 'ESPERANDO CONFIRMACIÓN' : '¿QUIÉN GANÓ?'}</small>
        </h2>
      </div>
      <div className="sx-panel-body">
        <div className="sx-report">
          <button className="sx-win" disabled={blocked} onClick={props.onWin} type="button">
            <em>🏆</em>
            <strong>Gané yo</strong>
            <small>
              Tu marcador pasa a {me.score + 1} - {opp.score}
            </small>
          </button>
          <button className="sx-win sx-win--opp" disabled={blocked} onClick={props.onLose} type="button">
            <em>💀</em>
            <strong>Ganó {opp.tag}</strong>
            <small>
              Tu marcador pasa a {me.score} - {opp.score + 1}
            </small>
          </button>
        </div>
        <div className="sx-more">
          <button className="sx-btn sx-btn--sm sx-btn--ghost" disabled={blocked || !props.hasHistory} onClick={props.onCorrect} type="button">
            ↩ Corregir último
          </button>
          <button className="sx-btn sx-btn--sm sx-btn--ghost" disabled={blocked} onClick={props.onFinal} type="button">
            🏁 Resultado final
          </button>
          <span className="sx-spacer" />
          <button
            className={'sx-btn sx-btn--sm sx-btn--outline-danger' + (armed ? ' is-armed' : '')}
            disabled={busy || !!match.close}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              props.onClose();
            }}
            type="button"
          >
            {armed ? '¿Seguro? Toca otra vez' : '🏳 Cerrar set'}
          </button>
        </div>
      </div>
    </section>
  );
}

function FinalModal(props: {
  ft: number;
  me: SalaPlayer;
  opp: SalaPlayer;
  onCancel: () => void;
  onSend: (mine: number, theirs: number) => void;
}) {
  const { ft, me, opp } = props;
  const [mine, setMine] = useState(me.score);
  const [theirs, setTheirs] = useState(opp.score);
  useModalBehavior(props.onCancel);

  // Exactamente uno de los dos llega a FT.
  const valid = (mine === ft) !== (theirs === ft) && mine <= ft && theirs <= ft;
  const clamp = (n: number) => Math.min(ft, Math.max(0, n));

  const stepper = (label: string, value: number, set: (n: number) => void, tone: 'me' | 'opp') => (
    <div className={'sx-stepper' + (tone === 'opp' ? ' sx-stepper--opp' : '')}>
      <span>{label}</span>
      <div className="sx-stepper-ctrl">
        <button aria-label={'Restar a ' + label} disabled={value <= 0} onClick={() => set(clamp(value - 1))} type="button">
          −
        </button>
        <strong>{value}</strong>
        <button aria-label={'Sumar a ' + label} disabled={value >= ft} onClick={() => set(clamp(value + 1))} type="button">
          +
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div aria-label="Resultado final" aria-modal="true" className="sx-modal" onClick={props.onCancel} role="dialog">
      <div className="sx-modal-panel sx-modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="sx-modal-head">
          <div>
            <small>REPORTE DIRECTO · FT {ft}</small>
            <h3>Resultado final</h3>
          </div>
          <button aria-label="Cerrar" className="sx-modal-close" onClick={props.onCancel} type="button">
            ✕
          </button>
        </div>
        <div className="sx-modal-body">
          <div className="sx-final">
            {stepper('Tú', mine, setMine, 'me')}
            <span>-</span>
            {stepper(opp.tag, theirs, setTheirs, 'opp')}
          </div>
          <p className={'sx-hint' + (valid ? '' : ' is-bad')}>
            {valid
              ? 'Tu rival tendrá que confirmar este marcador.'
              : 'Uno de los dos tiene que llegar exactamente a ' + ft + '.'}
          </p>
        </div>
        <div className="sx-modal-foot">
          <button className="sx-btn sx-btn--success sx-btn--lg" disabled={!valid} onClick={() => props.onSend(mine, theirs)} type="button">
            Enviar resultado
          </button>
          <span className="sx-spacer" />
          <button className="sx-btn sx-btn--ghost" onClick={props.onCancel} type="button">
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Código de sala
// ---------------------------------------------------------------------------

function RoomCodePanel(props: { roomCode: string; busy: boolean; onSave: (code: string) => Promise<boolean> }) {
  const { roomCode, busy } = props;
  const [editing, setEditing] = useState(!roomCode);
  const [draft, setDraft] = useState(roomCode);
  const [copied, setCopied] = useState(false);

  // Si el rival guarda/cambia el código, se refleja aquí.
  const [prevCode, setPrevCode] = useState(roomCode);
  if (prevCode !== roomCode) {
    setPrevCode(roomCode);
    setDraft(roomCode);
    setEditing(!roomCode);
  }

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      /* el navegador bloqueó el portapapeles */
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = draft.trim();
    if (!code || code === roomCode) return;
    const ok = await props.onSave(code);
    if (ok) setEditing(false);
  };

  return (
    <section className="sx-panel">
      <div className="sx-panel-head">
        <h2>Código de sala</h2>
        {roomCode && !editing ? (
          <button className="sx-btn sx-btn--sm sx-btn--ghost" onClick={() => setEditing(true)} type="button">
            Editar
          </button>
        ) : null}
      </div>
      <div className="sx-panel-body" style={{ display: 'grid', gap: 10 }}>
        {roomCode && !editing ? (
          <div className="sx-code">
            <strong>{roomCode}</strong>
            <button className={'sx-btn sx-btn--sm ' + (copied ? 'sx-btn--success' : 'sx-btn--primary')} onClick={copy} type="button">
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        ) : (
          <form className="sx-row" onSubmit={submit}>
            <input
              aria-label="Código de sala de 2XKO"
              autoComplete="off"
              className="sx-input"
              maxLength={32}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Pega el código de 2XKO"
              value={draft}
            />
            <button className="sx-btn sx-btn--primary" disabled={busy || !draft.trim() || draft.trim() === roomCode} type="submit">
              Guardar
            </button>
          </form>
        )}
        <p className="sx-hint">
          {roomCode ? 'Entra a esta sala en 2XKO para jugar el set.' : 'Quien cree la sala en 2XKO pega aquí el código para su rival.'}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function ChatPanel(props: { messages: SalaMessage[]; opponentTag: string; onSend: (text: string) => Promise<boolean> }) {
  const { messages } = props;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  // Solo baja automáticamente si ya estabas al final (no te mueve si lees arriba).
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    stickRef.current = true;
    const ok = await props.onSend(text);
    if (!ok) setDraft(text); // no se pierde lo escrito si falla
    setSending(false);
  };

  return (
    <section className="sx-panel sx-chat">
      <div className="sx-panel-head">
        <h2>
          Chat del set <small>CON {props.opponentTag.toUpperCase()}</small>
        </h2>
      </div>
      <div className="sx-chat-list" onScroll={onScroll} ref={listRef}>
        {messages.length === 0 ? (
          <div className="sx-chat-empty">
            <span>☕</span>
            Sin mensajes todavía. Saluda a tu rival.
          </div>
        ) : (
          messages.map((m) => (
            <div className={'sx-msg ' + (m.mine ? 'sx-msg--mine' : 'sx-msg--theirs')} key={m.id}>
              <span className="sx-msg-meta">
                {!m.mine ? <b>{m.senderTag}</b> : null}
                {formatTime(m.createdAt)}
              </span>
              <div className="sx-msg-bubble">{m.content}</div>
            </div>
          ))
        )}
      </div>
      <form className="sx-chat-form" onSubmit={submit}>
        <input
          aria-label="Mensaje"
          className="sx-input"
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un mensaje…"
          value={draft}
        />
        <button className="sx-btn sx-btn--primary" disabled={!draft.trim() || sending} type="submit">
          Enviar
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pantallas fuera de la sala (login, vacío, error, final)
// ---------------------------------------------------------------------------

export function SalaScreen(props: { icon?: ReactNode; title: ReactNode; titleClass?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <main className="sx sx-screen">
      <div className="sx-screen-card">
        {props.icon ? <div className="sx-screen-icon">{props.icon}</div> : null}
        <h1 className={props.titleClass}>{props.title}</h1>
        {props.children}
        {props.actions ? <div className="sx-screen-actions">{props.actions}</div> : null}
      </div>
    </main>
  );
}

export function SalaLoading({ label = 'Cargando la sala…' }: { label?: string }) {
  return (
    <main className="sx sx-screen">
      <div className="sx-screen-card">
        <div className="sx-loader" />
        <p>{label}</p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Barra de LP animada al terminar el set
// Misma escalera que ranks.FromPoints del backend: cada 100 pts totales es
// una división; Iron I = 100, Gold I = 1.000, Grandmaster = 2.500.
// ---------------------------------------------------------------------------

const LP_PER_DIVISION = 100;
const RP_INDEX = 24;
const LADDER: [string, string][] = [
  ['Iron', 'I'], ['Iron', 'II'], ['Iron', 'III'],
  ['Bronze', 'I'], ['Bronze', 'II'], ['Bronze', 'III'],
  ['Silver', 'I'], ['Silver', 'II'], ['Silver', 'III'],
  ['Gold', 'I'], ['Gold', 'II'], ['Gold', 'III'],
  ['Platinum', 'I'], ['Platinum', 'II'], ['Platinum', 'III'],
  ['Emerald', 'I'], ['Emerald', 'II'], ['Emerald', 'III'],
  ['Diamond', 'I'], ['Diamond', 'II'], ['Diamond', 'III'],
  ['Master', 'I'], ['Master', 'II'], ['Master', 'III'],
  ['Grandmaster', ''],
  ['Challenger', ''],
];
const TIER_NUM: Record<string, number> = { I: 1, II: 2, III: 3 };
/** Mismos colores que ranks.Colors del backend (overlays). */
const TIER_COLOR: Record<string, string> = {
  Iron: '#c8c8c8', Bronze: '#e8a065', Silver: '#c0d5cc', Gold: '#f5d060', Platinum: '#78d8f0',
  Emerald: '#60e090', Diamond: '#90b8ff', Master: '#d080f8', Grandmaster: '#f07070', Challenger: '#ffe787',
};

export interface LadderRank {
  index: number;
  /** Rango sin división: "Gold", "Platinum"… */
  tier: string;
  displayName: string;
  /** Nombre de archivo del ícono (sin carpeta), igual que el backend. */
  iconFile: string;
  isRp: boolean;
  /** LP dentro de la división (0-100). En GM/Challenger siempre 100. */
  lp: number;
}

/** Rango para un total de puntos (base + ganados), como ranks.FromPoints. */
export function ladderRank(total: number): LadderRank {
  const index = Math.min(LADDER.length - 1, Math.max(0, Math.floor(total / LP_PER_DIVISION) - 1));
  const [rank, tier] = LADDER[index] ?? ['Iron', 'I'];
  const isRp = index >= RP_INDEX;
  const lp = isRp ? 100 : Math.min(100, Math.max(0, total - (index + 1) * LP_PER_DIVISION));
  return {
    index,
    tier: rank,
    displayName: tier ? rank + ' ' + tier : rank,
    iconFile: tier ? rank + '_tier_' + TIER_NUM[tier] + '_icon.png' : rank + '_icon.png',
    isRp,
    lp,
  };
}

/** Puntos por los que pasa la barra: al cruzar una división se llena/vacía y salta. */
function lpWaypoints(from: number, to: number): { to: number; jump: boolean }[] {
  const steps: { to: number; jump: boolean }[] = [];
  const top = LADDER.length * LP_PER_DIVISION; // Challenger: ya no hay más divisiones
  if (to > from) {
    for (let b = (Math.floor(from / LP_PER_DIVISION) + 1) * LP_PER_DIVISION; b <= to && b <= top; b += LP_PER_DIVISION) {
      if (b <= LP_PER_DIVISION) continue;
      steps.push({ to: b - 0.001, jump: false }, { to: b, jump: true });
    }
  } else if (to < from) {
    for (let b = Math.floor(from / LP_PER_DIVISION) * LP_PER_DIVISION; b > to && b > LP_PER_DIVISION; b -= LP_PER_DIVISION) {
      if (b > top) continue;
      steps.push({ to: b, jump: false }, { to: b - 0.001, jump: true });
    }
  }
  steps.push({ to, jump: false });
  return steps;
}

/** Ascensos de rango completo (Gold → Platinum) entre dos totales; no cuenta divisiones. */
export function tierUpsBetween(from: number, to: number): { from: LadderRank; to: LadderRank }[] {
  const ups: { from: LadderRank; to: LadderRank }[] = [];
  const top = LADDER.length * LP_PER_DIVISION;
  for (let b = (Math.floor(from / LP_PER_DIVISION) + 1) * LP_PER_DIVISION; b <= to && b <= top; b += LP_PER_DIVISION) {
    if (b <= LP_PER_DIVISION) continue;
    const prev = ladderRank(b - 1);
    const next = ladderRank(b);
    if (prev.tier !== next.tier) ups.push({ from: prev, to: next });
  }
  return ups;
}

type TierUp = { from: LadderRank; to: LadderRank };

function useLpTimeline(from: number, to: number) {
  const [value, setValue] = useState(from);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [tierUp, setTierUp] = useState<TierUp | null>(null);
  const tierUpDone = useRef<(() => void) | null>(null);
  const endTierUp = () => {
    setTierUp(null);
    const res = tierUpDone.current;
    tierUpDone.current = null;
    res?.();
  };

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const wait = (ms: number) => new Promise<void>((res) => { timer = setTimeout(res, ms); });
    const tween = (a: number, b: number) =>
      new Promise<void>((res) => {
        const ms = Math.min(2000, Math.max(900, Math.abs(b - a) * 60));
        const t0 = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const k = Math.min(1, (now - t0) / ms);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          setValue(a + (b - a) * e);
          if (k < 1) raf = requestAnimationFrame(tick);
          else res();
        };
        raf = requestAnimationFrame(tick);
      });

    (async () => {
      if (reduce || from === to) {
        await wait(0);
        if (cancelled) return;
        setValue(to);
        if (ladderRank(from).index !== ladderRank(to).index) {
          setFlash(to > from ? 'up' : 'down');
          sfxFlash(to > from);
        }
        setTierUp(tierUpsBetween(from, to).at(-1) ?? null);
        setDone(true);
        return;
      }
      await wait(750);
      let cur = from;
      for (const step of lpWaypoints(from, to)) {
        if (cancelled) return;
        if (step.jump) {
          await wait(380);
          if (cancelled) return;
          // Cambio de rango completo: la ceremonia tapa la pantalla y la barra espera.
          const up = to > from ? tierUpsBetween(step.to - 1, step.to)[0] : undefined;
          if (up) {
            await new Promise<void>((res) => {
              tierUpDone.current = res;
              setTierUp(up);
            });
            if (cancelled) return;
          }
          setValue(step.to);
          setFlash(to > from ? 'up' : 'down');
          sfxFlash(to > from);
          await wait(650);
        } else {
          await tween(cur, step.to);
        }
        cur = step.to;
      }
      if (!cancelled) {
        setValue(to);
        setDone(true);
      }
    })();

    return () => {
      cancelled = true;
      tierUpDone.current = null;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [from, to]);

  return { value, done, flash, tierUp, endTierUp };
}

// ---------------------------------------------------------------------------
// Ceremonia de ascenso de rango: carga, estallido y revelación.
// Cada rango tiene su propia animación y es más potente que la anterior
// (Bronze = nivel 1 … Challenger = nivel 9): más tiempo de carga, más
// partículas, más temblor y efectos propios de cada rango.
// ---------------------------------------------------------------------------

type TierFx =
  | 'fountain' // Bronze: chispas de forja que saltan y caen
  | 'slash' // Silver: dos cortes de espada en X
  | 'sheen' // destello metálico que recorre el ícono
  | 'coins' // Gold: lluvia de monedas
  | 'frost' // Platinum: púas de cristal y hexágonos de escarcha
  | 'vortex' // Emerald: remolino de energía que orbita el ícono
  | 'pillar' // columna de luz vertical
  | 'prism' // Diamond: rayos de arcoíris y chispas en forma de faceta
  | 'beams' // reflectores que barren la pantalla
  | 'runes' // Master: círculo mágico girando
  | 'bolts' // rayos eléctricos
  | 'cracks' // Grandmaster: la pantalla se agrieta
  | 'flames' // Grandmaster: llamas desde abajo
  | 'blackout' // Challenger: apagón y latidos antes del estallido
  | 'strike' // Challenger: rayo que cae del cielo
  | 'stars' // Challenger: cielo estrellado y estrellas fugaces
  | 'crown'; // Challenger: corona que cae sobre el ícono

interface TierStyle {
  /** 1 (Bronze) … 9 (Challenger): controla tiempos, partículas y temblor. */
  lvl: number;
  kicker: string;
  motto: string;
  fx: TierFx[];
}

export const TIER_FX: Record<string, TierStyle> = {
  Bronze: { lvl: 1, kicker: '▲ ¡Nuevo rango!', motto: 'Forjado en combate', fx: ['fountain'] },
  Silver: { lvl: 2, kicker: '▲ ¡Nuevo rango!', motto: 'Filo de acero', fx: ['slash', 'sheen'] },
  Gold: { lvl: 3, kicker: '▲▲ ¡Nuevo rango!', motto: 'Ahora brillas como el oro', fx: ['coins', 'sheen', 'fountain'] },
  Platinum: { lvl: 4, kicker: '▲▲ ¡Nuevo rango!', motto: 'Frío, preciso, imparable', fx: ['frost', 'sheen', 'slash'] },
  Emerald: { lvl: 5, kicker: '▲▲▲ ¡Nuevo rango!', motto: 'Energía pura', fx: ['vortex', 'pillar', 'sheen'] },
  Diamond: { lvl: 6, kicker: '▲▲▲ ¡Nuevo rango!', motto: 'Irrompible', fx: ['prism', 'beams', 'sheen', 'frost'] },
  Master: { lvl: 7, kicker: '◆ ¡Maestría alcanzada! ◆', motto: 'Dominas el arte del combate', fx: ['runes', 'bolts', 'pillar', 'vortex'] },
  Grandmaster: { lvl: 8, kicker: '◆◆ ¡Gran Maestro! ◆◆', motto: 'Leyenda en llamas', fx: ['cracks', 'flames', 'bolts', 'pillar', 'runes'] },
  Challenger: {
    lvl: 9,
    kicker: '★ ¡La cima de Hot Coffee! ★',
    motto: 'Solo los mejores llegan aquí',
    fx: ['blackout', 'strike', 'stars', 'crown', 'runes', 'cracks', 'bolts', 'beams', 'prism', 'pillar', 'coins', 'sheen'],
  },
};
const DEFAULT_FX: TierStyle = { lvl: 1, kicker: '▲ ¡Nuevo rango!', motto: '', fx: [] };

/** Tiempos de cada fase según el nivel (ms). */
export function tuTiming(lvl: number) {
  return {
    charge: lvl >= 9 ? 3200 : 1000 + lvl * 170,
    burst: 450 + lvl * 55,
    close: 8000 + lvl * 500,
  };
}

const px = (n: number) => Math.round(n) + 'px';
const polar = (deg: number, r: number) => ({ x: Math.cos((deg * Math.PI) / 180) * r, y: Math.sin((deg * Math.PI) / 180) * r });
const pct = (n: number) => ((n % 100) + 100) % 100 + '%';

// Valores fijos (no aleatorios) para que la animación sea igual siempre.
function makeShards(n: number, reach: number) {
  return Array.from({ length: n }, (_, i) => {
    const a0 = (i * 360) / n - 90;
    const a1 = ((i + 1) * 360) / n - 90;
    const mid = (a0 + a1) / 2;
    const pt = (deg: number) => {
      const p = polar(deg, 80);
      return (50 + p.x).toFixed(1) + '% ' + (50 + p.y).toFixed(1) + '%';
    };
    const out = polar(mid, reach + (i % 3) * 50);
    return {
      clip: 'polygon(50% 50%, ' + pt(a0) + ', ' + pt(mid) + ', ' + pt(a1) + ')',
      style: { '--dx': px(out.x), '--dy': px(out.y), '--rot': (i % 2 ? 1 : -1) * (35 + i * 17) + 'deg' } as CSSProperties,
    };
  });
}

function buildFx(lvl: number) {
  const reach = 130 + lvl * 26;
  return {
    shards: makeShards(4 + lvl, 200 + lvl * 15),
    sparks: Array.from({ length: 8 + lvl * 6 }, (_, i) => {
      const p = polar(i * 137.5, reach * (0.5 + ((i * 53) % 100) / 160));
      return { '--dx': px(p.x), '--dy': px(p.y), '--sz': 3 + (i % 4) * 2 + 'px', '--dl': (i % 6) * 35 + 'ms' } as CSSProperties;
    }),
    motes: Array.from({ length: 8 + lvl * 2 }, (_, i) => {
      const p = polar(i * 25.7 + 8, 170 + (i % 3) * 40 + lvl * 6);
      return { '--dx': px(p.x), '--dy': px(p.y), '--dl': ((i * 90) % 700) + 'ms' } as CSSProperties;
    }),
    rings: Math.min(6, 1 + Math.ceil(lvl / 2)),
    embers: Array.from({ length: 6 + lvl * 4 }, (_, i) => ({
      '--x': pct(i * 61), '--dl': ((i * 370) % 3000) + 'ms', '--du': 3200 + ((i * 410) % 2400) + 'ms', '--sz': 2 + (i % 3) * 2 + 'px',
    }) as CSSProperties),
  };
}

const FOUNTAIN = Array.from({ length: 18 }, (_, i) => ({
  '--dx': px(((i * 47) % 260) - 130), '--dy': px(-110 - ((i * 71) % 170)), '--sz': 3 + (i % 3) * 2 + 'px', '--dl': (i % 5) * 40 + 'ms',
}) as CSSProperties);
const COINS = Array.from({ length: 26 }, (_, i) => ({
  '--x': pct(i * 37 + 5), '--dl': ((i * 290) % 2600) + 'ms', '--du': 1800 + ((i * 330) % 1600) + 'ms', '--sz': 10 + (i % 4) * 4 + 'px', '--sp': 500 + (i % 4) * 180 + 'ms',
}) as CSSProperties);
const SPIKES = Array.from({ length: 12 }, (_, i) => ({ '--a': i * 30 + 'deg', '--h': 0.32 + (i % 3) * 0.1, '--dl': (i % 4) * 40 + 'ms' }) as CSSProperties);
const ORBS = Array.from({ length: 22 }, (_, i) => ({
  '--a': i * 47 + 'deg', '--r': px(95 + ((i * 29) % 80)), '--du': 1600 + ((i * 230) % 1400) + 'ms', '--sz': 4 + (i % 3) * 3 + 'px', '--dl': -((i * 170) % 1500) + 'ms',
}) as CSSProperties);
const BEAMS = [12, 30, 70, 88].map((x, i) => ({ '--x': x + '%', '--dl': i * -900 + 'ms', '--dir': i % 2 ? 1 : -1 }) as CSSProperties);
const FLAMES = Array.from({ length: 18 }, (_, i) => ({
  '--x': pct(i * 5.9 - 3), '--w': 70 + ((i * 37) % 90) + 'px', '--h': 120 + ((i * 53) % 200) + 'px', '--du': 700 + ((i * 130) % 600) + 'ms', '--dl': -((i * 210) % 900) + 'ms',
}) as CSSProperties);
const STARS = Array.from({ length: 46 }, (_, i) => ({
  '--x': pct(i * 23.3 + 3), '--y': pct(i * 41.7 + 7), '--sz': 1 + (i % 3) + 'px', '--dl': -((i * 310) % 2400) + 'ms',
}) as CSSProperties);
const COMETS = [0, 1, 2].map((i) => ({ '--y': 8 + i * 14 + '%', '--dl': 600 + i * 1300 + 'ms' }) as CSSProperties);

/** Rayo zigzag desde el centro (coordenadas del viewBox -200…200). */
function boltPath(angle: number, len: number, seed: number) {
  const segs = 7;
  const perp = angle + 90;
  let d = '';
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const base = polar(angle, 40 + len * t);
    const j = i === 0 ? 0 : (((seed * 31 + i * 17) % 21) - 10) * (len / 110);
    const off = polar(perp, j);
    d += (i === 0 ? 'M' : 'L') + (base.x + off.x).toFixed(1) + ' ' + (base.y + off.y).toFixed(1) + ' ';
  }
  return d.trim();
}
const BOLTS = Array.from({ length: 7 }, (_, i) => ({ d: boltPath(i * 51.4 - 80, 130 + (i % 3) * 25, i + 3), dl: (i % 4) * 90 }));

/** Grietas que salen del centro de la pantalla (viewBox -500…500). */
const CRACKS = Array.from({ length: 11 }, (_, i) => {
  const a = i * 32.7 + 10;
  let d = 'M0 0';
  let r = 0;
  let ang = a;
  for (let k = 0; k < 6; k++) {
    r += 70 + ((i * 13 + k * 29) % 60);
    ang += (((i * 7 + k * 11) % 9) - 4) * 3;
    const p = polar(ang, r);
    d += ' L' + p.x.toFixed(0) + ' ' + p.y.toFixed(0);
  }
  return { d, dl: (i % 4) * 60 };
});

function RuneCircle() {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const tri = (rot: number) =>
    [0, 120, 240]
      .map((d) => {
        const p = polar(d + rot - 90, 120);
        return p.x.toFixed(1) + ',' + p.y.toFixed(1);
      })
      .join(' ');
  return (
    <svg className="sx-tu-runes" viewBox="-200 -200 400 400" aria-hidden="true">
      <circle r="190" className="sx-tu-rune-line" />
      <circle r="172" className="sx-tu-rune-line is-dash" />
      <circle r="128" className="sx-tu-rune-line" />
      <polygon points={tri(0)} className="sx-tu-rune-line" />
      <polygon points={tri(180)} className="sx-tu-rune-line" />
      {ticks.map((deg, i) => (
        <g key={deg} transform={'rotate(' + deg + ') translate(0 -181)'}>
          {i % 2 ? <rect x="-3" y="-6" width="6" height="12" className="sx-tu-rune-glyph" /> : <polygon points="0,-8 6,6 -6,6" className="sx-tu-rune-glyph" />}
        </g>
      ))}
    </svg>
  );
}

export function TierUpCeremony(props: { from: LadderRank; to: LadderRank; fromIcon: string; toIcon: string; onDone: () => void }) {
  const { from, to, fromIcon, toIcon } = props;
  const look = TIER_FX[to.tier] ?? DEFAULT_FX;
  const { lvl } = look;
  const fx = new Set(look.fx);
  const timing = tuTiming(lvl);
  const [parts] = useState(() => buildFx(lvl));
  const [sound, setSound] = useSfxEnabled();
  const [phase, setPhase] = useState<'charge' | 'burst' | 'reveal'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reveal' : 'charge',
  );
  const onDone = useRef(props.onDone);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onDone.current = props.onDone;
  });

  useEffect(() => {
    const t = tuTiming(lvl);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase((p) => (p === 'charge' ? 'burst' : p)), t.charge),
      setTimeout(() => setPhase('reveal'), t.charge + t.burst),
      setTimeout(() => onDone.current(), t.close),
    ];
    // Sonido: carga → estallido → fanfarria (sin carga si hay movimiento reducido).
    if (!reduce) {
      sfxCharge(t.charge);
      timers.push(setTimeout(() => sfxBurst(lvl), t.charge));
    }
    timers.push(setTimeout(() => sfxReveal(lvl), reduce ? 0 : t.charge + t.burst));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onDone.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, [lvl]);

  useEffect(() => {
    if (phase === 'reveal') btnRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (typeof document === 'undefined') return null;
  const style = {
    '--sx-tier': TIER_COLOR[to.tier] ?? 'var(--gold)',
    '--sx-tier-old': TIER_COLOR[from.tier] ?? 'var(--orange)',
    '--lvl': lvl,
    '--amp': (0.35 + lvl * 0.17).toFixed(2),
    '--charge': timing.charge + 'ms',
    '--burst': timing.burst + 'ms',
  } as CSSProperties;
  const cls = [
    'sx-tierup',
    'is-' + phase,
    'tu-' + to.tier.toLowerCase(),
    lvl >= 3 ? 'has-rays' : '',
    lvl >= 6 ? 'has-rays2' : '',
    lvl >= 5 ? 'is-big' : '',
    lvl >= 7 ? 'is-epic' : '',
    lvl >= 9 ? 'is-apex' : '',
    ...look.fx.map((f) => 'fx-' + f),
  ]
    .filter(Boolean)
    .join(' ');
  const iconMask = { maskImage: 'url("' + toIcon + '")', WebkitMaskImage: 'url("' + toIcon + '")' } as CSSProperties;

  return createPortal(
    <div
      className={cls}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={'Nuevo rango: ' + to.displayName}
      onClick={() => phase === 'reveal' && onDone.current()}
    >
      <div className="sx-tu-bg" />
      <button
        aria-label={sound ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}
        className="sx-tu-sound"
        onClick={(e) => {
          e.stopPropagation();
          setSound(!sound);
        }}
        title={sound ? 'Silenciar' : 'Activar sonido'}
        type="button"
      >
        {sound ? '🔊' : '🔇'}
      </button>
      {fx.has('stars') ? (
        <div className="sx-tu-stars" aria-hidden="true">
          {STARS.map((st, i) => (
            <span key={'st' + i} style={st} />
          ))}
          {COMETS.map((st, i) => (
            <i key={'co' + i} style={st} />
          ))}
        </div>
      ) : null}
      <div className="sx-tu-rays" />
      {lvl >= 6 ? <div className="sx-tu-rays is-rev" /> : null}
      {fx.has('prism') ? <div className="sx-tu-prism" /> : null}
      {fx.has('beams') ? (
        <div className="sx-tu-beams" aria-hidden="true">
          {BEAMS.map((st, i) => (
            <span key={'b' + i} style={st} />
          ))}
        </div>
      ) : null}
      {fx.has('pillar') ? <div className="sx-tu-pillar" aria-hidden="true" /> : null}
      {fx.has('cracks') ? (
        <svg className="sx-tu-cracks" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {CRACKS.map((c, i) => (
            <path key={'c' + i} d={c.d} pathLength={1} style={{ '--dl': c.dl + 'ms' } as CSSProperties} />
          ))}
        </svg>
      ) : null}
      {fx.has('flames') ? (
        <div className="sx-tu-flames" aria-hidden="true">
          {FLAMES.map((st, i) => (
            <span key={'f' + i} style={st} />
          ))}
        </div>
      ) : null}
      {fx.has('strike') ? (
        <svg className="sx-tu-strike" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true">
          <path d="M52 0 L44 70 L58 120 L40 190 L60 250 L46 320 L50 400" />
          <path d="M44 70 L28 110 M40 190 L22 230 M60 250 L76 290" className="is-branch" />
        </svg>
      ) : null}
      <div className="sx-tu-flash" />
      {lvl >= 7 ? <div className="sx-tu-flash is-second" /> : null}
      <div className="sx-tu-shake">
        <div className="sx-tu-stage">
          {fx.has('runes') ? <RuneCircle /> : null}
          <span className="sx-tu-halo" />
          <span className="sx-tu-gather" />
          {parts.motes.map((st, i) => (
            <span key={'m' + i} className="sx-tu-mote" style={st} />
          ))}
          {fx.has('vortex')
            ? ORBS.map((st, i) => <span key={'o' + i} className="sx-tu-orb" style={st} />)
            : null}
          {fx.has('frost') ? (
            <>
              {SPIKES.map((st, i) => (
                <span key={'sp' + i} className="sx-tu-spike" style={st} />
              ))}
              {[0, 1].map((i) => (
                <svg key={'hx' + i} className="sx-tu-hex" viewBox="-100 -100 200 200" style={{ '--dl': i * 180 + 'ms' } as CSSProperties} aria-hidden="true">
                  <polygon points="0,-90 78,-45 78,45 0,90 -78,45 -78,-45" />
                </svg>
              ))}
            </>
          ) : null}
          <img alt="" className="sx-tu-old" src={fromIcon} />
          {parts.shards.map((sh, i) => (
            <img key={'s' + i} alt="" className="sx-tu-shard" src={fromIcon} style={{ ...sh.style, clipPath: sh.clip }} />
          ))}
          {Array.from({ length: parts.rings }, (_, i) => (
            <span key={'r' + i} className="sx-tu-ring" style={{ '--dl': i * 140 + 'ms' } as CSSProperties} />
          ))}
          {fx.has('slash')
            ? [0, 1].map((i) => <span key={'sl' + i} className="sx-tu-slash" style={{ '--a': (i ? 32 : -32) + 'deg', '--dl': i * 110 + 'ms' } as CSSProperties} />)
            : null}
          {fx.has('bolts') ? (
            <svg className="sx-tu-bolts" viewBox="-200 -200 400 400" aria-hidden="true">
              {BOLTS.map((b, i) => (
                <path key={'bo' + i} d={b.d} style={{ '--dl': b.dl + 'ms' } as CSSProperties} />
              ))}
            </svg>
          ) : null}
          {parts.sparks.map((st, i) => (
            <span key={'k' + i} className={'sx-tu-spark' + (i % 3 === 0 ? ' is-hot' : '')} style={st} />
          ))}
          {fx.has('fountain')
            ? FOUNTAIN.map((st, i) => <span key={'fo' + i} className="sx-tu-fount" style={st} />)
            : null}
          <img alt="" className="sx-tu-new" src={toIcon} />
          {fx.has('sheen') ? <span className="sx-tu-sheen" style={iconMask} /> : null}
          {fx.has('crown') ? (
            <svg className="sx-tu-crown" viewBox="0 0 100 64" aria-hidden="true">
              <path d="M6 58 L12 16 L32 38 L50 4 L68 38 L88 16 L94 58 Z" />
              <circle cx="50" cy="44" r="5" />
              <circle cx="28" cy="48" r="3.5" />
              <circle cx="72" cy="48" r="3.5" />
            </svg>
          ) : null}
        </div>
        <div className="sx-tu-text">
          <span className="sx-tu-kicker">{look.kicker}</span>
          <h2 className="sx-tu-name" aria-label={to.tier} style={{ '--len': to.tier.length } as CSSProperties}>
            {to.tier.split('').map((ch, i) => (
              <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </h2>
          {look.motto ? <p className="sx-tu-motto">{look.motto}</p> : null}
          <p className="sx-tu-sub">
            {from.displayName} <span aria-hidden="true">➜</span> <b>{to.displayName}</b>
          </p>
          <button ref={btnRef} className="sx-btn sx-btn--lg sx-tu-btn" onClick={() => onDone.current()} type="button">
            Continuar
          </button>
        </div>
      </div>
      <div className="sx-tu-embers" aria-hidden="true">
        {parts.embers.map((st, i) => (
          <span key={'e' + i} style={st} />
        ))}
      </div>
      {fx.has('coins') ? (
        <div className="sx-tu-coins" aria-hidden="true">
          {COINS.map((st, i) => (
            <span key={'cn' + i} style={st} />
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function LpProgress(props: { after: number; delta: number; won: boolean; rank?: SalaFinished['rank']; assets: SalaAssets }) {
  const { after, delta, won, rank, assets } = props;
  const before = after - delta;
  const { value, done, flash, tierUp, endTierUp } = useLpTimeline(before, after);

  const iconDir = rank?.iconPath ? rank.iconPath.slice(0, rank.iconPath.lastIndexOf('/') + 1) : '';
  const cur = ladderRank(value);
  const isFinal = cur.index === ladderRank(after).index;
  const name = isFinal && rank?.displayName ? rank.displayName : cur.displayName;
  const icon = isFinal && rank?.iconPath ? rank.iconPath : iconDir + cur.iconFile;
  const iconFor = (r: LadderRank) =>
    assets.rankIcon(r.index === ladderRank(after).index && rank?.iconPath ? rank.iconPath : iconDir + r.iconFile);

  // Tramo ganado/perdido dentro de la división que se ve ahora.
  const divStart = (cur.index + 1) * LP_PER_DIVISION;
  const beforeLp = cur.isRp ? 100 : Math.min(100, Math.max(0, before - divStart));
  const lo = Math.min(beforeLp, cur.lp);
  const hi = Math.max(beforeLp, cur.lp);
  const moved = Math.round(value - before);
  const shownLp = Math.floor(cur.lp + 0.0001);
  const tone = won ? 'is-up' : 'is-down';

  return (
    <section
      className={'sx-lp ' + tone + (done ? ' is-done' : '') + (flash ? ' has-flash' : '')}
      aria-label={(delta >= 0 ? '+' : '') + delta + ' LP. Ahora: ' + (rank?.displayName ?? name)}
    >
      <div className="sx-lp-head">
        <img key={cur.index} alt="" className="sx-lp-icon" src={assets.rankIcon(icon)} />
        <div className="sx-lp-name">
          <strong key={cur.index}>{name}</strong>
          <small>{cur.isRp ? Math.round(value) + ' RP' : shownLp + ' / 100 LP'}</small>
        </div>
        <b className={'sx-lp-delta ' + tone}>
          {moved >= 0 ? '+' + moved : moved} LP
        </b>
      </div>

      <div
        className="sx-lp-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shownLp}
        aria-label="LP de la división"
      >
        <span className="sx-lp-fill" style={{ width: (won ? lo : cur.lp) + '%' }} />
        <span className={'sx-lp-seg ' + tone} style={{ left: lo + '%', width: hi - lo + '%' }} />
        {!cur.isRp ? <span className="sx-lp-head-glow" style={{ left: cur.lp + '%' }} /> : null}
      </div>

      {flash ? (
        <div key={flash + cur.index} className={'sx-lp-banner ' + (flash === 'up' ? 'is-up' : 'is-down')}>
          {flash === 'up' ? '▲ ¡Ascendiste a ' + name + '!' : '▼ Bajaste a ' + name}
        </div>
      ) : null}

      <p className="sx-lp-foot">
        {done
          ? rank && rank.next
            ? 'Faltan ' + rank.lpToNext + (rank.nextIsRp ? ' pts' : ' LP') + ' para ' + rank.next + ' · total ' + after + ' pts'
            : 'Total ' + after + ' pts'
          : won
            ? 'Sumando LP…'
            : 'Restando LP…'}
      </p>

      {tierUp ? (
        <TierUpCeremony
          key={tierUp.to.index}
          from={tierUp.from}
          to={tierUp.to}
          fromIcon={iconFor(tierUp.from)}
          toIcon={iconFor(tierUp.to)}
          onDone={endTierUp}
        />
      ) : null}
    </section>
  );
}

export function SalaFinishedScreen(props: { finished: SalaFinished; assets: SalaAssets; Link: SalaLink; extra?: ReactNode }) {
  const { finished: f, assets, Link } = props;
  // Sting de victoria/derrota: una sola vez por pantalla final.
  const stung = useRef(false);
  useEffect(() => {
    if (stung.current) return;
    stung.current = true;
    if (f.status === 'FINISHED') sfxSting(!!f.won);
  }, [f]);
  if (f.status === 'CANCELLED') {
    return (
      <SalaScreen
        icon="🚫"
        title="Set cancelado"
        actions={
          <>
            <Link href="/matchmaking" className="sx-btn sx-btn--success sx-btn--lg">
              Volver al matchmaking
            </Link>
            {props.extra}
          </>
        }
      >
        <p>
          Marcador al cancelar: {f.myScore} - {f.oppScore}. Nadie suma ni pierde puntos.
        </p>
      </SalaScreen>
    );
  }
  const won = !!f.won;
  const delta = f.delta ?? 0;
  return (
    <SalaScreen
      icon={won ? '🏆' : '💀'}
      title={won ? '¡Victoria!' : 'Derrota'}
      titleClass={won ? 'is-win' : 'is-loss'}
      actions={
        <>
          <Link href="/matchmaking" className="sx-btn sx-btn--success sx-btn--lg">
            Jugar otro set
          </Link>
          <Link href="/" className="sx-btn sx-btn--ghost sx-btn--lg">
            Ver ranking
          </Link>
          {props.extra}
        </>
      }
    >
      <div className="sx-result">
        {f.myScore} - {f.oppScore}
      </div>
      {typeof f.myPoints === 'number' ? (
        <LpProgress after={f.myPoints} delta={delta} won={won} rank={f.rank} assets={assets} />
      ) : (
        <p>
          <span className={'sx-delta ' + (delta >= 0 ? 'is-up' : 'is-down')}>
            {delta >= 0 ? '+' + delta : delta} pts
          </span>
        </p>
      )}
    </SalaScreen>
  );
}

// ---------------------------------------------------------------------------
// Efectos de sonido estilo JUEGO DE PELEA / LoL (Web Audio API, sin archivos):
// golpes orquestales con distorsión, tambores taiko, risers, sub-bass,
// crash con reverb y fanfarria de brass. Todo sintetizado al vuelo.
// Se silencia con el botón 🔊 de la ceremonia (se recuerda en localStorage).
// ---------------------------------------------------------------------------

const SFX_PREF = 'hc-sala-sfx';

let sfxEnabled = true;
let audioCtx: AudioContext | null = null;
let sfxMaster: GainNode | null = null;
let sfxReverb: ConvolverNode | null = null;

if (typeof window !== 'undefined') {
  try {
    sfxEnabled = window.localStorage.getItem(SFX_PREF) !== 'off';
  } catch {
    /* almacenamiento bloqueado: queda activado */
  }
  // Si el contexto quedó suspendido, el primer clic/tecla lo reanuda.
  const wake = () => {
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume();
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !sfxEnabled) return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    if (audioCtx.state !== 'running') return null;
    if (!sfxMaster) {
      // Cadena maestra: todo pasa por compresor (pegada tipo trailer) y
      // un envío de reverb (sala grande) para el aire "épico".
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      sfxMaster = audioCtx.createGain();
      sfxMaster.gain.value = 0.9;
      sfxMaster.connect(comp).connect(audioCtx.destination);
      sfxReverb = audioCtx.createConvolver();
      sfxReverb.buffer = impulseResponse(audioCtx, 2.4, 2.6);
      const wet = audioCtx.createGain();
      wet.gain.value = 0.4;
      sfxReverb.connect(wet).connect(sfxMaster);
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Impulso de reverb sintético (sala de piedra grande). */
function impulseResponse(ac: AudioContext, seconds: number, decay: number) {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function send(ac: AudioContext, src: AudioNode, gainDry: number, gainVerb: number) {
  const dry = ac.createGain();
  dry.gain.value = gainDry;
  src.connect(dry).connect(sfxMaster!);
  if (sfxReverb) {
    const wet = ac.createGain();
    wet.gain.value = gainVerb;
    src.connect(wet).connect(sfxReverb);
  }
}

/** Distorsión suave (tanh) para que el brass "muerda". */
function shaper(ac: AudioContext, amount = 3) {
  const ws = ac.createWaveShaper();
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

/**
 * Golpe orquestal "de pelea": 3 sierras desafinadas + distorsión + lowpass
 * que cierra. Es el sonido "DUN" de los anuncios de K.O. / select screen.
 */
function brassHit(ac: AudioContext, t0: number, freq: number, dur: number, gain: number, verb = 0.35) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.setValueAtTime(gain, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t0);
  lp.frequency.exponentialRampToValueAtTime(500, t0 + dur);
  lp.Q.value = 1;
  const dist = shaper(ac, 2.5);
  g.connect(dist).connect(lp);
  send(ac, lp, 1, verb);
  [-7, 0, 7].forEach((cents) => {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * Math.pow(2, cents / 1200);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
  // Sub-octava para cuerpo.
  const sub = ac.createOscillator();
  sub.type = 'square';
  sub.frequency.value = freq / 2;
  const subG = ac.createGain();
  subG.gain.value = 0.5;
  sub.connect(subG).connect(g);
  sub.start(t0);
  sub.stop(t0 + dur + 0.05);
}

/** Pad coral (el "aah" épico de los trailers de LoL): triángulos desafinados. */
function choirPad(ac: AudioContext, t0: number, freq: number, dur: number, gain: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.4, dur * 0.3));
  g.gain.setValueAtTime(gain, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  g.connect(lp);
  send(ac, lp, 0.6, 0.9);
  [-9, -4, 4, 9].forEach((cents) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq * Math.pow(2, cents / 1200);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  });
}

/** Tambor taiko: sine con caída de tono + click de ataque. */
function taiko(ac: AudioContext, t0: number, gain = 0.5, freq = 140) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.22);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  send(ac, g, 1, 0.25);
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + 0.35);
  // Click del palo.
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const cg = ac.createGain();
  cg.gain.value = gain * 0.5;
  src.connect(hp).connect(cg).connect(sfxMaster!);
  src.start(t0);
}

/** Crash de platillo: ruido agudo con cola de reverb. */
function crash(ac: AudioContext, t0: number, dur = 1.4, gain = 0.22) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(hp).connect(g);
  send(ac, g, 0.7, 0.8);
  src.start(t0);
}

/** Riser: ruido + sierra que suben y aceleran (tensión antes del estallido). */
function riser(ac: AudioContext, t0: number, dur: number, gain = 0.1) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t0);
  bp.frequency.exponentialRampToValueAtTime(6500, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g);
  send(ac, g, 0.8, 0.5);
  src.start(t0);
  src.stop(t0 + dur);
  // Drone que sube en quintas.
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, t0);
  osc.frequency.exponentialRampToValueAtTime(440, t0 + dur);
  const trem = ac.createGain();
  const lfo = ac.createOscillator();
  lfo.frequency.setValueAtTime(4, t0);
  lfo.frequency.exponentialRampToValueAtTime(14, t0 + dur);
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.5;
  lfo.connect(lfoG).connect(trem.gain);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(gain * 0.5, t0 + dur * 0.9);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(trem).connect(og);
  send(ac, og, 0.7, 0.4);
  osc.start(t0);
  osc.stop(t0 + dur);
  lfo.start(t0);
  lfo.stop(t0 + dur);
}

/** Sub-bass drop (el "BWOOM" de los trailers). */
function subDrop(ac: AudioContext, t0: number, f0 = 90, f1 = 28, dur = 0.9, gain = 0.55) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  send(ac, g, 1, 0.15);
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// --------------------------- Sonidos de la sala ---------------------------

/** Fase 1 · carga: redoble de taikos que acelera + riser final. */
function sfxCharge(ms: number) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  const dur = ms / 1000;
  // Redoble: los golpes se van juntando (tensión de "ROUND 1… FIGHT!").
  let t = 0;
  let gap = 0.34;
  while (t < dur - 0.6) {
    taiko(ac, t0 + t, t / dur < 0.5 ? 0.3 : 0.42);
    t += gap;
    gap = Math.max(0.09, gap * 0.82);
  }
  // Riser de los últimos ~60%.
  riser(ac, t0 + dur * 0.4, dur * 0.6, 0.09);
}

/** Fase 2 · estallido: impacto orquestal + sub-drop + crash. */
function sfxBurst(lvl: number) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  subDrop(ac, t0, 95, 26, 0.9 + lvl * 0.03, 0.6);
  // Acorde de impacto (root + quinta): el "DUN" del K.O.
  const root = 130.81 * Math.pow(2, (lvl - 1) / 12);
  brassHit(ac, t0, root, 0.7 + lvl * 0.05, 0.5);
  brassHit(ac, t0 + 0.02, root * 1.5, 0.6 + lvl * 0.04, 0.32);
  crash(ac, t0, 1.2 + lvl * 0.08, 0.2 + lvl * 0.015);
}

/** Fase 3 · revelación: fanfarria heroica de brass + coro; más rango, más épica. */
function sfxReveal(lvl: number) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  const root = 261.63 * Math.pow(2, (lvl - 1) / 12);
  // Motivo "dun-dun-dun-DUUUUN" (I – I – V7 – I) con power chords.
  const seq = [
    { f: root, d: 0.28, at: 0 },
    { f: root, d: 0.28, at: 0.32 },
    { f: root * 1.5, d: 0.34, at: 0.64 },
    { f: root * 2, d: 1.4 + lvl * 0.08, at: 1.05 },
  ];
  seq.forEach(({ f, d, at }) => {
    brassHit(ac, t0 + at, f, d, 0.42);
    brassHit(ac, t0 + at, f * 1.5, d, 0.2, 0.5);
  });
  // Coro debajo del acorde final.
  choirPad(ac, t0 + 1.05, root / 2, 2.2 + lvl * 0.1, 0.16);
  choirPad(ac, t0 + 1.05, root * 1.5 / 2, 2.2 + lvl * 0.1, 0.11);
  // Niveles altos: crash doble + taiko final + brillo.
  crash(ac, t0 + 1.05, 1.8, 0.18 + lvl * 0.012);
  if (lvl >= 5) taiko(ac, t0 + 1.05, 0.5, 150);
  if (lvl >= 7) {
    crash(ac, t0 + 1.35, 1.6, 0.14);
    choirPad(ac, t0 + 1.05, root, 2.4, 0.09);
  }
  if (lvl >= 9) {
    taiko(ac, t0 + 1.32, 0.55, 160);
    subDrop(ac, t0 + 1.05, 80, 24, 1.4, 0.5);
  }
}

/** Golpe rápido al cruzar una división en la barra de LP (sube o baja). */
function sfxFlash(up: boolean) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  if (up) {
    brassHit(ac, t0, 523.25, 0.16, 0.3, 0.3);
    brassHit(ac, t0 + 0.13, 784, 0.45, 0.34, 0.4);
    taiko(ac, t0 + 0.13, 0.3, 150);
  } else {
    brassHit(ac, t0, 392, 0.18, 0.28, 0.3);
    brassHit(ac, t0 + 0.15, 261.63, 0.5, 0.3, 0.4);
    subDrop(ac, t0 + 0.15, 70, 30, 0.6, 0.35);
  }
}

/** Sting de VICTORIA (fanfarria completa) o DERROTA (brass grave que cae). */
function sfxSting(won: boolean) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  if (won) {
    // Fanfarria "VICTORY": C-E-G-C con power chords, coro y crash.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const at = i * 0.17;
      brassHit(ac, t0 + at, f, i === 3 ? 1.6 : 0.3, 0.4);
      if (i % 2 === 0) taiko(ac, t0 + at, 0.35, 150);
    });
    choirPad(ac, t0 + 0.52, 261.63, 2.4, 0.14);
    choirPad(ac, t0 + 0.52, 392, 2.4, 0.1);
    crash(ac, t0 + 0.52, 2, 0.2);
    subDrop(ac, t0 + 0.52, 85, 30, 1.2, 0.4);
  } else {
    // Derrota: dos golpes graves descendentes con cola larga.
    brassHit(ac, t0, 311.13, 0.5, 0.34, 0.5);
    brassHit(ac, t0 + 0.45, 233.08, 0.55, 0.34, 0.5);
    brassHit(ac, t0 + 0.95, 155.56, 1.6, 0.4, 0.6);
    subDrop(ac, t0 + 0.95, 65, 24, 1.5, 0.45);
    choirPad(ac, t0 + 0.95, 77.78, 2.2, 0.12);
  }
}

/** ¿Sonido activado? + interruptor que se recuerda en localStorage. */
function useSfxEnabled(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(sfxEnabled);
  const toggle = (next: boolean) => {
    sfxEnabled = next;
    setOn(next);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(SFX_PREF, next ? 'on' : 'off');
    } catch {
      /* almacenamiento bloqueado */
    }
    if (next) {
      const ac = audio();
      if (ac) taiko(ac, ac.currentTime + 0.02, 0.4, 160);
    }
  };
  return [on, toggle];
}
