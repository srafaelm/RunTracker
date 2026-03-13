import axios from 'axios';
import type {
  ActivityDaySummary,
  ActivityDetail,
  ActivitySummary,
  AllTimeStats,
  AuthResponse,
  ExplorationStats,
  Badge,
  BadgeAdmin,
  BadgeWithStatus,
  TimeOfDayStats,
  CityDetail,
  CreatePlannedRouteRequest,
  FeedActivity,
  LeaderboardEntry,
  MultiYearStats,
  CityGeoJson,
  CityListItem,
  CreateWorkoutData,
  ImportCityRequest,
  ImportCityResponse,
  PaceTrend,
  PaginatedList,
  PersonalRecord,
  PlannedRoute,
  RunningLevel,
  RecentPredictions,
  ScheduledWorkout,
  SportType,
  StravaCredentials,
  WeightEntry,
  AddWeightEntryData,
  StreetItem,
  Tag,
  TileGeoJson,
  TileStats,
  UpdateProfileData,
  UserProfile,
  UserSummary,
  StravaSyncDetail,
  WeeklyStats,
  WorkoutComparison,
  YearlyStats,
  Gear,
  CreateGearRequest,
  UpdateGearRequest,
  AbsenceDay,
  CreateAbsenceDayData,
  YearInfographic,
  DashboardTemplate,
  CreateDashboardTemplateData,
  UpdateDashboardTemplateData,
  BenchmarkItem,
  BenchmarkCompletion,
  BenchmarkHistoryEntry,
  RouteSuggestion,
  AdvancedExploration,
  UserTrainingTemplate,
  CreateUserTemplateData,
} from '../types';

const api = axios.create({
  baseURL: '/api',
});

// JWT interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ userId: string }>('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  getMe: () => api.get<UserProfile>('/auth/me'),
  updateProfile: (data: UpdateProfileData) =>
    api.put<UserProfile>('/auth/profile', data),
  getStravaConnectUrl: () => api.get<{ url: string }>('/auth/strava/connect'),
  syncStrava: () => api.post<{ message: string }>('/auth/strava/sync'),
  getSyncStatus: () => api.get<StravaSyncDetail>('/auth/strava/sync-status'),
  uploadProfilePicture: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ url: string }>('/auth/profile/picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Activities
export const activitiesApi = {
  getList: (params: {
    page?: number;
    pageSize?: number;
    sportType?: SportType;
    from?: string;
    to?: string;
    tagIds?: string[];
    sortBy?: string;
    sortDesc?: boolean;
    search?: string;
  }) => {
    const { tagIds, ...rest } = params;
    const p: Record<string, unknown> = { ...rest };
    if (tagIds && tagIds.length > 0) p.tagIds = tagIds.join(',');
    return api.get<PaginatedList<ActivitySummary>>('/activities', { params: p });
  },
  getDetail: (id: string) => api.get<ActivityDetail>(`/activities/${id}`),
  exportCsv: (params: { count?: number; fields?: string[]; from?: string; to?: string }) => {
    const p: Record<string, unknown> = {};
    if (params.count != null) p.count = params.count;
    if (params.from) p.from = params.from;
    if (params.to) p.to = params.to;
    if (params.fields && params.fields.length > 0) p.fields = params.fields.join(',');
    return api.get<Blob>('/activities/export', { params: p, responseType: 'blob' });
  },
  importGpx: (file: File, name?: string, sportType?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    if (sportType != null) form.append('sportType', String(sportType));
    return api.post<ActivityDetail>('/activities/import/gpx', form);
  },
  fetchWeather: (activityId: string) =>
    api.post<{ tempC: number; humidityPct: number; windSpeedKmh: number; condition: string }>(
      `/activities/${activityId}/weather`
    ),
  getIntervalAnalysis: (activityId: string) =>
    api.get<import('../types').IntervalAnalysis>(`/activities/${activityId}/intervals`),
};

// Statistics
export const statisticsApi = {
  getYearly: (year: number, sportType?: number, tagIds?: string[]) =>
    api.get<YearlyStats>(`/statistics/yearly/${year}`, { params: { ...(sportType != null ? { sportType } : {}), ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}) } }),
  getWeekly: (year: number, sportType?: number, tagIds?: string[]) =>
    api.get<WeeklyStats>(`/statistics/weekly/${year}`, { params: { ...(sportType != null ? { sportType } : {}), ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}) } }),
  getAllTime: (sportType?: number, tagIds?: string[]) =>
    api.get<AllTimeStats>('/statistics/alltime', { params: { ...(sportType != null ? { sportType } : {}), ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}) } }),
  getPersonalRecords: (year?: number) =>
    api.get<PersonalRecord[]>('/statistics/personal-records', { params: year != null ? { year } : undefined }),
  getPaceTrend: (period?: string, sportType?: number, tagIds?: string[], year?: number) =>
    api.get<PaceTrend>('/statistics/pace-trend', { params: { period, ...(sportType != null ? { sportType } : {}), ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}), ...(year != null ? { year } : {}) } }),
  getMultiYear: (sportType?: number, tagIds?: string[]) =>
    api.get<MultiYearStats[]>('/statistics/multi-year', { params: { ...(sportType != null ? { sportType } : {}), ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}) } }),
  getActivityDays: (sportType?: number) =>
    api.get<ActivityDaySummary[]>('/statistics/activity-days', { params: sportType != null ? { sportType } : undefined }),
  getRunningLevel: () => api.get<RunningLevel>('/statistics/running-level'),
  getExploration: () => api.get<ExplorationStats>('/statistics/exploration'),
  getRecentPredictions: (days: number, tagIds?: string[], useWeighting?: boolean) =>
    api.get<RecentPredictions>('/statistics/recent-predictions', {
      params: {
        days,
        ...(tagIds && tagIds.length > 0 ? { tagIds: tagIds.join(',') } : {}),
        ...(useWeighting ? { useWeighting: true } : {}),
      }
    }),
  getYearInfographic: (year: number) =>
    api.get<YearInfographic>('/statistics/year-infographic', { params: { year } }),
  getTimeOfDayStats: (sportType?: number) =>
    api.get<TimeOfDayStats>('/statistics/time-of-day', { params: sportType != null ? { sportType } : undefined }),
  getTrainingLoad: (sportType?: number) =>
    api.get<import('../types').TrainingLoad>('/statistics/training-load', { params: sportType != null ? { sportType } : undefined }),
  getVo2max: () =>
    api.get<import('../types').Vo2max>('/statistics/vo2max'),
  getVo2maxSnapshots: () =>
    api.get<import('../types').Vo2maxSnapshot[]>('/statistics/vo2max/snapshots'),
};

// Cities / Street Coverage
export const citiesApi = {
  getList: () => api.get<CityListItem[]>('/cities'),
  getDetail: (id: string) => api.get<CityDetail>(`/cities/${id}`),
  getStreets: (id: string, params?: { page?: number; pageSize?: number }) =>
    api.get<PaginatedList<StreetItem>>(`/cities/${id}/streets`, { params }),
  getGeoJson: (id: string) => api.get<CityGeoJson>(`/cities/${id}/geojson`),
  importCity: (data: ImportCityRequest) =>
    api.post<ImportCityResponse>('/cities/import', data),
  reprocessActivities: () =>
    api.post<{ matchedNodes: number; message: string }>('/cities/reprocess'),
  getRouteSuggestion: (id: string, lat?: number, lon?: number, radiusKm?: number) =>
    api.get<RouteSuggestion>(`/cities/${id}/route-suggestion`, {
      params: { ...(lat != null ? { lat } : {}), ...(lon != null ? { lon } : {}), ...(radiusKm != null ? { radiusKm } : {}) },
    }),
};

// Training schedule
export const trainingApi = {
  getList: (from: string, to: string) =>
    api.get<ScheduledWorkout[]>('/training', { params: { from, to } }),
  create: (data: CreateWorkoutData) =>
    api.post<ScheduledWorkout>('/training', data),
  update: (id: string, data: CreateWorkoutData) =>
    api.put<ScheduledWorkout>(`/training/${id}`, data),
  remove: (id: string) =>
    api.delete(`/training/${id}`),
  duplicate: (id: string, targetDate: string) =>
    api.post<ScheduledWorkout>(`/training/${id}/duplicate`, { targetDate }),
  exportCsv: (from?: string, to?: string, format?: 'vertical' | 'horizontal') =>
    api.get<Blob>('/training/export', { params: { from, to, format }, responseType: 'blob' }),
  importWorkouts: (workouts: CreateWorkoutData[]) =>
    api.post<{ count: number }>('/training/import', { workouts }),
  getComparison: (id: string) =>
    api.get<WorkoutComparison>(`/training/${id}/comparison`),
  getComparisons: (from: string, to: string) =>
    api.get<WorkoutComparison[]>('/training/comparisons', { params: { from, to } }),
  getPlanTemplates: () =>
    api.get<{ id: string; name: string; description: string; weeksCount: number; totalDistanceMeters: number; workouts: { daysFromRace: number; title: string; workoutType: number; distanceMeters: number | null; notes: string | null }[] }[]>('/training/plan-templates'),
  applyPlanTemplate: (planId: string, raceDate: string, intensityMultiplier?: number) =>
    api.post<{ created: number }>(`/training/plan-templates/${planId}/apply`, { raceDate, intensityMultiplier }),
  getRaces: () =>
    api.get<ScheduledWorkout[]>('/training/races'),
};

// Absence days
export const absenceApi = {
  getList: (from: string, to: string) =>
    api.get<AbsenceDay[]>('/absence', { params: { from, to } }),
  create: (data: CreateAbsenceDayData) =>
    api.post<AbsenceDay>('/absence', data),
  remove: (id: string) =>
    api.delete(`/absence/${id}`),
};

// Dashboard Templates
export const dashboardApi = {
  getTemplates: () => api.get<DashboardTemplate[]>('/dashboard/templates'),
  create: (data: CreateDashboardTemplateData) => api.post<DashboardTemplate>('/dashboard/templates', data),
  update: (id: string, data: UpdateDashboardTemplateData) => api.put<DashboardTemplate>(`/dashboard/templates/${id}`, data),
  remove: (id: string) => api.delete(`/dashboard/templates/${id}`),
  activate: (id: string) => api.post(`/dashboard/templates/${id}/activate`),
};

// Tiles
export const tilesApi = {
  getStats: () => api.get<TileStats>('/tiles/stats'),
  getGeoJson: () => api.get<TileGeoJson>('/tiles/geojson'),
  reprocess: () => api.post<{ message: string }>('/tiles/reprocess'),
  getAdvancedStats: () => api.get<AdvancedExploration>('/tiles/advanced-stats'),
};

// Multi-source import
export const importApi = {
  importTcx: (file: File, name?: string, sportType?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    if (sportType != null) form.append('sportType', String(sportType));
    return api.post<ActivityDetail>('/activities/import/tcx', form);
  },
  importAppleHealth: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ imported: number; skipped: number }>('/activities/import/apple-health', form);
  },
};

// Badges
export const badgesApi = {
  getAll: () => api.get<Badge[]>('/badges'),
  getAllWithStatus: () => api.get<BadgeWithStatus[]>('/badges/all'),
  recalculate: () => api.post('/badges/recalculate'),
  adminGetAll: () => api.get<BadgeAdmin[]>('/admin/badges'),
  adminArchive: (id: number) => api.put(`/admin/badges/${id}/archive`),
  adminUnarchive: (id: number) => api.put(`/admin/badges/${id}/unarchive`),
  adminUpdateSortOrder: (id: number, sortOrder: number) =>
    api.patch(`/admin/badges/${id}/sort-order`, { sortOrder }),
};

// Tags
export const tagsApi = {
  getAll: () => api.get<Tag[]>('/tags'),
  create: (name: string, color?: string) => api.post<Tag>('/tags', { name, color }),
  remove: (id: string) => api.delete(`/tags/${id}`),
  getForActivity: (activityId: string) => api.get<Tag[]>(`/tags/activity/${activityId}`),
  addToActivity: (activityId: string, tagId: string) => api.post(`/tags/activity/${activityId}/${tagId}`),
  removeFromActivity: (activityId: string, tagId: string) => api.delete(`/tags/activity/${activityId}/${tagId}`),
};

// Social
export const socialApi = {
  follow: (targetUserId: string) => api.post(`/social/follow/${targetUserId}`),
  unfollow: (targetUserId: string) => api.delete(`/social/follow/${targetUserId}`),
  getFollowing: () => api.get<UserSummary[]>('/social/following'),
  getFollowers: () => api.get<UserSummary[]>('/social/followers'),
  getLeaderboard: (period?: string) => api.get<LeaderboardEntry[]>('/social/leaderboard', { params: { period } }),
  getFeed: (page?: number) => api.get<FeedActivity[]>('/social/feed', { params: { page } }),
  searchUsers: (q: string) => api.get<UserSummary[]>('/social/users/search', { params: { q } }),
};

// Planned Routes
export const plannedRoutesApi = {
  getAll: () => api.get<PlannedRoute[]>('/routes'),
  get: (id: string) => api.get<PlannedRoute>(`/routes/${id}`),
  create: (data: CreatePlannedRouteRequest) => api.post<PlannedRoute>('/routes', data),
  remove: (id: string) => api.delete(`/routes/${id}`),
  generate: (data: { startLat: number; startLng: number; targetDistanceM: number; seed: number }) =>
    api.post<{ waypoints: [number, number][]; actualDistanceM: number; source: string }>('/routes/generate', data),
};

// Gear
export const gearApi = {
  getAll: () => api.get<Gear[]>('/gear'),
  get: (id: string) => api.get<Gear>(`/gear/${id}`),
  create: (data: CreateGearRequest) => api.post<Gear>('/gear', data),
  update: (id: string, data: UpdateGearRequest) => api.put<Gear>(`/gear/${id}`, data),
  remove: (id: string) => api.delete(`/gear/${id}`),
  assignToActivity: (activityId: string, gearId: string | null) =>
    api.post('/gear/assign', { activityId, gearId }),
  getShoeAnalysis: (id: string) =>
    api.get<import('../types').ShoeAnalysis>(`/gear/${id}/shoe-analysis`),
};

// Fitness Benchmarks
export const benchmarkApi = {
  getItems: () => api.get<BenchmarkItem[]>('/benchmarks/items'),
  createItem: (data: { name: string; category?: string; sortOrder?: number }) =>
    api.post<BenchmarkItem>('/benchmarks/items', data),
  updateItem: (id: string, data: { name: string; category?: string; sortOrder: number; isActive: boolean }) =>
    api.put<BenchmarkItem>(`/benchmarks/items/${id}`, data),
  deleteItem: (id: string) => api.delete(`/benchmarks/items/${id}`),
  logCompletion: (itemId: string, data?: { date?: string; notes?: string }) =>
    api.post<BenchmarkCompletion>(`/benchmarks/items/${itemId}/complete`, data ?? {}),
  deleteCompletion: (completionId: string) => api.delete(`/benchmarks/completions/${completionId}`),
  getHistory: (from?: string, to?: string) =>
    api.get<BenchmarkHistoryEntry[]>('/benchmarks/history', { params: { from, to } }),
};

// Settings (F1 — Strava credential management)
export const settingsApi = {
  getStravaCredentials: () => api.get<StravaCredentials>('/settings/strava'),
  updateStravaCredentials: (clientId: string | null, clientSecret: string | null) =>
    api.put<StravaCredentials>('/settings/strava', { clientId, clientSecret }),
};

export const goalsApi = {
  getAll: () => api.get<import('../types').Goal[]>('/goals'),
  create: (sportType: number | null, period: number, targetDistanceKm: number) =>
    api.post<import('../types').Goal>('/goals', { sportType, period, targetDistanceKm }),
  update: (id: string, targetDistanceKm: number) =>
    api.put(`/goals/${id}`, { targetDistanceKm }),
  remove: (id: string) => api.delete(`/goals/${id}`),
  getHistory: () => api.get<import('../types').GoalHistory>('/goals/history'),
};

export const weightApi = {
  getLog: () => api.get<WeightEntry[]>('/weight-log'),
  add: (data: AddWeightEntryData) => api.post<WeightEntry>('/weight-log', data),
  remove: (id: string) => api.delete(`/weight-log/${id}`),
};

export const userTemplatesApi = {
  getAll: () => api.get<UserTrainingTemplate[]>('/training-templates'),
  create: (data: CreateUserTemplateData) => api.post<UserTrainingTemplate>('/training-templates', data),
  update: (id: string, data: CreateUserTemplateData) => api.put<UserTrainingTemplate>(`/training-templates/${id}`, data),
  remove: (id: string) => api.delete(`/training-templates/${id}`),
  apply: (id: string, raceDate: string, intensityMultiplier?: number) =>
    api.post<{ created: number }>(`/training-templates/${id}/apply`, { raceDate, intensityMultiplier }),
};

export default api;
