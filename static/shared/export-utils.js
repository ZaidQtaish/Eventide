(() => {
    function toSafeString(value) {
        if (value === null || value === undefined) return '';
        return String(value);
    }

    function escapeCsvCell(value) {
        let text = toSafeString(value);

        // Prevent spreadsheet formula execution when opening CSV in Excel/Sheets.
        if (/^[=+\-@]/.test(text)) {
            text = `'${text}`;
        }

        text = text.replace(/"/g, '""');

        if (/[",\n\r]/.test(text)) {
            text = `"${text}"`;
        }

        return text;
    }

    function rowsToCsv(rows, columns) {
        const safeRows = Array.isArray(rows) ? rows : [];
        const safeColumns = Array.isArray(columns) ? columns : [];

        const headerLine = safeColumns
            .map((column) => escapeCsvCell(column.header))
            .join(',');

        const bodyLines = safeRows.map((row) => {
            return safeColumns
                .map((column) => {
                    const rawValue = typeof column.value === 'function' ? column.value(row) : '';
                    return escapeCsvCell(rawValue);
                })
                .join(',');
        });

        return [headerLine, ...bodyLines].join('\n');
    }

    function downloadCsv(filename, csvText) {
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    function exportCsv(config) {
        const safeConfig = config || {};
        const filename = safeConfig.filename || `eventide-export-${new Date().toISOString().slice(0, 10)}.csv`;
        const csvText = rowsToCsv(safeConfig.rows, safeConfig.columns);
        downloadCsv(filename, csvText);
    }

    window.EventideExport = {
        exportCsv,
        rowsToCsv,
    };
})();
