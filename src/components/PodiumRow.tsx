import Image from 'next/image';
import { PlayerAvatar, RankPlayer } from './RankingRow';

export default function PodiumRow({ player }: { player: RankPlayer }) {
  const fighter = player.character?.split(/[,+]/)[0]?.trim().replace(/\s+/g, '');
  const fighterImage = fighter
    ? `/fighters/${fighter[0].toUpperCase()}${fighter.slice(1).toLowerCase()}.png`
    : null;

  return (
    <div
      className={`podium-row podium-${player.ranking}`}
      role="listitem"
      aria-label={`Puesto ${player.ranking}: ${player.gamerTag}, ${player.points} puntos`}
    >
      <div className="podium-place">{player.ranking}</div>
      <div className="podium-art" aria-hidden="true">
        {fighterImage ? <Image src={fighterImage} alt="" width={120} height={170} sizes="120px" /> : null}
      </div>
      <PlayerAvatar player={player} size="lg" />
      <div className="podium-details">
        <span className="podium-tag">{player.sponsor || 'HC'} | {player.gamerTag}</span>
        <strong>{player.gamerTag}</strong>
        <span>{player.character || 'YASUO + SAMIRA + FUSE'}</span>
      </div>
      <div className="podium-score"><b>{player.points}</b><small>PTS</small></div>
    </div>
  );
}
