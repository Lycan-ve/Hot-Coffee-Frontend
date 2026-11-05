import { API_URL, getToken, RankInfo } from './auth';

export interface SalaTeam {
  char1: string;
  char2: string;
  fuse: string;
  char1Name: string;
  char2Name: string;
  fuseName: string;
  complete: boolean;
}

export interface SalaPlayer {
  discordId: string;
  tag: string;
  avatarUrl: string;
  points: number;
  rank: RankInfo;
  score: number;
  team: SalaTeam;
}

export interface SalaPending {
  kind: 'game' | 'final' | 'correct';
  byMe: boolean;
  proposerTag: string;
  winnerSide?: 'p1' | 'p2';
  finalMine?: number;
  finalOpp?: number;
}

export interface SalaClose {
  byMe: boolean;
  requestedBy: string;
  leader: string;
  leaderIsMe: boolean;
  tie: boolean;
  requestedAt: string;
}

export interface SalaFinished {
  status: 'FINISHED' | 'CANCELLED';
  won?: boolean;
  myScore: number;
  oppScore: number;
  delta?: number;
  myPoints?: number;
  rank?: RankInfo;
  winnerTag?: string;
}

export interface SalaMatch {
  id: number;
  ft: number;
  pointsAtStake: number;
  roomCode: string;
  status: 'IN_PROGRESS' | 'PENDING_VERIFY' | 'PENDING_CLOSE' | 'FINISHED' | 'CANCELLED';
  mySide: 'p1' | 'p2';
  me: SalaPlayer;
  opponent: SalaPlayer;
  roundHistory: number[];
  pending: SalaPending | null;
  close: SalaClose | null;
  finished: SalaFinished | null;
}

export interface SalaMessage {
  id: number;
  mine: boolean;
  senderTag: string;
  content: string;
  createdAt: string;
}

export interface SalaState {
  match: SalaMatch | null;
  messages: SalaMessage[];
  lastMessageId: number;
}

export interface RosterEntry {
  id: string;
  name: string;
}

async function authFetch(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error('no-autenticado');
  return fetch(API_URL + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  });
}

export async function getSalaState(after: number): Promise<SalaState | null> {
  try {
    const res = await authFetch('/api/matchmaking/match/state?after=' + after, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as SalaState;
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

export async function getRoster(): Promise<{ characters: RosterEntry[]; fuses: RosterEntry[] } | null> {
  try {
    const res = await fetch(API_URL + '/api/game/roster', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { characters: RosterEntry[]; fuses: RosterEntry[] };
  } catch {
    return null;
  }
}

export const saveTeam = (char1: string, char2: string, fuse: string) =>
  postAction('/api/matchmaking/match/team', { char1, char2, fuse });

export const saveRoom = (room: string) =>
  postAction('/api/matchmaking/match/room', { room });

export const sendChat = (content: string) =>
  postAction('/api/matchmaking/match/chat', { content });

export const reportGame = (winner: 'me' | 'opponent') =>
  postAction('/api/matchmaking/match/report', { winner });

export const confirmReport = () => postAction('/api/matchmaking/match/report/confirm');
export const rejectReport = () => postAction('/api/matchmaking/match/report/reject');
export const correctLastGame = () => postAction('/api/matchmaking/match/report/correct');

export const reportFinal = (myScore: number, oppScore: number) =>
  postAction('/api/matchmaking/match/report/final', { myScore, oppScore });

export const closeSet = () => postAction('/api/matchmaking/match/close');
export const respondClose = (accept: boolean) =>
  postAction('/api/matchmaking/match/close/respond', { accept });
