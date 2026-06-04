export function exportToCSV(
    filename: string,
    headers: string[],
    rows: (string | number | null | undefined)[][],
) {
    const escape = (cell: string | number | null | undefined) => {
        const s = String(cell ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const csv = [
        headers.map(escape).join(','),
        ...rows.map(row => row.map(escape).join(',')),
    ].join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
