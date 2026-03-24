export enum SportType {
  Run = 0,
  TrailRun = 1,
  Walk = 2,
  Hike = 3,
  VirtualRun = 4,
  Ride = 5,
  Swim = 6,
  Other = 7,
  VirtualRide = 8,
  WeightTraining = 9,
  Workout = 10,
  Yoga = 11,
  Elliptical = 12,
}

export enum RecordType {
  Fastest1K = 0,
  Fastest5K = 1,
  Fastest10K = 2,
  FastestHalf = 3,
  FastestMarathon = 4,
  LongestRun = 5,
  Fastest100m = 6,
  Fastest400m = 7,
  Fastest800m = 8,
  Fastest3K = 9,
  Fastest15K = 10,
  Fastest30K = 11,
  LongestRunTime = 12,
  Fastest2K = 13,
  Fastest4K = 14,
  Fastest20K = 15,
  LongestRide = 16,
  LongestSwim = 17,
  MostElevation = 18,
  BestRunCadence = 19,
  BestRideCadence = 20,
}

// --- Tags ---
export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface ActivitySummary {
  id: string;
  name: string;
  sportType: SportType;
  startDate: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevationGain: number;
  averageSpeed: number | null;
  maxSpeed: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averageCadence: number | null;
  calories: number | null;
  summaryPolyline: string | null;
  averagePaceMinPerKm: number;
}

export interface ActivityStreamPoint {
  pointIndex: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  time: number | null;
  distance: number | null;
  heartRate: number | null;
  speed: number | null;
  cadence: number | null;
}

export interface ActivityDetail extends ActivitySummary {
  detailedPolyline: string | null;
  streams: ActivityStreamPoint[];
  gearId: string | null;
  tags: Tag[];
  newStreetsDiscovered: number;
  weatherTempC: number | null;
  weatherHumidityPct: number | null;
  weatherWindSpeedKmh: number | null;
  weatherCondition: string | null;
  locationCity: string | null;
}

export interface PaginatedList<T> {
  items: T[];
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface MonthlyBreakdown {
  month: number;
  monthName: string;
  totalDistance: number;
  totalRuns: number;
  totalTimeSeconds: number;
  averagePaceMinPerKm: number;
}

export interface YearlyStats {
  year: number;
  totalDistance: number;
  totalRuns: number;
  totalTimeSeconds: number;
  averagePaceMinPerKm: number;
  totalElevationGain: number;
  longestRunDistance: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export interface WeekBreakdown {
  weekNumber: number;
  weekStart: string;
  totalDistance: number;
  totalRuns: number;
  totalTimeSeconds: number;
  averagePaceMinPerKm: number;
}

export interface WeeklyStats {
  year: number;
  weeks: WeekBreakdown[];
}

export interface PersonalRecord {
  recordType: RecordType;
  value: number;
  activityId: string;
  achievedAt: string;
  displayValue: string;
}

export interface AllTimeStats {
  totalDistance: number;
  totalRuns: number;
  totalTimeSeconds: number;
  averagePaceMinPerKm: number;
  totalElevationGain: number;
  longestRunDistance: number;
  firstRunDate: string | null;
  lastRunDate: string | null;
  personalRecords: PersonalRecord[];
  bestYear: number | null;
  bestYearDistance: number;
  bestMonthLabel: string | null;
  bestMonthDistance: number;
  currentDayStreak: number;
  longestDayStreak: number;
  currentWeekStreak: number;
  longestWeekStreak: number;
}

export enum ActivitySource {
  Strava = 0,
  Manual = 1,
  Garmin = 2,
  GpxImport = 3,
}

export interface HourBucket {
  hour: number;
  label: string;
  count: number;
  avgPaceMinPerKm: number;
  avgDistanceM: number;
}

export interface DayOfWeekBucket {
  dayOfWeek: number;
  dayName: string;
  count: number;
  avgPaceMinPerKm: number;
  avgDistanceM: number;
}

export interface TimeOfDayStats {
  byHour: HourBucket[];
  byDayOfWeek: DayOfWeekBucket[];
}

export interface TrainingLoadPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  dailyLoad: number;
}

// --- Interval Analysis ---
export interface IntervalRep {
  repNumber: number;
  distanceM: number;
  durationSec: number;
  paceMinPerKm: number;
  avgHr: number | null;
  recoveryDurationSec: number;
  recoveryPaceMinPerKm: number | null;
}
export interface PreviousIntervalSession {
  activityId: string;
  activityName: string;
  date: string;
  structure: string;
  avgRepPace: number;
  consistencyPct: number;
}
export interface IntervalAnalysis {
  hasIntervals: boolean;
  structure: string | null;
  repCount: number;
  avgRepDistanceM: number;
  avgRepPaceMinPerKm: number;
  consistencyPct: number;
  reps: IntervalRep[];
  previousSessions: PreviousIntervalSession[];
}

// --- VO2max Estimation ---
export interface Vo2maxTrendPoint { monthLabel: string; vo2max: number; }
export interface Vo2maxSnapshot { date: string; value: number; }

export interface UserTemplateWorkout {
  id: string;
  daysFromRace: number;
  title: string;
  workoutType: WorkoutType;
  distanceMeters: number | null;
  notes: string | null;
}

export interface UserTrainingTemplate {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  workouts: UserTemplateWorkout[];
}

export interface CreateUserTemplateData {
  name: string;
  description?: string | null;
  workouts: {
    daysFromRace: number;
    title: string;
    workoutType: WorkoutType;
    distanceMeters?: number | null;
    notes?: string | null;
  }[];
}
export interface Vo2max {
  vo2max: number | null;
  basedOn: string | null;
  level: string;
  classification: string;
  trend: Vo2maxTrendPoint[];
}

export interface TrainingLoad {
  points: TrainingLoadPoint[];
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
}

export interface MultiYearMonth {
  month: number;
  totalDistance: number;
  totalRuns: number;
}

export interface MultiYearStats {
  year: number;
  totalDistance: number;
  totalRuns: number;
  monthly: MultiYearMonth[];
}

export interface ActivityDaySummary {
  date: string;
  distanceKm: number;
}

export interface ExplorationStats {
  countriesCount: number;
  citiesWithProgress: number;
  completedStreetsTotal: number;
  explorerTilesCount: number;
  tripsToMoon: number;
  tripsAroundEarth: number;
}

export interface PaceTrendPoint {
  periodStart: string;
  periodLabel: string;
  averagePaceMinPerKm: number;
  runCount: number;
}

export interface PaceTrend {
  points: PaceTrendPoint[];
}

export enum HrZoneAlgorithm {
  FiveZonePercentMax = 0,
  FiveZoneKarvonen = 1,
  GarminFiveZone = 2,
  SevenZonePolarized = 3,
  Custom = 4,
}

export enum Gender {
  Unknown = 0,
  Male = 1,
  Female = 2,
  NonBinary = 3,
}

export interface HrZone {
  zone: number;
  label: string;
  lower: number;
  upper: number;
}

export type DashboardWidgetId =
  | 'stats_cards'
  | 'streaks'
  | 'goals'
  | 'recent_activities'
  | 'monthly_chart'
  | 'weekly_chart'
  | 'pace_trend'
  | 'multi_year'
  | 'eddington'
  | 'exploration_stats'
  | 'upcoming_training';

export interface DashboardConfig {
  widgets: DashboardWidgetId[];
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetId[] = [
  'stats_cards', 'streaks', 'goals', 'recent_activities', 'upcoming_training', 'monthly_chart', 'weekly_chart',
  'pace_trend', 'multi_year', 'eddington', 'exploration_stats',
];

export enum GoalPeriod { Week = 0, Month = 1, Year = 2 }

export interface Goal {
  id: string;
  sportType: SportType | null;
  period: GoalPeriod;
  targetDistanceKm: number;
  isActive: boolean;
  currentDistanceKm: number;
  progressPct: number;
}

export interface GoalHistoryMonth {
  month: string;    // 'YYYY-MM'
  goalsTotal: number;
  goalsMet: number;
  pct: number;
}

export interface GoalHistory {
  months: GoalHistoryMonth[];
  consecutiveStreak: number;
}

export interface UserProfile {
  id: string;
  email: string;
  userName: string | null;
  displayName: string | null;
  bio: string | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  heightCm: number | null;
  maxHeartRate: number | null;
  restingHeartRate: number | null;
  hrZoneAlgorithm: HrZoneAlgorithm;
  gender: Gender;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  profilePictureUrl: string | null;
  dashboardConfig: string | null;
  customHrZones: string | null;
  hiddenSportTypes: string | null; // JSON int[]
  homeAddress: string | null;
  homeLat: number | null;
  homeLng: number | null;
  stravaConnected: boolean;
  stravaAthleteId: number | null;
  hrZones: HrZone[] | null;
  stravaSyncStatus: StravaSyncStatus | null;
}

export interface StravaSyncStatus {
  stravaHistoricalSyncComplete: boolean;
  stravaHistoricalSyncCursor: string | null;
  stravaNewestSyncedAt: string | null;
  totalActivities: number | null;
}

/** Detailed sync status fetched on-demand (includes Strava-side totals). */
export interface StravaSyncDetail {
  stravaHistoricalSyncComplete: boolean;
  stravaHistoricalSyncCursor: string | null;
  stravaNewestSyncedAt: string | null;
  localActivityCount: number;
  stravaRunCount: number | null;
  stravaRideCount: number | null;
  stravaSwimCount: number | null;
  /** Sum of run + ride + swim. Does not include other sport types (hiking, etc.). */
  stravaApproxTotal: number | null;
}

export interface UpdateProfileData {
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  weightKg?: number | null;
  goalWeightKg?: number | null;
  heightCm?: number | null;
  maxHeartRate?: number | null;
  restingHeartRate?: number | null;
  hrZoneAlgorithm?: HrZoneAlgorithm | null;
  gender?: Gender | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  dashboardConfig?: string | null;
  customHrZones?: string | null;
  hiddenSportTypes?: string | null;
  homeAddress?: string | null;
  homeLat?: number | null;
  homeLng?: number | null;
}

export interface StravaCredentials {
  clientId: string;
  hasSecret: boolean;
}

// --- Running Level ---
export interface RunningLevelStandard {
  level: string;
  timeDisplay: string;
  userMeetsOrBeats: boolean;
}

export interface RunningLevelDistance {
  distance: string;
  distanceMeters: number;
  userTimeDisplay: string | null;
  userTimeSec: number | null;
  standards: RunningLevelStandard[];
}

export interface RunningLevel {
  distances: RunningLevelDistance[];
  userAgeGroup: string | null;
  hasData: boolean;
}

export interface RecentBasePr {
  distance: string;
  timeSec: number;
  displayTime: string;
  achievedAt: string;
}

export interface RecentPredictedTime {
  distance: string;
  distanceMeters: number;
  predictedSec: number;
  displayTime: string;
  pace: string;
}

export interface RecentPredictions {
  periodDays: number;
  basedOn: RecentBasePr | null;
  predictedTimes: RecentPredictedTime[];
}

export interface AuthResponse {
  token: string;
}

// --- Shoe Rotation Analysis ---
export interface ShoeMonth { monthLabel: string; activityCount: number; totalDistanceKm: number; avgPaceMinPerKm: number; }
export interface ShoeRecentActivity { date: string; name: string; distanceKm: number; }
export interface ShoeRotationPeer { gearId: string; name: string; daysSinceLastUse: number; totalDistanceKm: number; }
export interface ShoeAnalysis {
  gearId: string;
  gearName: string;
  daysSinceLastUse: number;
  totalActivities: number;
  totalDistanceKm: number;
  monthlyTrend: ShoeMonth[];
  recentActivities: ShoeRecentActivity[];
  otherShoes: ShoeRotationPeer[];
}

// --- Planned Routes ---

export interface PlannedRoute {
  id: string;
  name: string;
  description: string | null;
  distanceM: number;
  encodedPolyline: string | null;
  createdAt: string;
}

export interface CreatePlannedRouteRequest {
  name: string;
  description?: string;
  distanceM: number;
  encodedPolyline?: string;
}

// --- Gear Tracking ---

export enum GearType {
  Shoes = 0,
  Bike = 1,
  Watch = 2,
  Other = 3,
}

export interface Gear {
  id: string;
  name: string;
  brand: string | null;
  type: GearType;
  purchaseDate: string | null;
  notes: string | null;
  startingDistanceM: number;
  retirementDistanceM: number | null;
  isRetired: boolean;
  totalDistanceM: number;
  activityCount: number;
  createdAt: string;
}

export interface CreateGearRequest {
  name: string;
  brand?: string;
  type: GearType;
  purchaseDate?: string;
  notes?: string;
  startingDistanceM: number;
  retirementDistanceM?: number;
}

export interface UpdateGearRequest extends CreateGearRequest {
  isRetired: boolean;
}

// --- Street Coverage Types ---

export interface CityListItem {
  id: string;
  name: string;
  region: string | null;
  country: string;
  totalStreets: number;
  totalNodes: number;
  completedStreets: number;
  completedNodes: number;
  completionPercentage: number;
}

export interface CityDetail extends CityListItem {
  osmRelationId: number;
}

export interface StreetItem {
  id: string;
  name: string;
  highwayType: string;
  nodeCount: number;
  totalLengthMeters: number;
  completedNodes: number;
  isCompleted: boolean;
  completionPercentage: number;
}

export interface CityGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: number[][];
    };
    properties: {
      streetId: string;
      name: string;
      highwayType: string;
      isCompleted: boolean;
      completionPercentage: number;
    };
  }>;
}

export interface ImportCityRequest {
  osmRelationId: number;
  name: string;
  region?: string;
  country: string;
}

export interface ImportCityResponse {
  id: string;
  name: string;
  totalStreets: number;
  totalNodes: number;
  message: string;
}

// --- Training Schedule Types ---

export enum WorkoutType {
  Easy = 0,
  Tempo = 1,
  Long = 2,
  Intervals = 3,
  Recovery = 4,
  Rest = 5,
  Race = 6,
  Strength = 7,
  Other = 8,
}

export interface ScheduledWorkout {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  workoutType: WorkoutType;
  sportType?: SportType;
  notes?: string;
  plannedDistanceMeters?: number;
  plannedDurationSeconds?: number;
  plannedPaceSecondsPerKm?: number;
  plannedHeartRateZone?: number;
  createdAt: string;
  // Race-specific fields
  location?: string;
  goalTimeSecs?: number;
  resultTimeSecs?: number;
  raceDistanceMeters?: number;
  linkedActivityId?: string;
}

export interface CreateWorkoutData {
  date: string;
  title: string;
  workoutType: WorkoutType;
  sportType?: SportType;
  notes?: string;
  plannedDistanceMeters?: number;
  plannedDurationSeconds?: number;
  plannedPaceSecondsPerKm?: number;
  plannedHeartRateZone?: number;
  location?: string;
  goalTimeSecs?: number;
  resultTimeSecs?: number;
  raceDistanceMeters?: number;
  linkedActivityId?: string;
}

// --- Weight Log ---

export interface WeightEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  weightKg: number;
}

export interface AddWeightEntryData {
  date: string;
  weightKg: number;
}

// --- Tiles ---

export interface TileStats {
  visitedCount: number;
}

export interface TileGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: {
      tileX: number;
      tileY: number;
    };
  }>;
}

// --- Badges ---

export enum BadgeType {
  // Distance milestones (single run)
  First1K = 5,
  First5K = 1,
  First10K = 2,
  First15K = 6,
  First21K = 3,
  First42K = 4,
  First50K = 7,
  First100K = 8,
  First100Mile = 9,
  // Total distance (running)
  Total100km = 10,
  Total500km = 11,
  Total1000km = 12,
  Total5000km = 13,
  // Activity count (running)
  FirstRun = 20,
  Runs10 = 21,
  Runs50 = 22,
  Runs100 = 23,
  Runs365 = 24,
  Runs1000 = 25,
  // Elevation (single run)
  EverestRun = 30,
  KilimanjaroRun = 31,
  MontBlancRun = 32,
  K2Run = 33,
  // Cumulative elevation
  EverestCumulative = 34,
  Cauberg = 35,
  Vaalserberg = 36,
  MontVentoux = 37,
  Zugspitze = 38,
  Etna = 39,
  // Tile exploration
  Tiles100 = 40,
  Tiles500 = 41,
  Tiles1000 = 42,
  Tiles5000 = 43,
  // Street exploration
  StreetExplorer = 50,
  // Everest levels
  EverestLevel2 = 61,
  EverestLevel3 = 62,
  EverestLevel4 = 63,
  EverestLevel5 = 64,
  EverestLevel6 = 65,
  EverestLevel7 = 66,
  EverestLevel8 = 67,
  EverestLevel9 = 68,
  EverestLevel10 = 69,
  // Cycling
  FirstRide = 70,
  Rides10 = 71,
  Rides50 = 72,
  CyclingTotal100km = 73,
  CyclingTotal500km = 74,
  CyclingTotal1000km = 75,
  // Swimming
  FirstSwim = 76,
  Swims10 = 77,
  SwimTotal10km = 78,
  SwimTotal50km = 79,
  // Walking & Hiking
  FirstWalk = 80,
  Walks10 = 81,
  WalkingTotal100km = 82,
}

export interface Badge {
  badgeType: BadgeType;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface BadgeWithStatus {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  sortOrder: number;
  isEarned: boolean;
  earnedAt: string | null;
  isArchived: boolean;
  activityId: string | null;
}

export interface BadgeAdmin {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  sortOrder: number;
  isArchived: boolean;
}

// --- Absence Days ---

export enum AbsenceType {
  Sick = 0,
  Rest = 1,
  Vacation = 2,
  Injury = 3,
  Other = 4,
}

export interface AbsenceDay {
  id: string;
  date: string; // YYYY-MM-DD
  absenceType: AbsenceType;
  notes: string | null;
}

export interface CreateAbsenceDayData {
  date: string;
  absenceType: AbsenceType;
  notes?: string;
}

// --- Workout Comparison ---

export interface WorkoutComparison {
  workout: ScheduledWorkout;
  activityId: string | null;
  activityName: string | null;
  plannedDistanceM: number | null;
  actualDistanceM: number | null;
  plannedDurationSec: number | null;
  actualDurationSec: number | null;
  plannedPaceSecPerKm: number | null;
  actualPaceSecPerKm: number | null;
  plannedHrZone: number | null;
  actualHrZone: number | null;
  actualAvgHr: number | null;
}

// --- Social ---

export interface UserSummary {
  id: string;
  displayName: string | null;
  email: string | null;
  profilePictureUrl: string | null;
  isFollowing: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  totalDistanceM: number;
  runCount: number;
}

export interface FeedActivity {
  activityId: string;
  userId: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  activityName: string;
  sportType: SportType;
  startDate: string;
  distance: number;
  movingTime: number;
  averagePaceMinPerKm: number;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  widgets: string[];
  isDefault: boolean;
  sortOrder: number;
}

export interface CreateDashboardTemplateData {
  name: string;
  widgets: string[];
}

export interface UpdateDashboardTemplateData {
  name: string;
  widgets: string[];
}

export interface DailyActivitySummary {
  date: string;
  sportType: SportType;
  distanceKm: number;
}

export interface MonthlyBySportType {
  month: number;
  sportType: SportType;
  distanceKm: number;
}

export interface YearInfographic {
  year: number;
  displayName: string;
  userName: string | null;
  profilePictureUrl: string | null;
  totalDistanceKm: number;
  activeDays: number;
  maxStreakDays: number;
  totalHours: number;
  totalElevationM: number;
  everestMultiple: number;
  maxRunDistance: number;
  maxRideDistance: number;
  maxRideElevation: number;
  maxSwimDistance: number;
  maxSwimTimeSec: number;
  maxWalkDistance: number;
  dailyActivitySummaries: DailyActivitySummary[];
  monthlyBreakdownBySportType: MonthlyBySportType[];
}

// Fitness Benchmarks
export interface BenchmarkItem {
  id: string;
  name: string;
  category: string | null;
  sortOrder: number;
  totalCompletions: number;
  lastCompletedAt: string | null;
  lastCompletionId: string | null;
  isActive: boolean;
}

export interface BenchmarkCompletion {
  id: string;
  benchmarkItemId: string;
  itemName: string;
  completedAt: string;
  notes: string | null;
}

export interface BenchmarkHistoryEntry {
  date: string;
  completedCount: number;
  totalActive: number;
  completedItemNames: string[];
}

// --- Route Suggestion (T18) ---
export interface RouteSuggestion {
  encodedPolyline: string | null;
  distanceM: number;
  streetCount: number;
  nodeCount: number;
}

// --- Advanced Exploration (T19) ---
export interface TileCoord { tileX: number; tileY: number; }
export interface AdvancedExploration {
  maxSquareSize: number;
  maxSquareOrigin: TileCoord | null;
  explorerScore: number;
  explorerPercentile: number;
  challengeTile: TileCoord | null;
}

// --- Multi-Source Import (T20) ---
export interface ImportResult {
  id: string;
  name: string;
  distance: number;
  movingTime: number;
  startDate: string;
}
