/**
 * PDF Report Generator for Container Hunter
 * Generates branded PDF reports with summary stats, detection table,
 * and per-business details.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Business } from "./types";

// ── Brand colors ─────────────────────────────────────────────
const NAVY = [15, 23, 42] as const;       // navy-950
const BLUSH = [199, 163, 155] as const;   // blush-400
const STEEL = [143, 163, 189] as const;   // steel-400
const WHITE = [255, 255, 255] as const;
const ICE = [241, 245, 249] as const;     // ice-200
const EMERALD = [16, 185, 129] as const;
const AMBER = [245, 158, 11] as const;

type RGB = readonly [number, number, number];

function setColor(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

// ── Main export function ─────────────────────────────────────

export function generatePDFReport(
  businesses: Business[],
  reportTitle = "Container Hunter Report"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 0;

  // ── Page 1: Cover + Summary ──────────────────────────────

  // Header bar
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageWidth, 44, "F");

  // Logo / title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  setColor(doc, WHITE);
  doc.text("Container Hunter", margin, 20);

  doc.setFontSize(10);
  setColor(doc, STEEL);
  doc.text("ADB Satellite Intelligence Platform", margin, 30);

  // Report title + date
  doc.setFontSize(9);
  setColor(doc, BLUSH);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`${reportTitle}  |  ${dateStr}`, margin, 38);

  y = 56;

  // ── Summary Stats ────────────────────────────────────────

  const confirmed = businesses.filter((b) => b.status === "confirmed").length;
  const review = businesses.filter((b) => b.status === "review").length;
  const clear = businesses.filter((b) => b.status === "clear").length;
  const totalContainers = businesses.reduce(
    (sum, b) => sum + (b.containersDetected ?? 0),
    0
  );
  const avgOpportunity =
    businesses.length > 0
      ? Math.round(
          businesses.reduce((s, b) => s + (b.opportunityScore ?? 0), 0) /
            businesses.length
        )
      : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, NAVY);
  doc.text("Executive Summary", margin, y);
  y += 8;

  const stats = [
    { label: "Total Businesses Scanned", value: String(businesses.length) },
    { label: "Containers Detected", value: String(totalContainers) },
    { label: "Confirmed Leads", value: String(confirmed) },
    { label: "Needs Review", value: String(review) },
    { label: "Clear Sites", value: String(clear) },
    { label: "Avg Opportunity Score", value: `${avgOpportunity}/100` },
  ];

  // Stat cards — 3 columns x 2 rows
  const cardW = (pageWidth - margin * 2 - 8) / 3;
  const cardH = 20;

  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = margin + col * (cardW + 4);
    const cy = y + row * (cardH + 4);

    doc.setFillColor(ICE[0], ICE[1], ICE[2]);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, STEEL);
    doc.text(stat.label.toUpperCase(), cx + 4, cy + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setColor(doc, NAVY);
    doc.text(stat.value, cx + 4, cy + 16);
  });

  y += 2 * (cardH + 4) + 10;

  // ── Status Breakdown Bar ─────────────────────────────────

  if (businesses.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(doc, NAVY);
    doc.text("Status Breakdown", margin, y);
    y += 6;

    const barW = pageWidth - margin * 2;
    const barH = 8;
    const total = businesses.length;

    const segments = [
      { count: confirmed, color: EMERALD, label: "Confirmed" },
      { count: review, color: AMBER, label: "Review" },
      { count: clear, color: STEEL, label: "Clear" },
    ];

    let bx = margin;
    segments.forEach((seg) => {
      const w = (seg.count / total) * barW;
      if (w > 0) {
        doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
        doc.roundedRect(bx, y, Math.max(w, 2), barH, 1, 1, "F");
        bx += w;
      }
    });

    y += barH + 4;

    // Legend
    let lx = margin;
    doc.setFontSize(7);
    segments.forEach((seg) => {
      doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
      doc.circle(lx + 2, y + 1.5, 1.5, "F");
      setColor(doc, NAVY);
      doc.text(`${seg.label} (${seg.count})`, lx + 5, y + 3);
      lx += 40;
    });

    y += 10;
  }

  // ── Detection Results Table ──────────────────────────────

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, NAVY);
  doc.text("Detection Results", margin, y);
  y += 4;

  const tableData = businesses.map((b) => [
    b.name,
    `${b.city}, ${b.state}`,
    String(b.containersDetected ?? 0),
    b.confidence ? `${Math.round(b.confidence * 100)}%` : "—",
    (b.status ?? "pending").charAt(0).toUpperCase() + (b.status ?? "pending").slice(1),
    String(b.opportunityScore ?? 0),
    b.estimatedDemand ?? "—",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
      [
        "Business",
        "Location",
        "Containers",
        "Confidence",
        "Status",
        "Opp. Score",
        "Est. Demand",
      ],
    ],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
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
      0: { cellWidth: 40 },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
    },
    didParseCell: (data) => {
      // Color-code status column
      if (data.section === "body" && data.column.index === 4) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === "confirmed") {
          data.cell.styles.textColor = [EMERALD[0], EMERALD[1], EMERALD[2]];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "review") {
          data.cell.styles.textColor = [AMBER[0], AMBER[1], AMBER[2]];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // ── Per-business detail pages (for confirmed + review only) ──

  const detailBusinesses = businesses.filter(
    (b) => b.status === "confirmed" || b.status === "review"
  );

  if (detailBusinesses.length > 0) {
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(doc, NAVY);
    doc.text("Detailed Detection Reports", margin, y);
    y += 8;

    for (const biz of detailBusinesses) {
      // Check if we need a new page
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      // Business card
      doc.setFillColor(ICE[0], ICE[1], ICE[2]);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 36, 2, 2, "F");

      // Status indicator
      const statusColor =
        biz.status === "confirmed" ? EMERALD : biz.status === "review" ? AMBER : STEEL;
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(margin, y, 3, 36, 1, 1, "F");

      // Business name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor(doc, NAVY);
      doc.text(biz.name, margin + 7, y + 7);

      // Address
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(doc, STEEL);
      doc.text(
        `${biz.address}, ${biz.city}, ${biz.state} ${biz.zip}`,
        margin + 7,
        y + 13
      );

      // Coordinates
      if (biz.lat && biz.lng) {
        doc.text(
          `${biz.lat.toFixed(4)}°N, ${Math.abs(biz.lng).toFixed(4)}°W`,
          margin + 7,
          y + 18
        );
      }

      // Stats row
      const statsY = y + 25;
      const detailStats = [
        { label: "Containers", value: String(biz.containersDetected ?? 0) },
        { label: "Confidence", value: `${Math.round((biz.confidence ?? 0) * 100)}%` },
        { label: "Opportunity", value: `${biz.opportunityScore ?? 0}/100` },
        { label: "Demand", value: biz.estimatedDemand ?? "—" },
        { label: "Phase", value: biz.constructionPhase ?? "—" },
      ];

      let sx = margin + 7;
      detailStats.forEach((s) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        setColor(doc, STEEL);
        doc.text(s.label.toUpperCase(), sx, statsY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setColor(doc, NAVY);
        doc.text(s.value, sx, statsY + 5);

        sx += 32;
      });

      // Detection breakdown
      const detections = biz.containerDetails ?? [];
      if (detections.length > 0) {
        const validCount = detections.filter(
          (d) => !d.excluded && d.confidence >= 0.45
        ).length;
        const excludedCount = detections.filter((d) => d.excluded).length;

        doc.setFontSize(6);
        setColor(doc, STEEL);
        doc.text(
          `${detections.length} objects detected | ${validCount} valid | ${excludedCount} trailers excluded`,
          pageWidth - margin - 70,
          y + 7
        );
      }

      y += 42;
    }
  }

  // ── Footer on each page ──────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, ph - 12, pageWidth, 12, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, STEEL);
    doc.text("Container Hunter — ADB Satellite Intelligence", margin, ph - 5);

    setColor(doc, BLUSH);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin - 20, ph - 5);
  }

  return doc;
}

// ── Enhanced CSV export ──────────────────────────────────────

export function generateEnhancedCSV(businesses: Business[]): string {
  const headers = [
    "Business Name",
    "Address",
    "City",
    "State",
    "Zip",
    "Latitude",
    "Longitude",
    "Containers Detected",
    "Confidence (%)",
    "Status",
    "Construction Score",
    "Opportunity Score",
    "Estimated Demand",
    "Construction Phase",
    "Container Types",
    "Excluded Count",
    "Report Date",
  ];

  const rows = businesses.map((b) => {
    const detections = b.containerDetails ?? [];
    const valid = detections.filter((d) => !d.excluded && d.confidence >= 0.45);
    const excluded = detections.filter((d) => d.excluded);
    const types = valid
      .map((d) => (d.type === "40ft" ? "40ft" : d.type === "trailer" ? "Trailer" : "Other"))
      .join("; ");

    return [
      `"${b.name}"`,
      `"${b.address}"`,
      `"${b.city}"`,
      b.state,
      b.zip,
      b.lat?.toFixed(6) ?? "",
      b.lng?.toFixed(6) ?? "",
      b.containersDetected ?? 0,
      b.confidence ? Math.round(b.confidence * 100) : "",
      b.status ?? "pending",
      b.constructionScore ?? 0,
      b.opportunityScore ?? 0,
      b.estimatedDemand ?? "None",
      b.constructionPhase ?? "",
      `"${types}"`,
      excluded.length,
      new Date().toISOString().split("T")[0],
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
