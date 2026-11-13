import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Brand blue used by the other PDF exports (see utils/parsers.js).
const PRIMARY = [0, 115, 210]
const INK = [30, 41, 59]
const MUTED = [120, 130, 145]
const BORDER = [200, 208, 218]

// A4 request sheet the worksite keeps: which vehicle, and whether it needs a
// repair or a periodic inspection. No prices and no supplier — those belong to
// the operation logged afterwards. The BL/BC boxes stay blank until that
// operation exists, so the worksite can also fill them in by hand.
// Everything user-facing comes in through `labels` so the sheet follows the
// active UI language; the page owns the translations.
export function generateDemandPdf({ demand, labels }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  const items = Array.isArray(demand.items) ? demand.items : []
  const vehicles = [
    ...new Set(
      items
        .map((item) => {
          const vehicle = item.vehicle
          if (!vehicle) return ''
          return [vehicle.code, vehicle.registration_plate].filter(Boolean).join(' · ')
        })
        .filter(Boolean)
    ),
  ]

  // ---- header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...PRIMARY)
  doc.text(labels.company, margin, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(labels.subtitle, margin, 24)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text(demand.reference || '', pageWidth - margin, 17, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`${labels.date}: ${demand.requested_on || ''}`, pageWidth - margin, 23, {
    align: 'right',
  })

  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.6)
  doc.line(margin, 28, pageWidth - margin, 28)

  // ---- facts ----
  const facts = [
    [labels.worksite, demand.chantier || ''],
    [labels.vehicles, vehicles.join('  |  ')],
    [labels.requestedBy, demand.requested_by || ''],
  ]

  autoTable(doc, {
    startY: 34,
    body: facts,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 2 } },
    columnStyles: {
      0: { cellWidth: 38, textColor: MUTED, fontStyle: 'bold' },
      1: { cellWidth: pageWidth - margin * 2 - 38, textColor: INK },
    },
    margin: { left: margin, right: margin },
  })

  // ---- BL / BC ----
  // Filled from the linked operation when it is known; left blank otherwise so
  // the worksite can write them on the printed sheet.
  let y = (doc.lastAutoTable?.finalY || 60) + 8
  const boxGap = 6
  const boxWidth = (pageWidth - margin * 2 - boxGap) / 2
  const boxHeight = 13
  const boxes = [
    [labels.bl, demand.operation?.reference || ''],
    [labels.bc, demand.operation?.purchase_order || ''],
  ]
  boxes.forEach(([label, value], index) => {
    const x = margin + index * (boxWidth + boxGap)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, boxWidth, boxHeight, 1.5, 1.5, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(String(label).toUpperCase(), x + 3, y + 4.4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(value, x + 3, y + 10)
  })
  y += boxHeight + 8

  // ---- lines ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(labels.articles, margin, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [[labels.kind, labels.vehicle]],
    body: items.length
      ? items.map((item) => [
          labels.kindLabel(item.kind) || '',
          item.vehicle
            ? [item.vehicle.code, item.vehicle.registration_plate].filter(Boolean).join(' · ')
            : '',
        ])
      : [[labels.noArticles, '']],
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2.4, textColor: INK, lineColor: [220, 226, 234] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  })

  // ---- notes ----
  y = (doc.lastAutoTable?.finalY || y) + 10
  if (y > pageHeight - 55) {
    doc.addPage()
    y = 24
  }
  if (demand.notes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(labels.notes, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(demand.notes, pageWidth - margin * 2)
    doc.text(lines, margin, y + 5)
    y += 5 + lines.length * 4.6
  }

  // ---- signatures ----
  if (y > pageHeight - 42) {
    doc.addPage()
    y = 24
  }
  y = Math.max(y + 12, pageHeight - 38)
  const sigWidth = (pageWidth - margin * 2 - 6) / 2
  const signatures = [labels.signRequester, labels.signReceiver]
  signatures.forEach((label, index) => {
    const x = margin + index * (sigWidth + 6)
    doc.setDrawColor(180, 190, 200)
    doc.setLineWidth(0.3)
    doc.line(x, y + 10, x + sigWidth, y + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x, y + 14)
  })

  // ---- footer ----
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(
    `${demand.reference || ''} · ${labels.generated} ${new Date().toLocaleDateString('fr-MA')}`,
    margin,
    pageHeight - 8
  )

  return doc.output('arraybuffer')
}
