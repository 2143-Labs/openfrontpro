import axios from 'axios';
import { Lobby, QueueItem, UserData, UserSummary, UsersResponse } from '../types';

export interface FetchLobbiesParams {
  completed?: boolean | null;
  hasAnalysis?: boolean | null;
  after?: number | null;
  mapName?: string;
}
// default axios client
const client = axios.create({
  // allow envar to toggle local api or remote
  // @ts-ignore
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getLobbies = async (params: FetchLobbiesParams = {}): Promise<Lobby[]> => {
  const { completed, hasAnalysis, after, mapName } = params;

  let res = await client.get<Lobby[]>('/lobbies', {
    params: {
      completed,
      hasAnalysis,
      after, 
      map_name: mapName || undefined,
    },
  }).catch(error => {
      console.error('Error fetching lobbies:', error);
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
  });
  return res.data;
};

export const getGameDetails = async (gameId: string): Promise<Lobby | undefined> => {
  let res = await client.get<Lobby>(`/games/${gameId}`);
  if(res.status === 404) {
    return undefined; // Game not found
  }
  if (!res.data) {
    throw new Error(`Game with ID ${gameId} not found`);
  }
  return res.data;
};

export const getGameAnalysis = async (gameId: string): Promise<any> => {
  let res = await client.get(`/analysis/${gameId}/players`);
  if (res.status === 404) {
    return undefined; // Analysis not found
  }
  if (!res.data) {
    throw new Error(`Analysis for game with ID ${gameId} not found`);
  }
  return res.data;
};

export const getAnalysisQueue = async (): Promise<QueueItem[]> => {
  let res = await client.get<any[]>('/analysis_queue');
  if (!Array.isArray(res.data)) {
    throw new Error('Invalid response format for analysis queue');
  }
  return res.data;
};

export const markGameForAnalysis = async (gameId: string) => {
  let res = await client.post(`/games/${gameId}/analyze`);
  return res.data;
};

export const unmarkGameForAnalysis = async (gameId: string) => {
  let res = await client.delete(`/games/${gameId}/analyze`);
  return res.data;
};

export const getUser = async (userId: string): Promise<UserData> => {
  let res = await client.get<UserData>(`/users/${userId}`);
  return res.data;
};

export const getAllUsers = async (): Promise<UserSummary[]> => {
  let res = await client.get<UsersResponse>('/users');
  if (!res.data || !Array.isArray(res.data.users)) {
    return [];
  }
  return res.data.users;
};
