interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  accent?: 'primary' | 'secondary' | 'tertiary' | 'outline';
  className?: string;
}

const ACCENT_BORDER: Record<string, string> = {
  primary: 'border-[#cffc00]',
  secondary: 'border-[#ff734a]',
  tertiary: 'border-[#81ecff]',
  outline: 'border-[#484847]',
};

const ACCENT_VALUE: Record<string, string> = {
  primary: 'text-[#cffc00]',
  secondary: 'text-[#ff734a]',
  tertiary: 'text-[#81ecff]',
  outline: 'text-white',
};

export default function StatCard({ title, value, subtitle, icon, accent = 'outline', className = '' }: StatCardProps) {
  const borderClass = ACCENT_BORDER[accent] ?? ACCENT_BORDER.outline;
  const valueClass = ACCENT_VALUE[accent] ?? ACCENT_VALUE.outline;

  return (
    <div className={`bg-[#20201f] border-l-2 ${borderClass} p-6 relative overflow-hidden ${className}`}>
      {/* Faint background icon */}
      {icon && (
        <div className="absolute top-0 right-0 p-4 opacity-10 select-none pointer-events-none">
          <span className="text-6xl leading-none">{icon}</span>
        </div>
      )}
      <p className="font-label text-[10px] uppercase tracking-widest text-[#adaaaa] mb-4">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className={`font-headline text-4xl font-bold ${valueClass}`}>{value}</span>
      </div>
      {subtitle && (
        <p className="font-label text-xs text-[#767575] mt-2">{subtitle}</p>
      )}
    </div>
  );
}

