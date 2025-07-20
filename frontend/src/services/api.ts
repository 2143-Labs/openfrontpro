import { Lobby } from '../types';

export interface FetchLobbiesParams {
  completed?: boolean | null;
  after?: number | null;
  mapName?: string;
}

export const fetchLobbies = async (params: FetchLobbiesParams = {}): Promise<Lobby[]> => {
  const { completed, after, mapName } = params;
  
  // Build URL with query parameters
  const url = new URL('/api/v1/lobbies', window.location.origin);
  
  if (completed !== null && completed !== undefined) {
    url.searchParams.append('completed', completed.toString());
  }
  
  if (after !== null && after !== undefined) {
    url.searchParams.append('after', after.toString());
  }
  
  if (mapName) {
    url.searchParams.append('map_name', mapName);
  }
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const raw = await response.json();
  const data = Array.isArray(raw) ? raw : [];
  
  // Return lobbies with standardized PlayerTeams type
  return data;
};

export const markGameForAnalysis = async (gameId: string) => {
  const url = new URL(`/api/v1/game/${gameId}/analyze`, window.location.origin);
  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
};

export const unmarkGameForAnalysis = async (gameId: string) => {
  const url = new URL(`/api/v1/game/${gameId}/analyze`, window.location.origin);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
};
