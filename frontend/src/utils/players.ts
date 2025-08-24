import { Lobby } from '../types';

export const isHumanish = (p: Lobby['info']['players'][number]) =>
  p && (p as any).player_type !== 'bot';

export const humansOnly = <T extends { player_type?: string }>(players: T[] = []) =>
  players.filter(p => {
    const playerType = p.player_type?.toLowerCase();
    return playerType === 'human' || playerType === 'fakehuman';
  });

export const getPlayerTypeLabel = (type?: string): string => {
  switch ((type || '').toLowerCase()) {
    case 'human': return 'player';
    case 'fakehuman': return 'nation';
    default: return (type || '').toLowerCase(); // fallback for unknown types
  }
};
