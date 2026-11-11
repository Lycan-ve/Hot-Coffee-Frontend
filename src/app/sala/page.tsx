'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/hc/shared';
import { LoginLink } from '@/components/hc/DiscordLogin';
import { fetchMe, fuseIconUrl, getToken, rankIconUrl, type ProfileTeam } from '@/lib/auth';
import {
  type SalaMessage,
  type SalaState,
  closeSet,
  confirmReport,
  correctLastGame,
  getRoster,
  getSalaState,
  rejectReport,
  reportFinal,
  reportGame,
  requestRematch,
  respondClose,
  saveRoom,
  saveTeam,
  sendChat,
} from '@/lib/sala';
import {
  SalaFinishedScreen,
  SalaLoading,
  SalaRoom,
  SalaScreen,
  type Roster,
  type SalaActions,
  type SalaAssets,
} from '@/components/hc/sala/SalaRoom';

const POLL_MS = 3000;

const assets: SalaAssets = {
  fighterArt: (id) => '/fighters/' + encodeURIComponent(id) + '.png',
  fuseIcon: fuseIconUrl,
  rankIcon: rankIconUrl,
};

const noopSubscribe = () => () => {};

/** Une mensajes sin duplicar ids (dos polls pueden traer el mismo mensaje). */
function mergeMessages(prev: SalaMessage[], next: SalaMessage[]) {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((m) => m.id));
  return prev.concat(next.filter((m) => !seen.has(m.id)));
}

export default function SalaPage() {
  const router = useRouter();
  // null mientras renderiza en el servidor; true/false ya en el navegador.
  const authed = useSyncExternalStore(
    noopSubscribe,
    () => !!getToken(),
    () => null,
  );
  const [state, setState] = useState<SalaState | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [mains, setMains] = useState<ProfileTeam | null>(null);
  const [connFails, setConnFails] = useState(0);
  const [rematchNote, setRematchNote] = useState<string | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);
  const lastIdRef = useRef(0);
  const matchIdRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    // Evita polls solapados: si ya hay uno en curso, reutilízalo.
    if (inFlightRef.current) return inFlightRef.current;
    const p = (async () => {
      const s = await getSalaState(lastIdRef.current);
      if (!s) {
        setConnFails((n) => n + 1);
        return;
      }
      setConnFails(0);
      const mid = s.match ? s.match.id : 0;
      if (mid !== matchIdRef.current) {
        // Set nuevo: el chat arranca desde cero.
        matchIdRef.current = mid;
        lastIdRef.current = s.lastMessageId;
        setState(s);
        return;
      }
      lastIdRef.current = Math.max(lastIdRef.current, s.lastMessageId);
      setState((prev) => (prev ? { ...s, messages: mergeMessages(prev.messages, s.messages) } : s));
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = p;
    return p;
  }, []);

  useEffect(() => {
    getRoster().then(setRoster);
  }, []);

  useEffect(() => {
    if (authed !== true) return;
    fetchMe().then((d) => setMains(d?.mains ?? null));
  }, [authed]);

  // Polling: se pausa con la pestaña oculta y refresca al volver.
  useEffect(() => {
    if (authed !== true) return;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authed, refresh]);

  const actions: SalaActions = {
    refresh,
    saveTeam,
    saveRoom,
    sendChat,
    reportGame,
    confirmReport,
    rejectReport,
    correctLastGame,
    reportFinal,
    closeSet,
    respondClose,
  };

  // ---------- Pantallas previas a la sala ----------

  if (authed === false) {
    return (
      <AppShell>
        <SalaScreen icon="🔐" title="Inicia sesión para entrar" actions={<LoginLink />}>
          <p>La sala del set es privada: solo tú y tu rival pueden verla.</p>
        </SalaScreen>
      </AppShell>
    );
  }

  if (connFails >= 3 && !state) {
    return (
      <AppShell>
        <SalaScreen
          icon="📡"
          title="No se pudo conectar"
          actions={
            <button
              className="sx-btn sx-btn--success sx-btn--lg"
              onClick={() => {
                setConnFails(0);
                refresh();
              }}
              type="button"
            >
              Reintentar
            </button>
          }
        >
          <p>Revisa tu conexión y vuelve a intentarlo.</p>
        </SalaScreen>
      </AppShell>
    );
  }

  if (authed === null || !state) {
    return (
      <AppShell>
        <SalaLoading />
      </AppShell>
    );
  }

  const match = state.match;

  if (!match) {
    return (
      <AppShell>
        <SalaScreen
          icon="☕"
          title="No tienes ningún set en curso"
          actions={
            <>
              <Link href="/matchmaking" className="sx-btn sx-btn--success sx-btn--lg">
                Ir al matchmaking
              </Link>
              <Link href="/" className="sx-btn sx-btn--ghost sx-btn--lg">
                Ranking
              </Link>
            </>
          }
        >
          <p>Cuando aceptes una propuesta del matchmaking, tu sala aparece aquí: equipo, código de sala, chat y reporte, todo en la web.</p>
        </SalaScreen>
      </AppShell>
    );
  }

  if (match.finished) {
    const rm = state.rematch;
    const rematchExtra = (
      <>
        {rm ? (
          rm.byMe ? (
            <p className="sx-hint">
              ⏳ Le propusiste la revancha a {rm.opponentTag}: tiene que aceptarla desde el matchmaking.
            </p>
          ) : (
            <Link href="/matchmaking" className="sx-btn sx-btn--primary sx-btn--lg">
              🔁 {rm.opponentTag} quiere revancha — ver propuesta
            </Link>
          )
        ) : (
          <button
            className="sx-btn sx-btn--primary sx-btn--lg"
            disabled={rematchBusy}
            onClick={async () => {
              setRematchNote(null);
              setRematchBusy(true);
              const err = await requestRematch();
              setRematchBusy(false);
              if (err) {
                setRematchNote(err);
                return;
              }
              router.push('/matchmaking');
            }}
            type="button"
          >
            {rematchBusy ? 'Proponiendo…' : '🔁 Proponer revancha'}
          </button>
        )}
        {rematchNote ? <span className="sx-hint is-bad">{rematchNote}</span> : null}
      </>
    );
    return (
      <AppShell>
        <SalaFinishedScreen finished={match.finished} assets={assets} Link={Link} extra={rematchExtra} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main>
        <SalaRoom
          match={match}
          messages={state.messages}
          roster={roster}
          mains={mains}
          reconnecting={connFails > 0}
          actions={actions}
          assets={assets}
          Link={Link}
        />
      </main>
    </AppShell>
  );
}
