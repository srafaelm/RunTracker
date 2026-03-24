interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div
        className={`animate-spin border-2 border-[#484847] border-t-[#cffc00] ${sizeClasses[size]}`}
        style={{ borderRadius: 2 }}
      />
    </div>
  );
}

