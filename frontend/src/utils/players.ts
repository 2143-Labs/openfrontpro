import { Lobby } from '../types';

export const isHumanish = (p: Lobby['info']['players'][number]) =>
  p && (p as any).player_type !== 'bot';

export const humansOnly = <T extends { player_type?: string }>(players: T[] = []) =>
  players.filter(p => p.player_type === 'human' || p.player_type === 'fakehuman');
