'use client';

import { Printer } from 'lucide-react';

export function PrintCertificateButton() {
  return (
    <button className="btn-primary no-print" type="button" onClick={() => window.print()}>
      <Printer size={16} />
      Print or save PDF
    </button>
  );
}
