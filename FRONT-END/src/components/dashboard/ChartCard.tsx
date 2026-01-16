import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 animate-fade-in ${className}`}
    >
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {title}
      </h3>

      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
