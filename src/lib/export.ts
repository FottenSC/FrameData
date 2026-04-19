/**
 * Export helpers for the frame-data table.
 *
 * Two formats are supported:
 *
 *   CSV   — plain text, UTF-8 with BOM so Excel / Google Sheets correctly
 *           interpret non-ASCII characters (e.g. the em-dash we use for
 *           "no data" cells). RFC-4180 quoting for fields that contain
 *           commas, newlines, or double-quotes.
 *
 *   Excel — an HTML table with .xls extension and the office MIME type.
 *           Excel and Google Sheets both parse this correctly as a proper
 *           spreadsheet, with numeric cells staying numeric (via the
 *           `x:num` attribute from the office namespace). No external
 *           library dependency — the previous implementation saved a
 *           CSV with the `.xls` extension, which caused Excel to throw
 *           "file not in recognised format" warnings.
 */

export type ExportCell = string | number | null | undefined;

/** Shared: trigger a browser download for a Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const csvEscape = (v: ExportCell): string => {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

export function exportCsv(
  headers: string[],
  rows: ExportCell[][],
  filename: string,
): void {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // U+FEFF BOM so Excel recognises the file as UTF-8.
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

// ---------------------------------------------------------------------------
// Excel (HTML table)
// ---------------------------------------------------------------------------

const htmlEscape = (v: ExportCell): string => {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const isFiniteNumber = (v: ExportCell): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Render one `<td>`. Numeric values use the `x:num` hint from the
 * `urn:schemas-microsoft-com:office:excel` namespace so Excel keeps them
 * numeric rather than coercing them to text (without this hint, "+0" /
 * "-6" would be treated as strings and break sorting inside Excel).
 */
const cellHtml = (v: ExportCell): string => {
  if (isFiniteNumber(v)) return `<td x:num="${v}">${v}</td>`;
  return `<td>${htmlEscape(v)}</td>`;
};

export function exportExcel(
  headers: string[],
  rows: ExportCell[][],
  filename: string,
): void {
  const head = headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("");
  const body = rows
    .map((r) => "<tr>" + r.map(cellHtml).join("") + "</tr>")
    .join("");

  const html = [
    "<!DOCTYPE html>",
    '<html xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<head><meta charset="UTF-8" />',
    // Hint to Excel / Sheets about which worksheet name to use.
    "<!--[if gte mso 9]><xml>",
    "<x:ExcelWorkbook><x:ExcelWorksheets>",
    "<x:ExcelWorksheet><x:Name>Frame data</x:Name>",
    "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>",
    "</x:ExcelWorksheet>",
    "</x:ExcelWorksheets></x:ExcelWorkbook>",
    "</xml><![endif]-->",
    // Minimal styling so the header row stands out when opened directly.
    "<style>th{background:#e8e8e8;font-weight:bold;border:1px solid #999;}td{border:1px solid #ccc;}table{border-collapse:collapse;}</style>",
    "</head><body>",
    '<table border="1">',
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table>",
    "</body></html>",
  ].join("");

  const blob = new Blob(["\uFEFF" + html], {
    type: "application/vnd.ms-excel",
  });
  downloadBlob(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`);
}
