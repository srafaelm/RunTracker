import { Link } from 'react-router-dom';
import { useRunningLevel, useProfile } from '../../../hooks/useQueries';
import type { RunningLevelDistance } from '../../../types';

const LEVEL_COLORS: Record<string, string> = {
  Beginner:     'bg-gray-100 dark:bg-[#131313] text-gray-600 dark:text-gray-300',
  Novice:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  Intermediate: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  Advanced:     'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  Elite:        'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  WR:           'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
};

function getAchievedLevel(dist: RunningLevelDistance): string | null {
  return dist.standards.reduce<string | null>((best, s) => (s.userMeetsOrBeats ? s.level : best), null);
}

export default function RunningLevelCard() {
  const { data: profile } = useProfile();
  const { data: level } = useRunningLevel();

  if (!profile?.birthYear) {
    return (
      <div className="bg-[#20201f]-sm border border-[#484847]/30 p-6 mb-8">
        <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white mb-2">Running Level</h2>
        <p className="font-label text-xs text-[#767575]">
          Set your birth year in profile settings to see where your times rank against age-group standards.
        </p>
      </div>
    );
  }

  if (!level?.hasData) return null;

  return (
    <div className="bg-[#20201f]-sm border border-[#484847]/30 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-headline text-base font-bold uppercase tracking-tight text-white">Running Level</h2>
          <p className="text-xs text-[#767575] dark:text-[#767575] mt-0.5">{level.userAgeGroup}</p>
        </div>
        <Link to="/running-level" className="text-sm font-label text-xs text-[#cffc00] hover:text-white transition-colors">
          Full breakdown →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {level.distances.map((d) => {
          const achieved = getAchievedLevel(d);
          return (
            <div key={d.distance} className="border border-[#484847]/30 rounded-lg p-3">
              <p className="text-xs text-[#767575] dark:text-[#767575] font-medium">{d.distance}</p>
              {d.userTimeDisplay ? (
                <>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{d.userTimeDisplay}</p>
                  {achieved && (
                    <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[achieved]}`}>
                      {achieved}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold text-[#adaaaa] dark:text-gray-600 mt-1">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



