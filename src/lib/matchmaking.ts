import { API_URL, getToken, RankInfo } from './auth';

export interface QueuePlayer {
  discordId: string;
  tag: string;
  avatarUrl: string;
  points: number;
  rank: RankInfo;
  /** Nacionalidad (ISO 3166-1 alpha-2) para la bandera del VS. */
  country?: string;
  /** Estado/provincia (ISO 3166-2) para la segunda bandera del VS. */
  state?: string;
  // Récord y racha del jugador (contexto del VS; 0 si nunca jugó).
  wins?: number;
  losses?: number;
  streak?: number;
}

export interface QueueProposal {
  id: number;
  ft: number;
  pointsAtStake: number;
  me: QueuePlayer;
  opponent: QueuePlayer;
  acceptedByMe: boolean;
  acceptedByOpponent: boolean;
  expiresAt: string;
}

export interface QueueState {
  status: 'idle' | 'searching' | 'found' | 'confirmed' | 'matched' | 'failed';
  queue?: { ft: number; since: string; players: number; radius: number; wide?: boolean };
  proposal?: QueueProposal;
  match?: { id: number; threadId: string; threadUrl: string; web: boolean };
}

async function authFetch(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error('no-autenticado');
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function getQueueState(): Promise<QueueState | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/matchmaking/queue/state`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as QueueState;
  } catch {
    return null;
  }
}

async function postAction(path: string, body?: unknown): Promise<string | null> {
  try {
    const res = await authFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.message || 'Ocurrió un error. Intenta de nuevo.';
  } catch {
    return 'No se pudo conectar con el servidor.';
  }
}

// Todos los sets ahora son FT 3 (partidas equitativas por rango).
export const joinQueue = () => postAction('/api/matchmaking/queue/join', { ft: 3 });
export const leaveQueue = () => postAction('/api/matchmaking/queue/leave');
export const acceptProposal = () => postAction('/api/matchmaking/accept');
export const declineProposal = () => postAction('/api/matchmaking/decline');