export async function exportToExcel(
  headers: string[],
  rows: Record<string, unknown>[],
  filename: string = "query-results"
): Promise<void> {
  const XLSX = await import("xlsx");

  // Build array-of-arrays
  const data = [
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-size columns
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(
      40,
      Math.max(
        h.length + 2,
        ...rows.slice(0, 50).map((r) => String(r[h] ?? "").length)
      )
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  headers: string[],
  rows: Record<string, unknown>[],
  title: string = "Query Results",
  filename: string = "query-results"
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({
    orientation: headers.length > 5 ? "landscape" : "portrait",
  });

  // Title
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(title, 14, 20);

  // Metadata
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`${rows.length} rows`, 14, 33);

  // Table
  autoTable(doc, {
    startY: 38,
    head: [headers],
    body: rows.map((row) => headers.map((h) => String(row[h] ?? ""))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 38 },
  });

  doc.save(`${filename}.pdf`);
}
