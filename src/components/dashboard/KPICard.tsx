import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
};

export function KPICard({ title, value, icon: Icon, trend, variant = 'default' }: KPICardProps) {
  return (
    <div className={`kpi-card border-l-4 ${variantStyles[variant]} animate-fade-in`}>
      <div className="flex items-center justify-between">
        <span className="kpi-label">{title}</span>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="kpi-value">{value}</span>
        {trend && (
          <span className={`text-sm font-medium ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
