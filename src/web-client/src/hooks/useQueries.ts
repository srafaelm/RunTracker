import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activitiesApi, statisticsApi, authApi, citiesApi, trainingApi, tilesApi, badgesApi, tagsApi, socialApi, plannedRoutesApi, gearApi, absenceApi, dashboardApi, settingsApi, goalsApi, importApi, weightApi, userTemplatesApi } from '../api/client';
import type { CreatePlannedRouteRequest, CreateGearRequest, UpdateGearRequest, CreateDashboardTemplateData, UpdateDashboardTemplateData, Tag, ActivityDetail } from '../types';
import type { SportType } from '../types';

export function useActivities(params: {
  page?: number;
  pageSize?: number;
  sportType?: SportType;
  from?: string;
  to?: string;
  tagIds?: string[];
  sortBy?: string;
  sortDesc?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: () => activitiesApi.getList(params).then((r) => r.data),
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => activitiesApi.getDetail(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useYearlyStats(year: number, sportType?: SportType, tagIds?: string[]) {
  return useQuery({
    queryKey: ['stats', 'yearly', year, sportType, tagIds],
    queryFn: () => statisticsApi.getYearly(year, sportType, tagIds).then((r) => r.data),
  });
}

export function useWeeklyStats(year: number, sportType?: SportType, tagIds?: string[]) {
  return useQuery({
    queryKey: ['stats', 'weekly', year, sportType, tagIds],
    queryFn: () => statisticsApi.getWeekly(year, sportType, tagIds).then((r) => r.data),
  });
}

export function useAllTimeStats(sportType?: SportType, tagIds?: string[]) {
  return useQuery({
    queryKey: ['stats', 'alltime', sportType, tagIds],
    queryFn: () => statisticsApi.getAllTime(sportType, tagIds).then((r) => r.data),
  });
}

export function usePersonalRecords(year?: number) {
  return useQuery({
    queryKey: ['stats', 'personal-records', year ?? 'all'],
    queryFn: () => statisticsApi.getPersonalRecords(year).then((r) => r.data),
  });
}

export function usePaceTrend(period?: string, sportType?: SportType, tagIds?: string[]) {
  return useQuery({
    queryKey: ['stats', 'pace-trend', period, sportType, tagIds],
    queryFn: () => statisticsApi.getPaceTrend(period, sportType, tagIds).then((r) => r.data),
  });
}

export function useMultiYearStats(sportType?: SportType, tagIds?: string[]) {
  return useQuery({
    queryKey: ['stats', 'multi-year', sportType, tagIds],
    queryFn: () => statisticsApi.getMultiYear(sportType, tagIds).then((r) => r.data),
    staleTime: 15 * 60 * 1000,
  });
}

export function useActivityDays(sportType?: number) {
  return useQuery({
    queryKey: ['stats', 'activity-days', sportType],
    queryFn: () => statisticsApi.getActivityDays(sportType).then((r) => r.data),
    staleTime: 15 * 60 * 1000,
  });
}

export function useRunningLevel() {
  return useQuery({
    queryKey: ['stats', 'running-level'],
    queryFn: () => statisticsApi.getRunningLevel().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useRecentPredictions(days: number, tagIds?: string[], useWeighting?: boolean) {
  return useQuery({
    queryKey: ['stats', 'recent-predictions', days, tagIds, useWeighting],
    queryFn: () => statisticsApi.getRecentPredictions(days, tagIds, useWeighting).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStravaCredentials() {
  return useQuery({
    queryKey: ['settings', 'strava'],
    queryFn: () => settingsApi.getStravaCredentials().then((r) => r.data),
  });
}

export function useExplorationStats() {
  return useQuery({
    queryKey: ['stats', 'exploration'],
    queryFn: () => statisticsApi.getExploration().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getMe().then((r) => r.data),
    retry: false,
  });
}

export function useStravaSync() {
  return useQuery({
    queryKey: ['strava-sync-status'],
    queryFn: () => authApi.getSyncStatus().then((r) => r.data),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && !data.stravaHistoricalSyncComplete ? 5000 : false;
    },
  });
}

// --- Street Coverage Hooks ---

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: () => citiesApi.getList().then((r) => r.data),
  });
}

export function useCityDetail(id: string) {
  return useQuery({
    queryKey: ['city', id],
    queryFn: () => citiesApi.getDetail(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCityStreets(id: string, params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['city-streets', id, params],
    queryFn: () => citiesApi.getStreets(id, params).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCityGeoJson(id: string) {
  return useQuery({
    queryKey: ['city-geojson', id],
    queryFn: () => citiesApi.getGeoJson(id).then((r) => r.data),
    enabled: !!id,
  });
}

// --- Training Schedule Hooks ---

export function useScheduledWorkouts(from: string, to: string) {
  return useQuery({
    queryKey: ['training', from, to],
    queryFn: () => trainingApi.getList(from, to).then((r) => r.data),
  });
}

export function useWorkoutComparison(id: string | null) {
  return useQuery({
    queryKey: ['workout-comparison', id],
    queryFn: () => trainingApi.getComparison(id!).then((r) => r.data),
    enabled: !!id,
  });
}

export function useWorkoutComparisons(from: string, to: string) {
  return useQuery({
    queryKey: ['workout-comparisons', from, to],
    queryFn: () => trainingApi.getComparisons(from, to).then((r) => r.data),
  });
}

// --- Absence Day Hooks ---

export function useAbsenceDays(from: string, to: string) {
  return useQuery({
    queryKey: ['absence', from, to],
    queryFn: () => absenceApi.getList(from, to).then((r) => r.data),
  });
}

// --- Tiles Hooks ---

export function useTileStats() {
  return useQuery({
    queryKey: ['tiles', 'stats'],
    queryFn: () => tilesApi.getStats().then((r) => r.data),
  });
}

export function useTileGeoJson() {
  return useQuery({
    queryKey: ['tiles', 'geojson'],
    queryFn: () => tilesApi.getGeoJson().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

// --- Badges Hooks ---

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    queryFn: () => badgesApi.getAll().then((r) => r.data),
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: ['badges', 'all'],
    queryFn: () => badgesApi.getAllWithStatus().then((r) => r.data),
  });
}

// --- Tags Hooks ---

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.getAll().then((r) => r.data),
  });
}

export function useActivityTags(activityId: string) {
  return useQuery({
    queryKey: ['tags', 'activity', activityId],
    queryFn: () => tagsApi.getForActivity(activityId).then((r) => r.data),
    enabled: !!activityId,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => tagsApi.create(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useAddTagToActivity(activityId: string) {
  const qc = useQueryClient();
  const activityKey = ['activity', activityId];
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.addToActivity(activityId, tagId),
    onMutate: async (tagId: string) => {
      await qc.cancelQueries({ queryKey: activityKey });
      const previous = qc.getQueryData<ActivityDetail>(activityKey);
      const allTags = qc.getQueryData<Tag[]>(['tags']) ?? [];
      const tag = allTags.find((t) => t.id === tagId);
      if (tag && previous) {
        qc.setQueryData<ActivityDetail>(activityKey, { ...previous, tags: [...(previous.tags ?? []), tag] });
      }
      return { previous };
    },
    onError: (_err, _tagId, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activityKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: activityKey }),
  });
}

export function useRemoveTagFromActivity(activityId: string) {
  const qc = useQueryClient();
  const activityKey = ['activity', activityId];
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.removeFromActivity(activityId, tagId),
    onMutate: async (tagId: string) => {
      await qc.cancelQueries({ queryKey: activityKey });
      const previous = qc.getQueryData<ActivityDetail>(activityKey);
      if (previous) {
        qc.setQueryData<ActivityDetail>(activityKey, { ...previous, tags: (previous.tags ?? []).filter((t) => t.id !== tagId) });
      }
      return { previous };
    },
    onError: (_err, _tagId, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activityKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: activityKey }),
  });
}

// --- Social Hooks ---

export function useFollowing() {
  return useQuery({
    queryKey: ['social', 'following'],
    queryFn: () => socialApi.getFollowing().then((r) => r.data),
  });
}

export function useFollowers() {
  return useQuery({
    queryKey: ['social', 'followers'],
    queryFn: () => socialApi.getFollowers().then((r) => r.data),
  });
}

export function useLeaderboard(period?: string) {
  return useQuery({
    queryKey: ['social', 'leaderboard', period],
    queryFn: () => socialApi.getLeaderboard(period).then((r) => r.data),
  });
}

export function useFriendFeed(page?: number) {
  return useQuery({
    queryKey: ['social', 'feed', page],
    queryFn: () => socialApi.getFeed(page).then((r) => r.data),
  });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ['social', 'search', q],
    queryFn: () => socialApi.searchUsers(q).then((r) => r.data),
    enabled: q.length >= 2,
  });
}

export function useFollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => socialApi.follow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

export function useUnfollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => socialApi.unfollow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

// --- Planned Routes Hooks ---

export function usePlannedRoutes() {
  return useQuery({
    queryKey: ['planned-routes'],
    queryFn: () => plannedRoutesApi.getAll().then((r) => r.data),
  });
}

export function useCreatePlannedRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlannedRouteRequest) => plannedRoutesApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planned-routes'] }),
  });
}

export function useDeletePlannedRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannedRoutesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planned-routes'] }),
  });
}

// --- Gear Hooks ---

export function useGear() {
  return useQuery({
    queryKey: ['gear'],
    queryFn: () => gearApi.getAll().then((r) => r.data),
  });
}

export function useCreateGear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGearRequest) => gearApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gear'] }),
  });
}

export function useUpdateGear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGearRequest }) =>
      gearApi.update(id, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gear'] }),
  });
}

export function useDeleteGear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gearApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gear'] }),
  });
}

export function useAssignGear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, gearId }: { activityId: string; gearId: string | null }) =>
      gearApi.assignToActivity(activityId, gearId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gear'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useShoeAnalysis(gearId: string | null) {
  return useQuery({
    queryKey: ['gear', gearId, 'shoe-analysis'],
    queryFn: () => gearApi.getShoeAnalysis(gearId!).then((r) => r.data),
    enabled: !!gearId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useYearInfographic(year: number) {
  return useQuery({
    queryKey: ['stats', 'year-infographic', year],
    queryFn: () => statisticsApi.getYearInfographic(year).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

// --- Dashboard Template Hooks ---

export function useDashboardTemplates() {
  return useQuery({
    queryKey: ['dashboard', 'templates'],
    queryFn: () => dashboardApi.getTemplates().then((r) => r.data),
  });
}

export function useCreateDashboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDashboardTemplateData) => dashboardApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'templates'] }),
  });
}

export function useUpdateDashboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDashboardTemplateData }) =>
      dashboardApi.update(id, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'templates'] }),
  });
}

export function useDeleteDashboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'templates'] }),
  });
}

export function useActivateDashboardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'templates'] }),
  });
}

export function useTimeOfDayStats(sportType?: SportType) {
  return useQuery({
    queryKey: ['stats', 'time-of-day', sportType],
    queryFn: () => statisticsApi.getTimeOfDayStats(sportType).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrainingLoad(sportType?: SportType) {
  return useQuery({
    queryKey: ['stats', 'training-load', sportType],
    queryFn: () => statisticsApi.getTrainingLoad(sportType).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIntervalAnalysis(activityId: string) {
  return useQuery({
    queryKey: ['activity', activityId, 'intervals'],
    queryFn: () => activitiesApi.getIntervalAnalysis(activityId).then((r) => r.data),
    staleTime: 30 * 60 * 1000,
    enabled: !!activityId,
  });
}

export function useVo2max() {
  return useQuery({
    queryKey: ['stats', 'vo2max'],
    queryFn: () => statisticsApi.getVo2max().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useVo2maxSnapshots() {
  return useQuery({
    queryKey: ['stats', 'vo2max', 'snapshots'],
    queryFn: () => statisticsApi.getVo2maxSnapshots().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useFetchActivityWeather(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => activitiesApi.fetchWeather(activityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', activityId] }),
  });
}

// --- Goals ---
export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.getAll().then(r => r.data) });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sportType, period, targetDistanceKm }: { sportType: number | null; period: number; targetDistanceKm: number }) =>
      goalsApi.create(sportType, period, targetDistanceKm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetDistanceKm }: { id: string; targetDistanceKm: number }) =>
      goalsApi.update(id, targetDistanceKm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useGoalHistory() {
  return useQuery({ queryKey: ['goal-history'], queryFn: () => goalsApi.getHistory().then(r => r.data) });
}

// --- Route Suggestion Hook (T18) ---
export function useRouteSuggestion(cityId: string, lat?: number, lon?: number, radiusKm?: number, enabled = false) {
  return useQuery({
    queryKey: ['city-route-suggestion', cityId, lat, lon, radiusKm],
    queryFn: () => citiesApi.getRouteSuggestion(cityId, lat, lon, radiusKm).then((r) => r.data),
    enabled: !!cityId && enabled,
    staleTime: 10 * 60 * 1000,
  });
}

// --- Advanced Exploration Hook (T19) ---
export function useAdvancedExploration() {
  return useQuery({
    queryKey: ['tiles', 'advanced-stats'],
    queryFn: () => tilesApi.getAdvancedStats().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

// --- Multi-Import Mutations (T20) ---
export function useImportTcx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name, sportType }: { file: File; name?: string; sportType?: number }) =>
      importApi.importTcx(file, name, sportType).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useImportAppleHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importApi.importAppleHealth(file).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

// --- Weight Log ---
export function useWeightLog() {
  return useQuery({
    queryKey: ['weight-log'],
    queryFn: () => weightApi.getLog().then((r) => r.data),
  });
}

export function useAddWeightEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; weightKg: number }) =>
      weightApi.add(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weight-log'] }),
  });
}

export function useDeleteWeightEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => weightApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weight-log'] }),
  });
}

// --- Race History ---
export function useRaces() {
  return useQuery({
    queryKey: ['training', 'races'],
    queryFn: () => trainingApi.getRaces().then((r) => r.data),
  });
}

// --- Training mutations (used by RaceHistoryPage) ---
export function useCreateScheduledWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: import('../types').CreateWorkoutData) =>
      trainingApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  });
}

export function useUpdateScheduledWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: import('../types').CreateWorkoutData }) =>
      trainingApi.update(id, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  });
}

export function useDeleteScheduledWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  });
}

// ── User Training Templates ────────────────────────────────────────────────────

export function useUserTemplates() {
  return useQuery({
    queryKey: ['user-templates'],
    queryFn: () => userTemplatesApi.getAll().then(r => r.data),
  });
}

export function useCreateUserTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: import('../types').CreateUserTemplateData) => userTemplatesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-templates'] }),
  });
}

export function useUpdateUserTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: import('../types').CreateUserTemplateData }) =>
      userTemplatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-templates'] }),
  });
}

export function useDeleteUserTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userTemplatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-templates'] }),
  });
}

export function useApplyUserTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, raceDate, intensityMultiplier }: { id: string; raceDate: string; intensityMultiplier?: number }) =>
      userTemplatesApi.apply(id, raceDate, intensityMultiplier),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  });
}
