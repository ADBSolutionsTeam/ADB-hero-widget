/**
 * PDF Report Generator for Area Scanner
 * Generates branded PDF reports with scan zone details, detection summary,
 * and full results table.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AreaScanResult, ScanArea } from "./types";
import { formatCoord, getResultDetail, LocationInfo } from "./area-scanner-data";

// ── Brand colors ─────────────────────────────────────────────
const NAVY = [8, 17, 31] as const;
const DEEP_SLATE = [15, 27, 45] as const;
const BLUSH = [199, 163, 155] as const;
const STEEL = [143, 163, 189] as const;
const WHITE = [255, 255, 255] as const;
const ICE = [232, 238, 247] as const;
const EMERALD = [16, 185, 129] as const;
const AMBER = [245, 158, 11] as const;
const CYAN = [34, 211, 238] as const;

type RGB = readonly [number, number, number];

function setColor(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

const GROUP_COLORS: Record<string, RGB> = {
  containers: BLUSH,
  equipment: AMBER,
  construction: EMERALD,
};

// ── Main export function ─────────────────────────────────────

export function generateAreaScanReport(
  scanArea: ScanArea,
  results: AreaScanResult[],
  locationInfo: LocationInfo | null
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 0;

  // ── Page 1: Cover + Summary ──────────────────────────────

  // Header bar
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageWidth, 48, "F");

  // Accent line
  doc.setFillColor(BLUSH[0], BLUSH[1], BLUSH[2]);
  doc.rect(0, 48, pageWidth, 1.5, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  setColor(doc, WHITE);
  doc.text("Area Scan Report", margin, 20);

  doc.setFontSize(10);
  setColor(doc, STEEL);
  doc.text("Container Hunter — ADB Satellite Intelligence Platform", margin, 30);

  // Date and location
  doc.setFontSize(9);
  setColor(doc, BLUSH);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lngDir = scanArea.center.lng >= 0 ? "E" : "W";
  const locStr = locationInfo
    ? `${locationInfo.city}, ${locationInfo.state} ${locationInfo.zip}`
    : `${scanArea.center.lat.toFixed(4)}°N, ${Math.abs(scanArea.center.lng).toFixed(4)}°${lngDir}`;
  doc.text(`${locStr}  |  ${dateStr}`, margin, 40);

  y = 58;

  // ── Scan Zone Details ──────────────────────────────────────

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, NAVY);
  doc.text("Scan Zone", margin, y);
  y += 8;

  const zoneDetails = [
    { label: "Center", value: `${formatCoord(scanArea.center.lat, "lat")}, ${formatCoord(scanArea.center.lng, "lng")}` },
    { label: "Area", value: `3 × 3 miles (${scanArea.areaSqMiles} sq mi)` },
    { label: "Tiles Analyzed", value: `${scanArea.tileCount} (6×6 grid)` },
    { label: "North Bound", value: formatCoord(scanArea.bounds.north, "lat") },
    { label: "South Bound", value: formatCoord(scanArea.bounds.south, "lat") },
    { label: "East Bound", value: formatCoord(scanArea.bounds.east, "lng") },
    { label: "West Bound", value: formatCoord(scanArea.bounds.west, "lng") },
  ];

  if (locationInfo) {
    zoneDetails.push(
      { label: "City", value: locationInfo.city },
      { label: "State", value: locationInfo.state },
      { label: "County", value: locationInfo.county },
      { label: "ZIP Code", value: locationInfo.zip }
    );
  }

  // Two-column layout
  const colW = (pageWidth - margin * 2 - 6) / 2;
  zoneDetails.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * (colW + 6);
    const cy = y + row * 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, STEEL);
    doc.text(item.label.toUpperCase(), cx, cy);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setColor(doc, NAVY);
    doc.text(item.value, cx, cy + 5);
  });

  y += Math.ceil(zoneDetails.length / 2) * 10 + 6;

  // ── Detection Summary ─────────────────────────────────────

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, NAVY);
  doc.text("Detection Summary", margin, y);
  y += 8;

  const containers = results.filter((r) => r.group === "containers");
  const equipment = results.filter((r) => r.group === "equipment");
  const construction = results.filter((r) => r.group === "construction");
  const avgConfidence = results.length > 0
    ? Math.round((results.reduce((s, r) => s + r.confidence, 0) / results.length) * 100)
    : 0;

  const summaryStats = [
    { label: "Total Detections", value: String(results.length), color: NAVY },
    { label: "Containers", value: String(containers.length), color: BLUSH },
    { label: "Equipment", value: String(equipment.length), color: AMBER },
    { label: "Construction Signals", value: String(construction.length), color: EMERALD },
    { label: "Avg Confidence", value: `${avgConfidence}%`, color: NAVY },
    { label: "High Priority", value: String(results.filter((r) => r.confidence > 0.88).length), color: EMERALD },
  ];

  const cardW = (pageWidth - margin * 2 - 8) / 3;
  const cardH = 20;

  summaryStats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = margin + col * (cardW + 4);
    const cy = y + row * (cardH + 4);

    doc.setFillColor(ICE[0], ICE[1], ICE[2]);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");

    // Color bar on left
    doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.roundedRect(cx, cy, 2, cardH, 1, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setColor(doc, STEEL);
    doc.text(stat.label.toUpperCase(), cx + 5, cy + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setColor(doc, NAVY);
    doc.text(stat.value, cx + 5, cy + 16);
  });

  y += 2 * (cardH + 4) + 10;

  // ── Category Breakdown ─────────────────────────────────────

  if (results.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(doc, NAVY);
    doc.text("Category Breakdown", margin, y);
    y += 6;

    const barW = pageWidth - margin * 2;
    const barH = 8;

    const segments = [
      { count: containers.length, color: BLUSH, label: "Containers" },
      { count: equipment.length, color: AMBER, label: "Equipment" },
      { count: construction.length, color: EMERALD, label: "Construction" },
    ];

    let bx = margin;
    segments.forEach((seg) => {
      const w = (seg.count / results.length) * barW;
      if (w > 0) {
        doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
        doc.roundedRect(bx, y, Math.max(w, 2), barH, 1, 1, "F");
        bx += w;
      }
    });

    y += barH + 4;

    let lx = margin;
    doc.setFontSize(7);
    segments.forEach((seg) => {
      doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
      doc.circle(lx + 2, y + 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      setColor(doc, NAVY);
      doc.text(`${seg.label} (${seg.count})`, lx + 5, y + 3);
      lx += 50;
    });

    y += 10;
  }

  // ── Full Results Table ─────────────────────────────────────

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, NAVY);
  doc.text("Detection Results", margin, y);
  y += 4;

  const tableData = results.map((r) => {
    const detail = getResultDetail(r);
    return [
      r.label,
      r.group.charAt(0).toUpperCase() + r.group.slice(1),
      `${Math.round(r.confidence * 100)}%`,
      detail.priority.charAt(0).toUpperCase() + detail.priority.slice(1),
      detail.condition,
      r.opportunityScore != null ? `${r.opportunityScore}` : "—",
      r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`,
      r.tileId,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      ["Detection", "Category", "Conf.", "Priority", "Condition", "Opp.", "Location", "Tile"],
    ],
    body: tableData,
    styles: {
      fontSize: 6.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [NAVY[0], NAVY[1], NAVY[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
    },
    alternateRowStyles: {
      fillColor: [ICE[0], ICE[1], ICE[2]],
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 20 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "center", cellWidth: 16 },
      4: { cellWidth: 30 },
      5: { halign: "center", cellWidth: 12 },
      6: { cellWidth: 36 },
      7: { halign: "center", cellWidth: 14 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        // Color-code category column
        if (data.column.index === 1) {
          const val = String(data.cell.raw).toLowerCase();
          const color = val === "containers" ? BLUSH : val === "equipment" ? AMBER : EMERALD;
          data.cell.styles.textColor = [color[0], color[1], color[2]];
          data.cell.styles.fontStyle = "bold";
        }
        // Color-code priority column
        if (data.column.index === 3) {
          const val = String(data.cell.raw).toLowerCase();
          if (val === "high") {
            data.cell.styles.textColor = [239, 68, 68]; // red
            data.cell.styles.fontStyle = "bold";
          } else if (val === "medium") {
            data.cell.styles.textColor = [AMBER[0], AMBER[1], AMBER[2]];
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  // ── Recommended Actions Page ───────────────────────────────

  // Group by priority
  const highPriority = results.filter((r) => r.confidence > 0.88);
  const medPriority = results.filter((r) => r.confidence > 0.75 && r.confidence <= 0.88);
  const actionItems = [...highPriority, ...medPriority].slice(0, 15);

  if (actionItems.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(doc, NAVY);
    doc.text("Recommended Actions", margin, y);
    y += 4;
    const actionData = actionItems.map((r) => {
      const detail = getResultDetail(r);
      return [
        r.label,
        detail.priority.charAt(0).toUpperCase() + detail.priority.slice(1),
        detail.actionLabel,
        detail.actionDescription,
        `${Math.round(r.confidence * 100)}%`,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Detection", "Priority", "Action", "Description", "Conf."]],
      body: actionData,
      styles: {
        fontSize: 7,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [NAVY[0], NAVY[1], NAVY[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [ICE[0], ICE[1], ICE[2]],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 28 },
        3: { cellWidth: 80 },
        4: { cellWidth: 14, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const val = String(data.cell.raw).toLowerCase();
          if (val === "high") {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "medium") {
            data.cell.styles.textColor = [AMBER[0], AMBER[1], AMBER[2]];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  // ── Footer on each page ────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, ph - 12, pageWidth, 12, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, STEEL);
    doc.text("Container Hunter — ADB Satellite Intelligence | CONFIDENTIAL", margin, ph - 5);

    setColor(doc, BLUSH);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin - 20, ph - 5);
  }

  return doc;
}

// ── CSV Export for Area Scan ──────────────────────────────────

export function generateAreaScanCSV(
  scanArea: ScanArea,
  results: AreaScanResult[],
  locationInfo: LocationInfo | null
): string {
  const headers = [
    "Detection",
    "Category",
    "Group",
    "Confidence (%)",
    "Priority",
    "Condition",
    "Opportunity Score",
    "Address",
    "Latitude",
    "Longitude",
    "Tile ID",
    "Recommended Action",
    "Scan Center Lat",
    "Scan Center Lng",
    "City",
    "State",
    "Report Date",
  ];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = results.map((r) => {
    const detail = getResultDetail(r);
    return [
      esc(r.label),
      esc(r.category),
      esc(r.group),
      Math.round(r.confidence * 100),
      esc(detail.priority),
      esc(detail.condition),
      r.opportunityScore ?? "",
      esc(r.address ?? ""),
      r.lat.toFixed(6),
      r.lng.toFixed(6),
      r.tileId,
      esc(detail.actionLabel),
      scanArea.center.lat.toFixed(6),
      scanArea.center.lng.toFixed(6),
      esc(locationInfo?.city ?? ""),
      esc(locationInfo?.state ?? ""),
      new Date().toISOString().split("T")[0],
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
