import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { SportType } from '../types';

interface ActivityTypeFilterContextValue {
  globalSportType: SportType | undefined;
  setGlobalSportType: (t: SportType | undefined) => void;
  globalTagIds: string[];
  setGlobalTagIds: (ids: string[]) => void;
}

const ActivityTypeFilterContext = createContext<ActivityTypeFilterContextValue>({
  globalSportType: undefined,
  setGlobalSportType: () => {},
  globalTagIds: [],
  setGlobalTagIds: () => {},
});

const STORAGE_KEY = 'runtracker_global_sport_type';
const TAG_STORAGE_KEY = 'runtracker_global_tag_ids';
const ALL_SENTINEL = 'all'; // stored when user explicitly picks "All"

function readSportTypeFromStorage(): SportType | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return SportType.Run; // new user: default to Run
  if (raw === ALL_SENTINEL) return undefined;
  const n = parseInt(raw);
  return isNaN(n) ? undefined : n as SportType;
}

function readTagIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function ActivityTypeFilterProvider({ children }: { children: ReactNode }) {
  const [globalSportType, setGlobalSportTypeState] = useState<SportType | undefined>(readSportTypeFromStorage);
  const [globalTagIds, setGlobalTagIdsState] = useState<string[]>(readTagIdsFromStorage);

  function setGlobalSportType(t: SportType | undefined) {
    setGlobalSportTypeState(t);
    localStorage.setItem(STORAGE_KEY, t === undefined ? ALL_SENTINEL : String(t));
  }

  function setGlobalTagIds(ids: string[]) {
    setGlobalTagIdsState(ids);
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(ids));
  }

  return (
    <ActivityTypeFilterContext.Provider value={{ globalSportType, setGlobalSportType, globalTagIds, setGlobalTagIds }}>
      {children}
    </ActivityTypeFilterContext.Provider>
  );
}

export function useActivityTypeFilter() {
  return useContext(ActivityTypeFilterContext);
}
