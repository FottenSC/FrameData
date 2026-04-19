/**
 * Export helpers for the frame-data table.
 *
 *   CSV   — UTF-8 with BOM so Excel / Sheets honour non-ASCII characters
 *           (the em-dash we use for "no data" cells was previously rendered
 *           as mojibake under Excel's default cp1252 interpretation).
 *           RFC-4180 quoting.
 *
 *   XLSX  — a real Office Open XML workbook (ZIP of 5 tiny XML files),
 *           zipped with `fflate`. Excel / Sheets open it as a native
 *           spreadsheet, no "file format doesn't match extension" warning.
 *           Numeric cells stay numeric (so sort / formulas work).
 */

import { zipSync, strToU8 } from "fflate";

export type ExportCell = string | number | null | undefined;

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

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
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------
//
// XLSX is a ZIP archive of XML files following the Office Open XML spec
// (ECMA-376). We emit the absolute minimum set Excel / Sheets will accept:
//
//   [Content_Types].xml         — MIME map for the parts inside
//   _rels/.rels                 — relationship: package → main document
//   xl/workbook.xml             — lists worksheets
//   xl/_rels/workbook.xml.rels  — relationship: workbook → sheet1.xml
//   xl/worksheets/sheet1.xml    — the actual cell data
//
// No shared-strings table, no styles, no defined names — just data. Excel
// is happy.

const XML_ESC = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Convert a 0-indexed column number to its Excel letter (0→A, 25→Z, 26→AA …). */
function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const isFiniteNumber = (v: ExportCell): v is number =>
  typeof v === "number" && Number.isFinite(v);

function buildSheetXml(headers: string[], rows: ExportCell[][]): string {
  // Merge header row + data rows — header is just the first row with string cells.
  const allRows: ExportCell[][] = [headers, ...rows];
  const xmlRows: string[] = [];
  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    const cells: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const ref = `${columnLetter(c)}${r + 1}`;
      const v = row[c];
      if (v == null || v === "") continue; // empty cells can be omitted
      if (isFiniteNumber(v)) {
        cells.push(`<c r="${ref}"><v>${v}</v></c>`);
      } else {
        // Inline string — no need for a shared-strings table for a one-off export.
        cells.push(
          `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${XML_ESC(String(v))}</t></is></c>`,
        );
      }
    }
    xmlRows.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  }
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    xmlRows.join(""),
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

const WORKBOOK_XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
  '<sheets><sheet name="Frame data" sheetId="1" r:id="rId1"/></sheets>',
  "</workbook>",
].join("");

const WORKBOOK_RELS = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1"',
  ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"',
  ' Target="worksheets/sheet1.xml"/>',
  "</Relationships>",
].join("");

const PACKAGE_RELS = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  '<Relationship Id="rId1"',
  ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"',
  ' Target="xl/workbook.xml"/>',
  "</Relationships>",
].join("");

const CONTENT_TYPES = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
  '<Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml"',
  ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/worksheets/sheet1.xml"',
  ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  "</Types>",
].join("");

export function exportExcel(
  headers: string[],
  rows: ExportCell[][],
  filename: string,
): void {
  const sheet = buildSheetXml(headers, rows);
  const zipped = zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(PACKAGE_RELS),
      "xl/workbook.xml": strToU8(WORKBOOK_XML),
      "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    },
    // DEFLATE compression; level 6 is a reasonable balance.
    { level: 6 },
  );
  // Cast to BlobPart — Uint8Array is always a valid BlobPart at runtime,
  // but TS's ArrayBufferLike includes SharedArrayBuffer which isn't.
  const blob = new Blob([zipped as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(
    blob,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}
