import { Lobby, UserData, UserSummary, UsersResponse } from '../types';

export interface FetchLobbiesParams {
  completed?: boolean | null;
  hasAnalysis?: boolean | null;
  after?: number | null;
  mapName?: string;
}

export const fetchLobbies = async (params: FetchLobbiesParams = {}): Promise<Lobby[]> => {
  const { completed, hasAnalysis, after, mapName } = params;
  
  // Build URL with query parameters
  const url = new URL('/api/v1/lobbies', window.location.origin);
  
  if (completed !== null && completed !== undefined) {
    url.searchParams.append('completed', completed.toString());
  }
  
  if (hasAnalysis !== null && hasAnalysis !== undefined) {
    url.searchParams.append('has_analysis', hasAnalysis.toString());
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
  const url = new URL(`/api/v1/games/${gameId}/analyze`, window.location.origin);
  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
};

export const unmarkGameForAnalysis = async (gameId: string) => {
  const url = new URL(`/api/v1/games/${gameId}/analyze`, window.location.origin);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
};

export const fetchUser = async (userId: string): Promise<UserData> => {
  const res = await fetch(`/api/v1/users/${userId}`);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return await res.json();
};

export const fetchAllUsers = async (): Promise<UserSummary[]> => {
  const res = await fetch('/api/v1/users');
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  
  const data: UsersResponse = await res.json();
  
  // Validate response shape and return users array with empty array fallback
  if (data && typeof data === 'object' && Array.isArray(data.users)) {
    return data.users;
  }
  
  return [];
};
