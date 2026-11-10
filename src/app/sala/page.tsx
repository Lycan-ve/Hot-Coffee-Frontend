'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from "next/link";
import { AppShell } from '@/components/hc/shared';
import { LoginLink } from '@/components/hc/DiscordLogin';
import { fetchMe, fuseIconUrl, getToken, rankIconUrl, type ProfileTeam } from '@/lib/auth';
import {
  RosterEntry,
  SalaState,
  SalaTeam,
  closeSet,
  confirmReport,
  correctLastGame,
  getSalaState,
  getRoster,
  rejectReport,
  reportFinal,
  reportGame,
  respondClose,
  saveRoom,
  saveTeam,
  sendChat,
} from '@/lib/sala';

const POLL_MS = 3000;

function TeamChips({ team }: { team: SalaTeam }) {
  if (!team.complete) {
    return <span className="text-xs italic text-white/35">equipo sin confirmar…</span>;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">{team.char1Name}</span>
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">{team.char2Name}</span>
      <span className="rounded bg-primary/30 px-2 py-0.5 text-xs font-semibold text-hc-cream">{team.fuseName}</span>
    </div>
  );
}

function SideCard(props: { tag: string; avatarUrl: string; score: number; points: number; team: SalaTeam; accent: string }) {
  const { tag, avatarUrl, score, points, team, accent } = props;
  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      {avatarUrl ? (
                <img src={avatarUrl} alt={tag} className="h-16 w-16 rounded-full border-2" style={{ borderColor: accent }} />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl" style={{ borderColor: accent }}>☕</div>
      )}
      <span className="max-w-full truncate font-condensed text-lg font-bold" style={{ color: accent }}>{tag}</span>
      <TeamChips team={team} />
      <span className="text-xs text-white/40">{points} pts</span>
      <span className="font-condensed text-4xl font-black leading-none" style={{ color: accent }}>{score}</span>
    </div>
  );
}

export default function SalaPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<SalaState | null>(null);
  const [roster, setRoster] = useState<{ characters: RosterEntry[]; fuses: RosterEntry[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [roomDraft, setRoomDraft] = useState('');
  const [char1, setChar1] = useState('');
  const [char2, setChar2] = useState('');
  const [fuse, setFuse] = useState('');
  const [showFinal, setShowFinal] = useState(false);
  const [finalMine, setFinalMine] = useState(0);
  const [finalOpp, setFinalOpp] = useState(0);
  const [connFails, setConnFails] = useState(0);
  const lastIdRef = useRef(0);
  const matchIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const seenTeamRef = useRef(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [mains, setMains] = useState<ProfileTeam | null>(null);
  const [teamNotice, setTeamNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const s = await getSalaState(lastIdRef.current);
    if (!s) {
      setConnFails((n) => n + 1);
      return;
    }
    setConnFails(0);
    const mid = s.match ? s.match.id : 0;
    if (mid !== matchIdRef.current) {
      // Set nuevo (o cambio de set): el chat arranca desde el último mensaje.
      matchIdRef.current = mid;
      lastIdRef.current = s.lastMessageId;
      setState(s);
      return;
    }
    lastIdRef.current = s.lastMessageId > lastIdRef.current ? s.lastMessageId : lastIdRef.current;
    setState((prev) => (prev ? { ...s, messages: prev.messages.concat(s.messages) } : s));
  }, []);

  useEffect(() => {
    setAuthed(!!getToken());
    getRoster().then((r) => setRoster(r));
  }, []);

  // Equipo principal del perfil (para "usar mi equipo del perfil").
  useEffect(() => {
    if (authed !== true) return;
    fetchMe().then((d) => setMains(d?.mains ?? null));
  }, [authed]);

  useEffect(() => {
    if (authed !== true) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [authed, refresh]);

  const match = state && state.match ? state.match : null;

  // Prefilla la selección con el equipo ya confirmado en el servidor.
  useEffect(() => {
    const t = match ? match.me.team : null;
    if (!t || seenTeamRef.current || !t.complete) return;
    seenTeamRef.current = true;
    setChar1(t.char1);
    setChar2(t.char2);
    setFuse(t.fuse);
  }, [match]);

  // ---------- Selección de equipo (mismo diseño que el perfil) ----------
  const serverTeam = match ? match.me.team : null;
  const fighterArt = (id: string) => '/fighters/' + encodeURIComponent(id) + '.png';
  const pickRoster = (id: string, list?: RosterEntry[]) => list?.find((c) => c.id === id);
  const point =
    pickRoster(char1, roster?.characters) ??
    (serverTeam?.complete && char1 ? { id: char1, name: serverTeam.char1Name } : undefined);
  const assist =
    pickRoster(char2, roster?.characters) ??
    (serverTeam?.complete && char2 ? { id: char2, name: serverTeam.char2Name } : undefined);
  const fuseChar =
    pickRoster(fuse, roster?.fuses) ??
    (serverTeam?.complete && fuse ? { id: fuse, name: serverTeam.fuseName } : undefined);

  // Igual que en el perfil: la selección entra como ASSIST y empuja al anterior a POINT.
  const changeCharacter = (id: string) => {
    if (id === char1 || id === char2) return;
    if (!char1) setChar1(id);
    else if (!char2) setChar2(id);
    else {
      setChar1(char2);
      setChar2(id);
    }
  };

  const useProfileTeam = () => {
    if (!mains?.point || !mains?.assist || !mains?.fuse) {
      setTeamNotice({ text: 'Primero configura tu equipo principal en tu perfil.', ok: false });
      return;
    }
    setChar1(mains.point.id);
    setChar2(mains.assist.id);
    setFuse(mains.fuse.id);
    setTeamNotice({ text: 'Equipo del perfil cargado. Confírmalo para sellarlo.', ok: true });
  };

  const cancelSalaEdit = () => {
    const t = match ? match.me.team : null;
    setChar1(t && t.complete ? t.char1 : '');
    setChar2(t && t.complete ? t.char2 : '');
    setFuse(t && t.complete ? t.fuse : '');
    setTeamNotice(null);
    setEditingTeam(false);
  };

  const saveSalaTeam = async () => {
    if (!char1 || !char2 || !fuse || savingTeam) return;
    setSavingTeam(true);
    setTeamNotice(null);
    const err = await saveTeam(char1, char2, fuse);
    setSavingTeam(false);
    if (err) {
      setTeamNotice({ text: err, ok: false });
      return;
    }
    setTeamNotice(null);
    setEditingTeam(false);
    await refresh();
  };

  // ESC y scroll lock mientras el modal de equipo está abierto.
  useEffect(() => {
    if (!editingTeam) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingTeam) cancelSalaEdit();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTeam, savingTeam]);

  // Mantiene el input de código de sala sincronizado con el servidor.
  const roomCode = match ? match.roomCode : '';
  useEffect(() => {
    setRoomDraft(roomCode);
  }, [roomCode]);

  // Auto-scroll del chat hacia el mensaje más reciente.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state ? state.messages.length : 0]);

  const act = useCallback(
    async (fn: () => Promise<string | null>) => {
      const err = await fn();
      setNotice(err);
      await refresh();
    },
    [refresh],
  );

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    setChatDraft('');
    await act(() => sendChat(text));
  };

  // ---------- Pantallas previas a la sala ----------

  if (authed === false) {
    return (
      <AppShell><main className="page hc-sala flex min-h-[60vh] flex-col items-center justify-center gap-4  px-4 text-center text-white">
        <span className="text-5xl">🔐</span>
        <h1 className="font-condensed text-3xl font-bold text-white/80">Inicia sesión para entrar a la sala</h1>
        <p className="max-w-sm text-sm text-white/50">La sala del set es privada: solo tú y tu rival pueden verla.</p>
        <LoginLink />
      </main></AppShell>
    );
  }

  if (connFails >= 3 && !state) {
    return (
      <AppShell><main className="page hc-sala flex min-h-[60vh] flex-col items-center justify-center gap-4  px-4 text-center text-white">
        <span className="text-5xl">📡</span>
        <h1 className="font-condensed text-3xl font-bold text-white/80">No se pudo conectar con la sala</h1>
        <p className="text-sm text-white/50">Revisa tu conexión y vuelve a intentarlo.</p>
        <button
          onClick={() => {
            setConnFails(0);
            refresh();
          }}
          className="rounded-xl bg-hc-success px-6 py-3 font-condensed text-lg font-bold text-hc-ink transition hover:bg-hc-success/80"
        >
          Reintentar
        </button>
      </main></AppShell>
    );
  }

  if (authed === null || !state) {
    return (
      <AppShell><main className="page hc-sala flex min-h-[60vh] items-center justify-center  text-white/60">
        <span className="animate-pulse font-condensed text-xl">Cargando la sala…</span>
      </main></AppShell>
    );
  }

  if (!match) {
    return (
      <AppShell><main className="page hc-sala flex min-h-[60vh] flex-col items-center justify-center gap-4  px-4 text-center text-white">
        <span className="text-5xl">☕</span>
        <h1 className="font-condensed text-3xl font-bold text-white/80">No tienes ningún set en curso</h1>
        <p className="max-w-sm text-sm text-white/50">
          Cuando aceptes una propuesta del matchmaking, tu sala aparece aquí: equipo, código de sala, chat y reporte, todo en la web.
        </p>
        <div className="flex gap-3">
          <Link href="/matchmaking" className="rounded-xl bg-hc-success px-6 py-3 font-condensed text-lg font-bold text-hc-ink transition hover:bg-hc-success/80">
            Ir al matchmaking
          </Link>
          <Link href="/" className="rounded-xl border border-white/15 px-6 py-3 font-condensed text-lg font-bold text-white/80 transition hover:bg-white/10">
            Ranking
          </Link>
        </div>
      </main></AppShell>
    );
  }

  if (match.finished) {
    const f = match.finished;
    if (f.status === 'CANCELLED') {
      return (
        <AppShell><main className="page hc-sala flex min-h-[60vh] flex-col items-center justify-center gap-4  px-4 text-center text-white">
          <span className="text-5xl">🚫</span>
          <h1 className="font-condensed text-3xl font-bold text-white/80">Set cancelado</h1>
          <p className="text-sm text-white/50">Marcador al cancelar: {f.myScore} - {f.oppScore}</p>
          <Link href="/matchmaking" className="rounded-xl bg-hc-success px-6 py-3 font-condensed text-lg font-bold text-hc-ink transition hover:bg-hc-success/80">
            Volver al matchmaking
          </Link>
        </main></AppShell>
      );
    }
    const won = !!f.won;
    const delta = f.delta ?? 0;
    return (
      <AppShell><main className="page hc-sala flex min-h-[60vh] flex-col items-center justify-center gap-4  px-4 text-center text-white">
        <span className="text-6xl">{won ? '🏆' : '💀'}</span>
        <h1 className="font-condensed text-4xl font-black" style={{ color: won ? 'var(--success)' : 'var(--danger)' }}>
          {won ? '¡Victoria!' : 'Derrota'}
        </h1>
        <p className="font-condensed text-2xl font-bold text-white/80">{f.myScore} - {f.oppScore}</p>
        <p className="text-sm text-white/50">
          <span className="font-bold" style={{ color: won ? 'var(--success)' : 'var(--danger)' }}>
            {won ? '+' + delta : delta}
          </span>{' '}
          puntos · ahora tienes {f.myPoints ?? '—'} pts
        </p>
        {f.rank && (
                    <img src={rankIconUrl(f.rank.iconPath)} alt={f.rank.displayName} className="h-16 w-16" />
        )}
        <div className="mt-2 flex gap-3">
          <Link href="/matchmaking" className="rounded-xl bg-hc-success px-6 py-3 font-condensed text-lg font-bold text-hc-ink transition hover:bg-hc-success/80">
            Jugar otro set
          </Link>
          <Link href="/" className="rounded-xl border border-white/15 px-6 py-3 font-condensed text-lg font-bold text-white/80 transition hover:bg-white/10">
            Ver ranking
          </Link>
        </div>
      </main></AppShell>
    );
  }

  // ---------- Sala en vivo ----------
  const scoresTotal = match.me.score + match.opponent.score;
  const teamLocked = match.me.team.complete && scoresTotal > 0;
  const myTeam = match.me.team;
  const scoreOptions = Array.from({ length: match.ft + 1 }, (_, i) => i);
  const pending = match.pending;
  const closeInfo = match.close;

  const openFinal = () => {
    setFinalMine(match ? match.me.score : 0);
    setFinalOpp(match ? match.opponent.score : 0);
    setShowFinal(true);
  };

  return (
    <AppShell><main className="page hc-sala min-h-[60vh]  px-4 py-8 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <Link href="/matchmaking" className="text-sm text-white/40 transition hover:text-white/70">
            ← Volver
          </Link>
          <p className="font-condensed text-xl font-bold tracking-wide text-hc-cream">HOT COFFEE · SALA DEL SET</p>
          <span className="text-xs text-white/40">FT {match.ft}</span>
        </header>

        {connFails > 0 && (
          <p className="text-center text-xs text-hc-cream/80">Reconectando…</p>
        )}

        {notice && (
          <div className="rounded-xl border border-hc-danger/40 bg-hc-danger/10 px-4 py-3 text-sm text-hc-danger">{notice}</div>
        )}

        {/* Marcador VS */}
        <section className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          <SideCard tag={match.me.tag} avatarUrl={match.me.avatarUrl} score={match.me.score} points={match.me.points} team={match.me.team} accent="var(--success)" />
          <div className="flex flex-col items-center justify-center gap-1 px-2">
            <span className="font-condensed text-2xl font-black text-white/30">VS</span>
            <span className="rounded bg-hc-cream/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hc-cream">
              +{match.pointsAtStake} pts
            </span>
          </div>
          <SideCard tag={match.opponent.tag} avatarUrl={match.opponent.avatarUrl} score={match.opponent.score} points={match.opponent.points} team={match.opponent.team} accent="var(--danger)" />
        </section>

        {/* Reporte pendiente de confirmación */}
        {pending && (
          <section className="rounded-2xl border border-hc-cream/40 bg-hc-cream/10 p-4">
            {pending.byMe ? (
              <p className="text-sm text-hc-cream">
                {pending.kind === 'game' && 'Reporte de game enviado: esperando la confirmación de tu rival…'}
                {pending.kind === 'final' && 'Resultado final propuesto (' + (pending.finalMine ?? 0) + ' - ' + (pending.finalOpp ?? 0) + '): esperando la confirmación de tu rival…'}
                {pending.kind === 'correct' && 'Corrección del último game propuesta: esperando la confirmación de tu rival…'}
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-hc-cream">
                  {pending.kind === 'game' && pending.winnerSide === match.mySide && pending.proposerTag + ' reporta que GANASTE el game.'}
                  {pending.kind === 'game' && pending.winnerSide !== match.mySide && pending.proposerTag + ' reporta que ganó el game.'}
                  {pending.kind === 'final' && pending.proposerTag + ' propone el resultado final: ' + (pending.finalMine ?? 0) + ' - ' + (pending.finalOpp ?? 0) + '.'}
                  {pending.kind === 'correct' && pending.proposerTag + ' propone deshacer el último game.'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => act(() => confirmReport())} className="rounded-lg bg-hc-success px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-success/80">
                    ✓ Confirmar
                  </button>
                  <button onClick={() => act(() => rejectReport())} className="rounded-lg bg-hc-danger px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-danger/80">
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Propuesta de cierre anticipado */}
        {closeInfo && (
          <section className="rounded-2xl border border-hc-danger/40 bg-hc-danger/10 p-4">
            {closeInfo.byMe ? (
              <p className="text-sm text-hc-danger">
                Cierre propuesto: esperando a tu rival. Si no responde en 2 minutos,{' '}
                {closeInfo.tie ? 'el set se cancela por empate.' : 'gana ' + closeInfo.leader + ' con los puntos completos.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-hc-danger">
                  {closeInfo.requestedBy} propone cerrar el set:{' '}
                  {closeInfo.tie ? 'empate, se cancelaría sin puntos.' : 'ganaría ' + closeInfo.leader + '.'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => act(() => respondClose(true))} className="rounded-lg bg-hc-danger px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-danger/80">
                    Aceptar cierre
                  </button>
                  <button onClick={() => act(() => respondClose(false))} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10">
                    Seguir jugando
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Armado de equipo (horizontal, mismo diseño que el perfil) */}
        <section className="panel hc-sala-team">
          <div className="panel-heading">
            <h3>TU EQUIPO</h3>
            {myTeam.complete && !teamLocked ? (
              <button onClick={() => setEditingTeam(true)} type="button">CAMBIAR</button>
            ) : null}
          </div>

          <div className="sala-team-row">
            {[point, assist].map((fighter, index) => (
              <button
                className="sala-fighter"
                key={(fighter?.id ?? 'vacio') + '-' + index}
                onClick={() => { if (!myTeam.complete) setEditingTeam(true); }}
                type="button"
              >
                {fighter ? <img alt={fighter.name} src={fighterArt(fighter.id)} /> : <span className="sala-fighter-empty">＋</span>}
                <span>{index === 0 ? 'POINT' : 'ASSIST'}</span>
                <strong>{fighter?.name ?? 'ELEGIR'}</strong>
              </button>
            ))}
            <button className="sala-fuse" onClick={() => { if (!myTeam.complete) setEditingTeam(true); }} type="button">
              {fuseChar ? <img alt="" src={fuseIconUrl(fuseChar.id)} /> : null}
              <span>FUSIÓN</span>
              <strong>{fuseChar ? 'ON' : '—'}</strong>
            </button>
          </div>

          {!myTeam.complete ? (
            <div className="sala-team-actions">
              <button
                onClick={useProfileTeam}
                type="button"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
              >
                ⟳ Usar mi equipo del perfil
              </button>
              <button
                onClick={saveSalaTeam}
                disabled={!char1 || !char2 || !fuse || savingTeam}
                type="button"
                className="rounded-lg bg-hc-success px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-success/80 disabled:opacity-40"
              >
                {savingTeam ? 'GUARDANDO…' : 'Confirmar equipo'}
              </button>
              <span className="text-xs text-white/40">Toca una carta o la fusión para elegir.</span>
            </div>
          ) : (
            <p className="sala-team-note">
              EQUIPO CONFIRMADO ✓{teamLocked ? ' · YA HAY GAMES JUGADOS: QUEDÓ SELLADO.' : ''}
            </p>
          )}
        </section>

        {editingTeam
          ? createPortal(
              /* Portal a document.body: mismo truco que el modal del perfil
                 para escapar del stacking context y del topbar. */
              <div aria-label="Elegir equipo del set" aria-modal="true" className="team-modal" onClick={cancelSalaEdit} role="dialog">
                <div className="team-modal-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="team-modal-head">
                    <div>
                      <span className="eyebrow">TU EQUIPO</span>
                      <h3>ELIGE TU DÚO Y SU FUSIÓN</h3>
                    </div>
                    <button aria-label="Cerrar" className="team-modal-close" disabled={savingTeam} onClick={cancelSalaEdit} type="button">
                      ✕
                    </button>
                  </div>
                  <div className="team-modal-body">
                    <span>LUCHADORES · LA SIGUIENTE SELECCIÓN REEMPLAZA AL POINT</span>
                    <div className="fighter-grid">
                      {(roster?.characters ?? []).map((fighter) => (
                        <button
                          className={char1 === fighter.id || char2 === fighter.id ? 'selected' : ''}
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
                        <button className={'fuse-tile' + (fuse === f.id ? ' selected' : '')} key={f.id} onClick={() => setFuse(f.id)} type="button">
                          <img alt="" src={fuseIconUrl(f.id)} />
                          <span>{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="team-modal-foot">
                    <button className="team-save" disabled={savingTeam || !char1 || !char2 || !fuse} onClick={saveSalaTeam} type="button">
                      {savingTeam ? 'GUARDANDO...' : 'CONFIRMAR EQUIPO'}
                    </button>
                    <button className="team-cancel" disabled={savingTeam} onClick={useProfileTeam} type="button">
                      USAR EL DEL PERFIL
                    </button>
                    <button className="team-cancel" disabled={savingTeam} onClick={cancelSalaEdit} type="button">
                      CANCELAR
                    </button>
                    {teamNotice ? <span className={'team-note ' + (teamNotice.ok ? 'success' : 'danger')}>{teamNotice.text}</span> : null}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {/* Código de sala */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-condensed text-lg font-bold text-white/85">Código de sala</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={roomDraft}
              onChange={(e) => setRoomDraft(e.target.value)}
              placeholder="Código de sala de 2XKO"
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-hc-cream/60"
            />
            <div className="flex gap-2">
              <button onClick={() => act(() => saveRoom(roomDraft.trim()))} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/80">
                Guardar
              </button>
              {match.roomCode && (
                <button
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(match.roomCode)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
                >
                  Copiar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Reporte de games */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-condensed text-lg font-bold text-white/85">Reporte de games</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act(() => reportGame('me'))} disabled={!!pending} className="rounded-lg bg-hc-success px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-success/80 disabled:opacity-40">
              🏆 Gané el game
            </button>
            <button onClick={() => act(() => reportGame('opponent'))} disabled={!!pending} className="rounded-lg bg-hc-danger px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-danger/80 disabled:opacity-40">
              💀 Ganó mi rival
            </button>
            <button onClick={() => act(() => correctLastGame())} disabled={!!pending || !(match.roundHistory?.length > 0)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-40">
              ↩️ Corregir último
            </button>
            <button onClick={openFinal} disabled={!!pending} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-40">
              🏁 Resultado final
            </button>
            <button onClick={() => act(() => closeSet())} className="rounded-lg border border-hc-danger/40 px-4 py-2 text-sm font-bold text-hc-danger transition hover:bg-hc-danger/10">
              🏳️ Cerrar set
            </button>
          </div>

          {showFinal && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="mb-3 text-sm text-white/60">
                Reporta el marcador final (FT {match.ft}): uno de los dos debe llegar a {match.ft}.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select value={finalMine} onChange={(e) => setFinalMine(Number(e.target.value))} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none">
                  {scoreOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-white/50">-</span>
                <select value={finalOpp} onChange={(e) => setFinalOpp(Number(e.target.value))} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none">
                  {scoreOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setShowFinal(false);
                    act(() => reportFinal(finalMine, finalOpp));
                  }}
                  className="rounded-lg bg-hc-success px-4 py-2 text-sm font-bold text-hc-ink transition hover:bg-hc-success/80"
                >
                  Enviar
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Chat del set */}
        <section className="rounded-2xl border border-white/10 bg-black/30">
          <div ref={chatScrollRef} className="flex h-72 flex-col gap-2 overflow-y-auto p-3">
            {state.messages.length === 0 && (
              <p className="text-center text-xs text-white/30">Sin mensajes todavía. Saluda a tu rival ☕</p>
            )}
            {state.messages.map((msg) => (
              <div key={msg.id} className={msg.mine ? 'self-end' : 'self-start'}>
                <div className={'max-w-xs rounded-xl px-3 py-2 text-sm ' + (msg.mine ? 'bg-hc-success/20 text-hc-success' : 'bg-white/10 text-white/85')}>
                  {!msg.mine && <span className="mr-1 text-[10px] font-bold uppercase text-hc-danger">{msg.senderTag}</span>}
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/10 p-2">
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              maxLength={500}
              placeholder="Escribe un mensaje…"
              className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/25"
            />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/80">
              Enviar
            </button>
          </form>
        </section>
      </div>
    </main></AppShell>
  );
}
