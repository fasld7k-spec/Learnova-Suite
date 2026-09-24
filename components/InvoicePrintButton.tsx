'use client';

import { Download } from 'lucide-react';

export function InvoicePrintButton() {
  return (
    <button className="moe-control px-4" type="button" onClick={() => window.print()}>
      <Download size={17} />
      Print
    </button>
  );
}
