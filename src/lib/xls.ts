function esc(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const REKAP_HEADERS = [
  "WAKTU",
  "NAMA PERUSAHAAN",
  "NAMA DESA",
  "NO CPCL",
  "NAMA CPCL",
  "PELIMPAHAN",
  "ALAMAT CPCL",
  "NIK CPCL",
  "NO HP CPCL",
  "KOORDINAT",
  "NAMA PETUGAS",
  "NOMOR PETUGAS",
];

/** Builds a SpreadsheetML 2003 workbook (.xls) that Excel opens natively. */
export function buildXls(sheetName: string, headers: string[], rows: string[][]): string {
  const cell = (v: string, style?: string) =>
    `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const body = [
    `<Row>${headers.map((h) => cell(h, "head")).join("")}</Row>`,
    ...rows.map((r) => `<Row>${r.map((c) => cell(c ?? "")).join("")}</Row>`),
  ].join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="head"><Font ss:Bold="1" ss:FontName="Arial"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style>
<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial"/></Style>
</Styles>
<Worksheet ss:Name="${esc(sheetName.slice(0, 30))}"><Table>${body}</Table></Worksheet>
</Workbook>`;
}
