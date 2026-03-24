import React, { useState } from 'react';
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
  const px = size * 4;
  const sizeStyle: React.CSSProperties = { width: px, height: px, minWidth: px, minHeight: px };
  if (profile?.profilePictureUrl) {
    return (
      <img
        src={profile.profilePictureUrl}
        alt="avatar"
        style={sizeStyle}
        className="rounded-full object-cover border border-[#cffc00]/20"
      />
    );
  }
  return (
    <div
      style={sizeStyle}
      className="rounded-full bg-[#1a1a1a] border border-[#cffc00]/30 flex items-center justify-center"
    >
      <span className="text-xs font-bold text-[#cffc00]">{initial}</span>
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

const NAV_LINKS = [
  { to: '/',           label: 'Dashboard',  icon: 'dashboard'       },
  { to: '/activities', label: 'Activities', icon: 'directions_run'  },
  { to: '/training',   label: 'Training',   icon: 'fitness_center'  },
  { to: '/calendar',   label: 'Calendar',   icon: 'calendar_month'  },
];

const EXPLORE_LINKS = [
  { to: '/map',           label: 'Map',    icon: 'map'    },
  { to: '/streets',       label: 'Streets',icon: 'route'  },
  { to: '/tiles',         label: 'Tiles',  icon: 'grid_4x4'},
  { to: '/routes/create', label: 'Routes', icon: 'alt_route'},
];

const STATS_LINKS = [
  { to: '/race-predictor',    label: 'Race Predictor',   icon: 'timer'           },
  { to: '/running-level',     label: 'Running Level',    icon: 'show_chart'      },
  { to: '/stats/time-of-day', label: 'Time of Day',      icon: 'schedule'        },
  { to: '/fitness',           label: 'Fitness & Fatigue',icon: 'monitor_heart'   },
];

const PROFILE_LINKS = [
  { to: '/profile',         label: 'Profile',          icon: 'person'         },
  { to: '/races',           label: 'Races',            icon: 'emoji_events'   },
  { to: '/badges',          label: 'Badges',           icon: 'military_tech'  },
  { to: '/community',       label: 'Community',        icon: 'group'          },
  { to: '/gear',            label: 'Gear',             icon: 'backpack'       },
  { to: '/pace-calculator', label: 'Pace Calculator',  icon: 'speed'          },
];

function SidebarSection({
  title,
  links,
  closeMenu,
}: {
  title: string;
  links: { to: string; label: string; icon: string }[];
  closeMenu?: () => void;
}) {
  return (
    <div className="mt-2">
      <p className="px-6 py-1 text-[10px] font-label uppercase tracking-[0.2em] text-zinc-600">{title}</p>
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={closeMenu}
          className={({ isActive }) =>
            isActive
              ? 'flex items-center gap-4 px-6 py-3.5 text-[#cffc00] border-l-2 border-[#cffc00] bg-zinc-900/80 font-label text-sm font-medium transition-all duration-200'
              : 'flex items-center gap-4 px-6 py-3.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 font-label text-sm font-medium transition-all duration-200 border-l-2 border-transparent'
          }
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

/** Settings popover â€” theme toggle + activity type filter */
function SettingsPopover({ onClose }: { onClose: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { globalSportType, setGlobalSportType } = useActivityTypeFilter();
  const { data: profile } = useProfile();
  const hiddenSportTypes: number[] = profile?.hiddenSportTypes ? JSON.parse(profile.hiddenSportTypes) : [];
  const visiblePills = SPORT_PILLS.filter((p) => p.value === undefined || !hiddenSportTypes.includes(p.value));
  return (
    <div className="px-6 py-4 space-y-5 border-t border-[#484847]/30">
      {/* Theme */}
      <div>
        <p className="text-[10px] font-label uppercase tracking-[0.2em] text-zinc-600 mb-2">Theme</p>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-[#cffc00] transition-colors font-label"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </button>
      </div>
      {/* Activity type */}
      <div>
        <p className="text-[10px] font-label uppercase tracking-[0.2em] text-zinc-600 mb-2">Activity Type</p>
        <div className="flex flex-wrap gap-1.5">
          {visiblePills.map((p) => (
            <button
              key={String(p.value)}
              onClick={() => { setGlobalSportType(p.value); onClose(); }}
              className={`px-2.5 py-1 text-[10px] font-label uppercase tracking-wider transition-colors ${
                globalSportType === p.value
                  ? 'bg-[#cffc00] text-[#3b4a00] font-bold'
                  : 'bg-[#262626] text-zinc-400 hover:bg-[#333] hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* â”€â”€ Fixed sidebar (desktop) â”€â”€ */}
      <aside className="fixed left-0 top-0 h-full w-64 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-3xl border-r border-[#484847]/20 shadow-[0_20px_40px_rgba(0,0,0,0.4)] font-headline tracking-tight overflow-y-auto">
        {/* Logo */}
        <div className="p-8 shrink-0">
          <Link to="/" className="block">
            <h1 className="text-2xl font-bold tracking-tighter text-[#cffc00] uppercase">RunTracker</h1>
            <p className="text-[10px] text-zinc-600 tracking-[0.2em] mt-1 font-label">ELITE PERFORMANCE LAB</p>
          </Link>
        </div>

        {/* Nav sections */}
        <nav className="flex-1">
          <SidebarSection title="Main" links={NAV_LINKS} />
          <SidebarSection title="Explore" links={EXPLORE_LINKS} />
          <SidebarSection title="Stats" links={STATS_LINKS} />
          <SidebarSection title="Profile" links={PROFILE_LINKS} />
        </nav>

        {/* Settings toggle */}
        <div className="shrink-0 mt-auto">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center gap-4 px-6 py-4 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all duration-200 font-label text-sm border-t border-[#484847]/20"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
            <span>Filters &amp; Theme</span>
            <span className={`material-symbols-outlined ml-auto transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} style={{ fontSize: 16 }}>expand_less</span>
          </button>
          {settingsOpen && <SettingsPopover onClose={() => setSettingsOpen(false)} />}
        </div>

        {/* Profile / logout */}
        <div className="shrink-0 border-t border-[#484847]/20 p-4 flex items-center gap-3">
          <Avatar size={8} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate font-headline">
              {profile?.displayName ?? user?.email}
            </p>
            {profile?.displayName && (
              <p className="text-[10px] text-zinc-600 truncate font-label">{user?.email}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-zinc-600 hover:text-[#ff734a] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          </button>
        </div>
      </aside>

      {/* â”€â”€ Mobile hamburger toggle (visible < md) â”€â”€ */}
      <button
        className="fixed top-4 left-4 z-[60] md:hidden bg-zinc-900/80 backdrop-blur p-2 rounded-md text-zinc-400 hover:text-[#cffc00]"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined">{mobileOpen ? 'close' : 'menu'}</span>
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[55]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 z-[60] flex flex-col bg-zinc-950 border-r border-[#484847]/20 overflow-y-auto font-headline tracking-tight">
            <div className="p-8 shrink-0">
              <Link to="/" onClick={() => setMobileOpen(false)} className="block">
                <h1 className="text-2xl font-bold tracking-tighter text-[#cffc00] uppercase">RunTracker</h1>
                <p className="text-[10px] text-zinc-600 tracking-[0.2em] mt-1 font-label">ELITE PERFORMANCE LAB</p>
              </Link>
            </div>
            <nav className="flex-1">
              <SidebarSection title="Main" links={NAV_LINKS} closeMenu={() => setMobileOpen(false)} />
              <SidebarSection title="Explore" links={EXPLORE_LINKS} closeMenu={() => setMobileOpen(false)} />
              <SidebarSection title="Stats" links={STATS_LINKS} closeMenu={() => setMobileOpen(false)} />
              <SidebarSection title="Profile" links={PROFILE_LINKS} closeMenu={() => setMobileOpen(false)} />
            </nav>
            <div className="shrink-0 border-t border-[#484847]/20 p-4 flex items-center gap-3">
              <Avatar size={8} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate font-headline">
                  {profile?.displayName ?? user?.email}
                </p>
              </div>
              <button onClick={() => { setMobileOpen(false); handleLogout(); }} title="Logout" className="text-zinc-600 hover:text-[#ff734a] transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

