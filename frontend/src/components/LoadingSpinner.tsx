import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-12 h-12',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className,
  size = 'md',
  text,
}) => (
  <div className={cn('flex items-center justify-center gap-2', className)}>
    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
    {text && <span className="text-sm text-muted-foreground">{text}</span>}
  </div>
);

export default LoadingSpinner;
