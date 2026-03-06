import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { activitiesApi } from '../../api/client';
import { SportType } from '../../types';

const SPORT_TYPE_OPTIONS = [
  { value: SportType.Run, label: 'Run' },
  { value: SportType.TrailRun, label: 'Trail Run' },
  { value: SportType.Walk, label: 'Walk' },
  { value: SportType.Hike, label: 'Hike' },
  { value: SportType.VirtualRun, label: 'Virtual Run' },
  { value: SportType.Ride, label: 'Ride' },
  { value: SportType.VirtualRide, label: 'Virtual Ride' },
  { value: SportType.Swim, label: 'Swim' },
  { value: SportType.WeightTraining, label: 'Weight Training' },
  { value: SportType.Workout, label: 'Workout' },
  { value: SportType.Yoga, label: 'Yoga' },
  { value: SportType.Elliptical, label: 'Elliptical' },
  { value: SportType.Other, label: 'Other' },
];

interface Props {
  onClose: () => void;
}

export default function ImportGpxDialog({ onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [sportType, setSportType] = useState<SportType>(SportType.Run);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !name) {
      setName(f.name.replace(/\.gpx$/i, ''));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const res = await activitiesApi.importGpx(file, name || undefined, sportType);
      navigate(`/activities/${res.data.id}`);
    } catch {
      setError('Failed to import GPX file. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import GPX File</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GPX File <span className="text-red-500">*</span>
            </label>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">Click to select a .gpx file</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank to use filename"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sport Type
            </label>
            <select
              value={sportType}
              onChange={(e) => setSportType(Number(e.target.value) as SportType)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            >
              {SPORT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
