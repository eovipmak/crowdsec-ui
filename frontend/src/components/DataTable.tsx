import { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string | number;
}

export default function DataTable<T extends Record<string, any>>({
  data, columns, onRowClick, rowKey,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-md border border-[#232334] bg-[#12121a]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={rowKey ? rowKey(row) : i}
              className={onRowClick ? 'cursor-pointer hover:bg-[#181825]' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(row) : (row[col.key] ?? <span className="text-zinc-600">—</span>)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
