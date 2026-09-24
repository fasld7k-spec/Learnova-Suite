import type { ReactNode } from 'react';

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="dashboard-data-table overflow-hidden rounded-xl">
      <div className="scrollbar-none overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            <tr>
              {headers.map((header) => (
                <th key={header} className="border-b border-violet-300/15 bg-white/[0.025] px-5 py-4">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-violet-300/10">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition hover:bg-violet-400/[0.08]">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4 align-top leading-6 text-slate-100 first:font-bold first:text-white">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-10 text-center text-sm font-semibold text-slate-400" colSpan={headers.length}>
                  No records to display yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
