'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type RankPlayer = { id?: number | string; ranking: number; gamerTag: string; sponsor?: string; character?: string; avatarUrl?: string; points: number };

export function PlayerAvatar({ player, size = 'sm' }: { player: RankPlayer; size?: 'sm' | 'lg' }) {
  return <div className={`rank-avatar ${size === 'lg' ? 'rank-avatar-lg' : ''}`}><img src={player.avatarUrl || '/logo-Hot.jpg'} alt="" /></div>;
}

export default function RankingRow({ player }: { player: RankPlayer }) {
  const content = <><span className="rank-number">{String(player.ranking).padStart(2, '0')}</span><PlayerAvatar player={player} /><span className="rank-name">{player.sponsor ? <b>{player.sponsor} | </b> : null}{player.gamerTag}</span><span className="rank-team">{player.character || '—'}</span><strong className="rank-points">{player.points}<small> PTS</small></strong><ChevronRight className="rank-chevron" size={16} /></>;
  return player.id ? <Link href={`/perfil/${player.id}`} className="ranking-row">{content}</Link> : <div className="ranking-row">{content}</div>;
}
