import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCities } from '../../hooks/useQueries';
import { citiesApi } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { ImportCityRequest } from '../../types';

function ImportCityForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [osmRelationId, setOsmRelationId] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');

  const mutation = useMutation({
    mutationFn: (data: ImportCityRequest) =>
      citiesApi.importCity(data).then((r) => r.data),
    onSuccess: () => {
      onSuccess();
      onClose();
      setOsmRelationId('');
      setName('');
      setRegion('');
      setCountry('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!osmRelationId || !name || !country) return;
    mutation.mutate({
      osmRelationId: Number(osmRelationId),
      name,
      region: region || undefined,
      country,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import City from OpenStreetMap</h2>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Enter the OSM relation ID of a municipality to import all its streets.
        Find IDs at{' '}
        <a
          href="https://www.openstreetmap.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:underline"
        >
          openstreetmap.org
        </a>
        {' '}(search a city → relation number in the URL).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            OSM Relation ID *
          </label>
          <input
            type="number"
            value={osmRelationId}
            onChange={(e) => setOsmRelationId(e.target.value)}
            placeholder="e.g. 2672880"
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            City Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amsterdam"
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Region / Province
          </label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Zuid-Holland"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Country *
          </label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Netherlands"
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Importing…' : 'Import City'}
        </button>
        {mutation.isPending && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            This may take a minute for large cities…
          </span>
        )}
        {mutation.isSuccess && mutation.data && (
          <span className="text-sm text-green-600">
            ✓ Imported {mutation.data.totalStreets} streets with {mutation.data.totalNodes} nodes
          </span>
        )}
        {mutation.isError && (
          <span className="text-sm text-red-600">
            Import failed. Check the OSM relation ID and try again.
          </span>
        )}
      </div>
    </form>
  );
}

export default function CityListPage() {
  const queryClient = useQueryClient();
  const { data: cities, isLoading } = useCities();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const reprocessMutation = useMutation({
    mutationFn: () => citiesApi.reprocessActivities().then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities'] }),
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Street Coverage</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Street coverage tracking. Run every street in your city!
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportDialogOpen(true)}
            title="Import city from OpenStreetMap"
            className="p-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {cities && cities.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reprocessMutation.isPending ? 'Reprocessing…' : 'Reprocess All Activities'}
              </button>
              {reprocessMutation.isPending && (
                <span className="text-xs text-gray-500 dark:text-gray-400">This may take a while…</span>
              )}
              {reprocessMutation.isSuccess && reprocessMutation.data && (
                <span className="text-xs text-green-600">
                  ✓ {reprocessMutation.data.message}
                </span>
              )}
              {reprocessMutation.isError && (
                <span className="text-xs text-red-600">Reprocessing failed</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Import City Dialog */}
      {importDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setImportDialogOpen(false); }}
        >
          <ImportCityForm
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['cities'] })}
            onClose={() => setImportDialogOpen(false)}
          />
        </div>
      )}

      {(!cities || cities.length === 0) ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">No cities imported yet. Use the form above to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cities.map((city) => (
            <Link
              key={city.id}
              to={`/streets/${city.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {city.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {city.region ? `${city.region}, ` : ''}{city.country}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary-600">
                    {city.completionPercentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
                  <div
                    className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(city.completionPercentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    {city.completedStreets} / {city.totalStreets} streets
                  </span>
                  <span>
                    {city.completedNodes} / {city.totalNodes} nodes
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
