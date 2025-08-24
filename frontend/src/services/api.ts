import { Lobby, UserData, UserSummary, UsersResponse, ConstructionEventsResponse, AnalysisQueueEntry } from '../types';

// In-memory user cache for session-based caching
const userCache = new Map<string, { data: UserData; fetchedAt: number }>();

// Cache TTL in milliseconds (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

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

export const fetchAnalysisQueue = async (): Promise<AnalysisQueueEntry[]> => {
  const res = await fetch('/api/v1/analysis_queue');
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return await res.json();
};

export const fetchConstructionEvents = async (gameId: string): Promise<ConstructionEventsResponse> => {
  const url = new URL(`/api/v1/analysis/${gameId}/get_construction_events`, window.location.origin);
  const res = await fetch(url.toString());
  
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  
  return await res.json();
};

// User cache helper functions
export const getCachedUser = (id: string): UserData | null => {
  const cached = userCache.get(id);
  if (!cached) return null;
  
  // Check if cache entry is expired
  if (Date.now() - cached.fetchedAt > CACHE_TTL) {
    userCache.delete(id);
    return null;
  }
  
  return cached.data;
};

export const cacheUser = (data: UserData): void => {
  userCache.set(data.user_id, { data, fetchedAt: Date.now() });
};

export const clearUserCache = (): void => {
  userCache.clear();
};

// Enhanced user fetching with caching
export const fetchUserIfNeeded = async (id: string): Promise<UserData> => {
  const cached = getCachedUser(id);
  if (cached) return cached;
  
  const data = await fetchUser(id);
  cacheUser(data);
  return data;
};

// Batch fetch multiple users with caching and parallel loading
export const fetchUsersBatch = async (ids: string[]): Promise<Record<string, UserData | Error>> => {
  const promises = ids.map(id =>
    fetchUserIfNeeded(id)
      .then(data => ({ id, data }))
      .catch(error => ({ id, error }))
  );
  
  const settled = await Promise.all(promises);
  
  return Object.fromEntries(
    settled.map(result => [
      result.id, 
      'error' in result ? result.error : result.data
    ])
  );
};

