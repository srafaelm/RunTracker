import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useProfile } from '../hooks/useQueries';
import { useActivityTypeFilter } from '../contexts/ActivityTypeFilterContext';
import { SportType } from '../types';

function Avatar({ size = 8 }: { size?: number }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const initial = (profile?.displayName ?? user?.email ?? '?')[0].toUpperCase();
  // Use inline style for dimensions — dynamic Tailwind classes (w-${n}) are stripped by JIT
  const px = size * 4;
  const sizeStyle: React.CSSProperties = { width: px, height: px, minWidth: px, minHeight: px };
  if (profile?.profilePictureUrl) {
    return (
      <img
        src={profile.profilePictureUrl}
        alt="avatar"
        style={sizeStyle}
        className="rounded-full object-cover border border-gray-200 dark:border-gray-600"
      />
    );
  }
  return (
    <div
      style={sizeStyle}
      className="rounded-full bg-primary-100 dark:bg-primary-900 border border-gray-200 dark:border-gray-600 flex items-center justify-center"
    >
      <span className="text-xs font-bold text-primary-600">{initial}</span>
    </div>
  );
}

const SPORT_PILLS: { label: string; value: SportType | undefined }[] = [
  { label: 'All',            value: undefined },
  { label: 'Run',            value: SportType.Run },
  { label: 'Trail Run',      value: SportType.TrailRun },
  { label: 'Walk',           value: SportType.Walk },
  { label: 'Hike',           value: SportType.Hike },
  { label: 'Virtual Run',    value: SportType.VirtualRun },
  { label: 'Ride',           value: SportType.Ride },
  { label: 'Virtual Ride',   value: SportType.VirtualRide },
  { label: 'Swim',           value: SportType.Swim },
  { label: 'Weight',         value: SportType.WeightTraining },
  { label: 'Workout',        value: SportType.Workout },
  { label: 'Yoga',           value: SportType.Yoga },
  { label: 'Elliptical',     value: SportType.Elliptical },
  { label: 'Other',          value: SportType.Other },
];

/** Gear / settings dropdown — theme toggle + activity type filter */
function SettingsDropdown() {
  const { theme, toggleTheme } = useTheme();
  const { globalSportType, setGlobalSportType } = useActivityTypeFilter();
  const { data: profile } = useProfile();
  const hiddenSportTypes: number[] = profile?.hiddenSportTypes ? JSON.parse(profile.hiddenSportTypes) : [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
        aria-label="Settings"
      >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-3 px-4 space-y-4">
          {/* Theme */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Theme</p>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
            >
              {theme === 'dark' ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Switch to Light
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Switch to Dark
                </>
              )}
            </button>
          </div>

          {/* Activity type filter */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Activity Type</p>
            <div className="flex flex-wrap gap-1">
              {SPORT_PILLS.filter((p) => p.value === undefined || !hiddenSportTypes.includes(p.value)).map((p) => (
                <button
                  key={String(p.value)}
                  onClick={() => setGlobalSportType(p.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    globalSportType === p.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Profile dropdown — avatar, profile link, extra pages, logout */
function ProfileDropdown({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Profile menu"
      >
        <Avatar size={7} />
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {profile?.displayName ?? user?.email}
            </p>
            {profile?.displayName && (
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            )}
          </div>

          <div className="py-1">
            <Link to="/profile" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            <Link to="/races" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l1.9-5.7a8.5 8.5 0 113.8 3.8L3 21" />
              </svg>
              Races
            </Link>
            <Link to="/badges" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Badges
            </Link>
            <Link to="/community" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Community
            </Link>
            <Link to="/gear" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17c0 1.1.9 2 2 2h13c.8 0 1.5-.7 1.5-1.5v-1A1.5 1.5 0 0018 15h-1.5l-1.5-4H9L7.5 15H5a2 2 0 00-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 11L10 8h4l.5 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V6" />
              </svg>
              Gear
            </Link>
            <Link to="/pace-calculator" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pace Calculator
            </Link>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 py-1">
            <button
              onClick={() => { close(); onLogout(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_LINKS = [
  { to: '/',          label: 'Dashboard'  },
  { to: '/activities',label: 'Activities' },
  { to: '/training',  label: 'Training'   },
];

const EXPLORE_LINKS = [
  { to: '/map',           label: 'Map'     },
  { to: '/streets',       label: 'Streets' },
  { to: '/tiles',         label: 'Tiles'   },
  { to: '/routes/create', label: 'Routes'  },
];

const STATS_LINKS = [
  { to: '/race-predictor',     label: 'Race Predictor'   },
  { to: '/running-level',      label: 'Running Level'    },
  { to: '/stats/time-of-day',  label: 'Time of Day'      },
  { to: '/fitness',            label: 'Fitness & Fatigue' },
];

/** Desktop "Stats" nav dropdown */
function StatsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAnyActive = STATS_LINKS.some(({ to }) => window.location.pathname === to);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-0.5 text-sm font-medium whitespace-nowrap ${
          isAnyActive
            ? 'text-primary-600 dark:text-white border-b-2 border-primary-600 dark:border-white pb-0.5'
            : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white'
        }`}
      >
        Stats
        <svg className="h-3.5 w-3.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
          {STATS_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm font-medium ${
                  isActive
                    ? 'text-primary-600 dark:text-white bg-primary-50 dark:bg-gray-700'
                    : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/** Desktop "Explore" nav dropdown */
function ExploreDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAnyActive = EXPLORE_LINKS.some(({ to }) => {
    const path = window.location.pathname;
    return path === to || path.startsWith(to + '/');
  });

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-0.5 text-sm font-medium whitespace-nowrap ${
          isAnyActive
            ? 'text-primary-600 dark:text-white border-b-2 border-primary-600 dark:border-white pb-0.5'
            : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white'
        }`}
      >
        Explore
        <svg className="h-3.5 w-3.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
          {EXPLORE_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm font-medium ${
                  isActive
                    ? 'text-primary-600 dark:text-white bg-primary-50 dark:bg-gray-700'
                    : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Left: logo + nav links */}
          <div className="flex items-center min-w-0 gap-6">
            <Link to="/" className="shrink-0 text-xl font-bold text-primary-600" onClick={closeMenu}>
              🏃 RunTracker
            </Link>
            {user && (
              <div className="hidden md:flex items-center gap-5">
                {NAV_LINKS.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `shrink-0 text-sm font-medium whitespace-nowrap ${isActive ? 'text-primary-600 dark:text-white border-b-2 border-primary-600 dark:border-white pb-0.5' : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white'}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <StatsDropdown />
                <ExploreDropdown />
              </div>
            )}
          </div>

          {/* Right: settings gear + profile dropdown (desktop) / hamburger (mobile) */}
          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <>
                {/* Desktop only */}
                <div className="hidden md:flex items-center gap-1">
                  <SettingsDropdown />
                  <ProfileDropdown onLogout={handleLogout} />
                </div>

                {/* Mobile hamburger */}
                <button
                  className="md:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label="Toggle menu"
                >
                  {isMenuOpen ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            )}
            {!user && (
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {user && isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `block px-2 py-2.5 font-medium rounded-md ${isActive ? 'text-primary-600 dark:text-white bg-primary-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`
                }
              >
                {label}
              </NavLink>
            ))}
            <MobileExploreSection closeMenu={closeMenu} />
            <MobileStatsSection closeMenu={closeMenu} />

            {/* Extra pages */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2 space-y-1">
              <Link to="/profile" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Profile
              </Link>
              <Link to="/races" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Races
              </Link>
              <Link to="/badges" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Badges
              </Link>
              <Link to="/community" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Community
              </Link>
              <Link to="/gear" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Gear
              </Link>
              <Link to="/pace-calculator" onClick={closeMenu} className="block px-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Pace Calculator
              </Link>
            </div>

            {/* Theme + activity type filter */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-3">
              <MobileThemeRow />
              <MobileActivityTypeRow />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
              <button
                onClick={() => { closeMenu(); handleLogout(); }}
                className="block w-full text-left px-2 py-2.5 text-red-500 hover:text-red-700 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function MobileExploreSection({ closeMenu }: { closeMenu: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-2.5 font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Explore
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
          {EXPLORE_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeMenu}
              className={({ isActive }) =>
                `block px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'text-primary-600 dark:text-white bg-primary-50 dark:bg-gray-700' : 'text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileStatsSection({ closeMenu }: { closeMenu: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-2.5 font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-white rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Stats
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
          {STATS_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeMenu}
              className={({ isActive }) =>
                `block px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'text-primary-600 dark:text-white bg-primary-50 dark:bg-gray-700' : 'text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileThemeRow() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="flex items-center justify-between px-2">
      <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">Theme</span>
      <button
        onClick={toggleTheme}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600"
      >
        {theme === 'dark' ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Light
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Dark
          </>
        )}
      </button>
    </div>
  );
}

function MobileActivityTypeRow() {
  const { globalSportType, setGlobalSportType } = useActivityTypeFilter();
  const { data: profile } = useProfile();
  const hiddenSportTypes: number[] = profile?.hiddenSportTypes ? JSON.parse(profile.hiddenSportTypes) : [];
  const visiblePills = SPORT_PILLS.filter((p) => p.value === undefined || !hiddenSportTypes.includes(p.value));
  return (
    <div className="px-2">
      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-2">Activity Type</p>
      <div className="flex gap-1.5 flex-wrap">
        {visiblePills.map((p) => (
          <button
            key={String(p.value)}
            onClick={() => setGlobalSportType(p.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              globalSportType === p.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
