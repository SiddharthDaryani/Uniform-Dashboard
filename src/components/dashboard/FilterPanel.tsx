import { Check, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  value: string | string[];
  onChange: (value: any) => void;
  multi?: boolean; // ✅ NEW
}

interface FilterPanelProps {
  filters: FilterConfig[];
  onReset?: () => void;
  title?: string;
}

export function FilterPanel({
  filters,
  onReset,
  title = 'Filters',
}: FilterPanelProps) {
  return (
    <div className="animate-fade-in rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>

        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 px-2 text-xs"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {filters.map((filter) => (
          <div key={filter.id} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {filter.label}
            </Label>

            {/* 🔥 MULTI SELECT */}
            {filter.multi ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-between text-sm"
                  >
                    {(filter.value as string[]).length === 0
                      ? `All ${filter.label}s`
                      : `${(filter.value as string[]).length} selected`}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-56 p-1">
                  {filter.options.map((option) => {
                    const selected = (filter.value as string[]).includes(
                      option.value
                    );

                    return (
                      <button
                        key={option.value}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          if (selected) {
                            filter.onChange(
                              (filter.value as string[]).filter(
                                (v) => v !== option.value
                              )
                            );
                          } else {
                            filter.onChange([
                              ...(filter.value as string[]),
                              option.value,
                            ]);
                          }
                        }}
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded border">
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            ) : (
              /* 🔹 SINGLE SELECT (unchanged) */
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={filter.value as string}
                onChange={(e) => filter.onChange(e.target.value)}
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
