import { useEffect, useRef, useState } from 'react';
import type { Tag } from '../types';

interface TagPickerProps {
  allTags: Tag[];
  assignedTagIds: string[];
  onSelect: (tagId: string) => void;
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#6b7280'];

export default function TagPicker({ allTags, assignedTagIds, onSelect, onCreate, onClose }: TagPickerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const unassigned = allTags.filter((t) => !assignedTagIds.includes(t.id));

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3"
    >
      {unassigned.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Your tags</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { onSelect(tag.id); onClose(); }}
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color ?? '#6b7280' }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Create tag</p>
        <div className="flex gap-1 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: newColor === c ? '#1d4ed8' : 'transparent',
              }}
            />
          ))}
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              onCreate(newName.trim(), newColor);
              setNewName('');
              onClose();
            }
          }}
          placeholder="Tag name + Enter"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
}
