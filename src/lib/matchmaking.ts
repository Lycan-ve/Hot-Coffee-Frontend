import { API_URL, getToken, RankInfo } from './auth';

export interface QueuePlayer {
  discordId: string;
  tag: string;
  avatarUrl: string;
  points: number;
  rank: RankInfo;
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
  queue?: { ft: number; since: string; players: number; radius: number };
  proposal?: QueueProposal;
  match?: { id: number; threadId: string; threadUrl: string };
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

export const joinQueue = (ft: 3 | 5) => postAction('/api/matchmaking/queue/join', { ft });
export const leaveQueue = () => postAction('/api/matchmaking/queue/leave');
export const acceptProposal = () => postAction('/api/matchmaking/accept');
export const declineProposal = () => postAction('/api/matchmaking/decline');