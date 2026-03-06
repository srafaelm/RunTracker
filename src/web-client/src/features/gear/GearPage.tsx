import { useState } from 'react';
import { useGear, useCreateGear, useUpdateGear, useDeleteGear, useShoeAnalysis } from '../../hooks/useQueries';
import LoadingSpinner from '../../components/LoadingSpinner';
import { GearType } from '../../types';
import type { Gear, CreateGearRequest, UpdateGearRequest } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const GEAR_TYPE_LABELS: Record<GearType, string> = {
  [GearType.Shoes]: '👟 Shoes',
  [GearType.Bike]: '🚴 Bike',
  [GearType.Watch]: '⌚ Watch',
  [GearType.Other]: '🎽 Other',
};

function formatKm(meters: number) {
  return (meters / 1000).toFixed(1) + ' km';
}

function GearForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<CreateGearRequest & { isRetired?: boolean }>;
  onSave: (data: CreateGearRequest & { isRetired?: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [type, setType] = useState<GearType>(initial?.type ?? GearType.Shoes);
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [startingDistanceKm, setStartingDistanceKm] = useState(
    initial?.startingDistanceM ? (initial.startingDistanceM / 1000).toString() : '0'
  );
  const [retirementDistanceKm, setRetirementDistanceKm] = useState(
    initial?.retirementDistanceM ? (initial.retirementDistanceM / 1000).toString() : ''
  );
  const [isRetired, setIsRetired] = useState(initial?.isRetired ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      brand: brand || undefined,
      type,
      purchaseDate: purchaseDate || undefined,
      notes: notes || undefined,
      startingDistanceM: parseFloat(startingDistanceKm || '0') * 1000,
      retirementDistanceM: retirementDistanceKm ? parseFloat(retirementDistanceKm) * 1000 : undefined,
      isRetired,
    });
  }

  const inputCls =
    'w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Nike Vaporfly" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand</label>
          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} placeholder="e.g. Nike" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(parseInt(e.target.value) as GearType)} className={inputCls}>
            {Object.entries(GEAR_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Date</label>
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Starting Distance (km)</label>
          <input
            type="number" min={0} step={0.1}
            value={startingDistanceKm}
            onChange={(e) => setStartingDistanceKm(e.target.value)}
            className={inputCls}
            placeholder="Distance already on this gear"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retirement Distance (km)</label>
          <input
            type="number" min={0} step={1}
            value={retirementDistanceKm}
            onChange={(e) => setRetirementDistanceKm(e.target.value)}
            className={inputCls}
            placeholder="e.g. 800 for shoes"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Any notes…" />
      </div>
      {initial?.isRetired !== undefined && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={isRetired} onChange={(e) => setIsRetired(e.target.checked)} className="rounded" />
          Mark as retired
        </label>
      )}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

function GearCard({ gear, onEdit, onDelete, statsOpen, onToggleStats }: {
  gear: Gear; onEdit: () => void; onDelete: () => void;
  statsOpen?: boolean; onToggleStats?: () => void;
}) {
  const progress = gear.retirementDistanceM
    ? Math.min(100, (gear.totalDistanceM / gear.retirementDistanceM) * 100)
    : null;

  const progressColor =
    progress === null ? '' :
    progress >= 90 ? 'bg-red-500' :
    progress >= 70 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-5 space-y-3 ${gear.isRetired ? 'opacity-60 border-gray-200 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">{gear.name}</span>
            {gear.isRetired && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Retired</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {GEAR_TYPE_LABELS[gear.type]}{gear.brand ? ` · ${gear.brand}` : ''}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Distance */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total distance</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatKm(gear.totalDistanceM)}</span>
        </div>
        {gear.retirementDistanceM && (
          <>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${progressColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>{progress?.toFixed(0)}% of {formatKm(gear.retirementDistanceM)}</span>
              <span>{formatKm(Math.max(0, gear.retirementDistanceM - gear.totalDistanceM))} left</span>
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex gap-4">
          <span>{gear.activityCount} activities</span>
          {gear.purchaseDate && <span>Since {new Date(gear.purchaseDate).toLocaleDateString()}</span>}
          {gear.notes && <span className="truncate italic">{gear.notes}</span>}
        </div>
        {gear.type === GearType.Shoes && onToggleStats && (
          <button
            onClick={onToggleStats}
            className="text-primary-600 hover:text-primary-700 font-medium shrink-0"
          >
            {statsOpen ? 'Hide stats ↑' : 'Shoe stats ↓'}
          </button>
        )}
      </div>
      {gear.type === GearType.Shoes && statsOpen && <ShoeAnalysisPanel gearId={gear.id} />}
    </div>
  );
}

function ShoeAnalysisPanel({ gearId }: { gearId: string }) {
  const { data, isLoading } = useShoeAnalysis(gearId);

  if (isLoading) return <div className="px-5 pb-4 text-sm text-gray-400">Loading shoe stats…</div>;
  if (!data) return null;

  const rotationStatus = data.daysSinceLastUse < 0
    ? 'No runs yet'
    : data.daysSinceLastUse === 0
    ? 'Used today'
    : `Last used ${data.daysSinceLastUse} day${data.daysSinceLastUse === 1 ? '' : 's'} ago`;

  const rotationColor = data.daysSinceLastUse < 0 || data.daysSinceLastUse <= 3
    ? 'text-green-600 dark:text-green-400'
    : data.daysSinceLastUse <= 7
    ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-5 pt-4 pb-5 space-y-4">
      {/* Rotation status */}
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${rotationColor}`}>{rotationStatus}</span>
        {data.daysSinceLastUse > 7 && (
          <span className="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">Rotate soon</span>
        )}
      </div>

      {/* Monthly usage chart */}
      {data.monthlyTrend.some(m => m.activityCount > 0) && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Monthly usage (last 6 months)</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.monthlyTrend} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
              <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v: number, n: string) => [v, n === 'activityCount' ? 'Runs' : 'km']} labelFormatter={l => l} />
              <Bar dataKey="activityCount" fill="#6366f1" radius={[2, 2, 0, 0]} name="activityCount" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Other shoes comparison */}
      {data.otherShoes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Other shoes</p>
          <div className="space-y-1">
            {data.otherShoes.map(s => (
              <div key={s.gearId} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">{s.name}</span>
                <span className="text-gray-400">
                  {s.daysSinceLastUse < 0 ? 'No runs' : `${s.daysSinceLastUse}d ago`} · {s.totalDistanceKm.toFixed(0)} km
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activities */}
      {data.recentActivities.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent runs</p>
          <div className="space-y-0.5">
            {data.recentActivities.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate mr-2">{a.date} · {a.name}</span>
                <span className="shrink-0">{a.distanceKm.toFixed(1)} km</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  gear,
  onConfirm,
  onCancel,
  deleting,
}: {
  gear: Gear;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
          <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-1">
          Delete {gear.name}?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          This will permanently remove this gear item. Activities linked to it will be unaffected.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GearPage() {
  const { data: gearList, isLoading } = useGear();
  const createGear = useCreateGear();
  const updateGear = useUpdateGear();
  const deleteGear = useDeleteGear();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shoeStatsId, setShoeStatsId] = useState<string | null>(null);

  async function handleCreate(data: CreateGearRequest) {
    await createGear.mutateAsync(data);
    setShowAddForm(false);
  }

  async function handleUpdate(id: string, data: CreateGearRequest & { isRetired?: boolean }) {
    const req: UpdateGearRequest = {
      ...data,
      isRetired: data.isRetired ?? false,
    };
    await updateGear.mutateAsync({ id, data: req });
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteGear.mutateAsync(id);
    setDeleteConfirmId(null);
  }

  const active = gearList?.filter((g) => !g.isRetired) ?? [];
  const retired = gearList?.filter((g) => g.isRetired) ?? [];

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Gear</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your shoes, bikes and equipment</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            + Add Gear
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Gear</h2>
          <GearForm
            onSave={handleCreate}
            onCancel={() => setShowAddForm(false)}
            saving={createGear.isPending}
          />
        </div>
      )}

      {/* Active gear */}
      {active.length > 0 && (
        <div className="space-y-4 mb-8">
          {active.map((gear) =>
            editingId === gear.id ? (
              <div key={gear.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-primary-300 dark:border-primary-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Gear</h2>
                <GearForm
                  initial={{
                    name: gear.name,
                    brand: gear.brand ?? undefined,
                    type: gear.type,
                    purchaseDate: gear.purchaseDate ?? undefined,
                    notes: gear.notes ?? undefined,
                    startingDistanceM: gear.startingDistanceM,
                    retirementDistanceM: gear.retirementDistanceM ?? undefined,
                    isRetired: gear.isRetired,
                  }}
                  onSave={(data) => handleUpdate(gear.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={updateGear.isPending}
                />
              </div>
            ) : (
              <GearCard
                key={gear.id}
                gear={gear}
                onEdit={() => setEditingId(gear.id)}
                onDelete={() => setDeleteConfirmId(gear.id)}
                statsOpen={shoeStatsId === gear.id}
                onToggleStats={() => setShoeStatsId(shoeStatsId === gear.id ? null : gear.id)}
              />
            )
          )}
        </div>
      )}

      {/* Retired gear */}
      {retired.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide text-xs">Retired</h2>
          <div className="space-y-4">
            {retired.map((gear) =>
              editingId === gear.id ? (
                <div key={gear.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-primary-300 dark:border-primary-700 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Gear</h2>
                  <GearForm
                    initial={{
                      name: gear.name,
                      brand: gear.brand ?? undefined,
                      type: gear.type,
                      purchaseDate: gear.purchaseDate ?? undefined,
                      notes: gear.notes ?? undefined,
                      startingDistanceM: gear.startingDistanceM,
                      retirementDistanceM: gear.retirementDistanceM ?? undefined,
                      isRetired: gear.isRetired,
                    }}
                    onSave={(data) => handleUpdate(gear.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={updateGear.isPending}
                  />
                </div>
              ) : (
                <GearCard
                  key={gear.id}
                  gear={gear}
                  onEdit={() => setEditingId(gear.id)}
                  onDelete={() => setDeleteConfirmId(gear.id)}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!showAddForm && gearList?.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">👟</p>
          <p className="text-lg font-medium">No gear yet</p>
          <p className="text-sm mt-1">Add your shoes, bike, or watch to track their mileage.</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (() => {
        const gear = gearList?.find((g) => g.id === deleteConfirmId);
        if (!gear) return null;
        return (
          <DeleteConfirmDialog
            gear={gear}
            onConfirm={() => handleDelete(deleteConfirmId)}
            onCancel={() => setDeleteConfirmId(null)}
            deleting={deleteGear.isPending}
          />
        );
      })()}
    </div>
  );
}
