import { PlayerAvatar, RankPlayer } from './RankingRow';

export default function PodiumRow({ player }: { player: RankPlayer }) {
  const fighter = player.character?.split(',')[0]?.trim();
  return <div className={`podium-row podium-${player.ranking}`}><div className="podium-place">{player.ranking}</div><div className="podium-art">{fighter ? <img src={`/fighters/${fighter[0].toUpperCase()}${fighter.slice(1).toLowerCase()}.png`} alt="" /> : null}</div><PlayerAvatar player={player} size="lg" /><div className="podium-details"><span className="podium-tag">{player.sponsor || 'HC'} | {player.gamerTag}</span><strong>{player.gamerTag}</strong><span>{player.character || 'YASUO + SAMIRA + FUSE'}</span></div><div className="podium-score"><b>{player.points}</b><small>PTS</small></div></div>;
}
