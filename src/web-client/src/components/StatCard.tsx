interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  className?: string;
}

export default function StatCard({ title, value, subtitle, icon, className = '' }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <span className="text-2xl sm:text-3xl">{icon}</span>}
      </div>
    </div>
  );
}
