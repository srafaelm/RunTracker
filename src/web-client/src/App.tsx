import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ActivityTypeFilterProvider } from './contexts/ActivityTypeFilterContext';
import Navbar from './components/Navbar';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ActivitiesPage from './features/activities/ActivitiesPage';
import ActivityDetailPage from './features/activities/ActivityDetailPage';
import MapExplorerPage from './features/map/MapExplorerPage';
import ProfilePage from './features/profile/ProfilePage';
import CityListPage from './features/streets/CityListPage';
import CityDetailPage from './features/streets/CityDetailPage';
import TrainingPage from './features/training/TrainingPage';
import TilesPage from './features/tiles/TilesPage';
import YearlyReportPage from './features/stats/YearlyReportPage';
import RacePredictorPage from './features/stats/RacePredictorPage';
import RunningLevelPage from './features/stats/RunningLevelPage';
import TimeOfDayPage from './features/stats/TimeOfDayPage';
import FitnessPage from './features/fitness/FitnessPage';
import ActivityComparisonPage from './features/activities/ActivityComparisonPage';
import BadgesPage from './features/badges/BadgesPage';
import CommunityPage from './features/social/CommunityPage';
import RouteCreatorPage from './features/map/RouteCreatorPage';
import GearPage from './features/gear/GearPage';
import RaceHistoryPage from './features/stats/RaceHistoryPage';
import CalendarPage from './features/training/CalendarPage';
import PaceCalculatorPage from './features/stats/PaceCalculatorPage';
import LoadingSpinner from './components/LoadingSpinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function ProtectedRoute() {
  const { token, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner size="lg" />;
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ActivityTypeFilterProvider>
        <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route element={<AppLayout />}>
                  <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/activities" element={<ActivitiesPage />} />
                    <Route path="/activities/:id" element={<ActivityDetailPage />} />
                    <Route path="/map" element={<MapExplorerPage />} />
                    <Route path="/streets" element={<CityListPage />} />
                    <Route path="/streets/:cityId" element={<CityDetailPage />} />
                    <Route path="/training" element={<TrainingPage />} />
                    <Route path="/tiles" element={<TilesPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/report/:year" element={<YearlyReportPage />} />
                    <Route path="/badges" element={<BadgesPage />} />
                    <Route path="/race-predictor" element={<RacePredictorPage />} />
                    <Route path="/running-level" element={<RunningLevelPage />} />
                    <Route path="/stats/time-of-day" element={<TimeOfDayPage />} />
                    <Route path="/fitness" element={<FitnessPage />} />
                    <Route path="/activities/compare" element={<ActivityComparisonPage />} />
                    <Route path="/community" element={<CommunityPage />} />
                    <Route path="/routes/create" element={<RouteCreatorPage />} />
                    <Route path="/gear" element={<GearPage />} />
                    <Route path="/races" element={<RaceHistoryPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/pace-calculator" element={<PaceCalculatorPage />} />
                  </Route>
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ActivityTypeFilterProvider>
        </QueryClientProvider>
    </ThemeProvider>
  );
}
