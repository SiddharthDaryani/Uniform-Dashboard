import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  isLoading?: boolean;
}

export function DataTable<T>({ data, columns, title, isLoading }: DataTableProps<T>) {
  return (
    <div className="data-table-container animate-fade-in bg-card border border-border rounded-xl">
      {title && (
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border">
              {columns.map((column) => (
                <TableHead key={String(column.key)} className={`text-xs font-semibold uppercase tracking-wider h-10 ${column.className || ''}`}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse border-b border-border/50">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="h-12">
                      <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground italic">
                  No data matching selected filters
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={index} className="hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0">
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} className={`text-sm py-4 ${column.className || ''}`}>
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[column.key as string] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
