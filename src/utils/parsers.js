import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Parse CSV file
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const firstLine = text.split(/\r?\n/)[0] || ''
      const semicolons = (firstLine.match(/;/g) || []).length
      const commas = (firstLine.match(/,/g) || []).length
      const delimiter = semicolons > commas ? ';' : ','

      Papa.parse(text, {
        header: true,
        delimiter,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      })
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * Parse Excel file
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        // Use first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse an Excel workbook and return every sheet, preserving a rows-by-sheet map.
 * The import wizard uses this to let the user pick a sheet before mapping columns.
 */
export function parseExcelWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const rowsBySheet = {}
        workbook.SheetNames.forEach((name) => {
          rowsBySheet[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' })
        })
        resolve({ sheetNames: workbook.SheetNames, rowsBySheet })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse a CSV or Excel file. CSV is always treated as a single stream of rows;
 * Excel returns the sheet list so the caller can pick a sheet.
 */
export async function parseImportFile(file, sheetName) {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const rows = await parseCSV(file)
    return { sheetNames: [], selectedSheet: null, rows }
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { sheetNames, rowsBySheet } = await parseExcelWorkbook(file)
    const target = sheetName || sheetNames[0] || null
    return {
      sheetNames,
      selectedSheet: target,
      rows: target ? rowsBySheet[target] || [] : [],
    }
  }

  const error = new Error('Unsupported file format')
  error.code = 'UNSUPPORTED'
  throw error
}

/**
 * Generate CSV export
 */
export function generateCSV(data, columns) {
  const headers = columns.map((c) => c.label)
  const rows = data.map((item) => columns.map((c) => item[c.key] ?? ''))

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return csvContent
}

/**
 * Generate Excel export
 */
export function generateExcel(data, columns, sheetName = 'Export') {
  const headers = columns.map((c) => c.label)
  const rows = data.map((item) => columns.map((c) => item[c.key] ?? ''))

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const colWidths = columns.map((c) => ({ wch: Math.max(c.label.length, 15) }))
  ws['!cols'] = colWidths

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

/**
 * Generate PDF export
 */
export function generatePDF(data, columns, title = 'SMG Fleet Export') {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' })

  doc.setFontSize(16)
  doc.text(title, 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleDateString('fr-MA')}`, 14, 28)
  doc.text(`Total: ${data.length} records`, 14, 34)

  const headers = columns.map((c) => c.label)
  const rows = data.map((item) =>
    columns.map((c) => {
      const val = item[c.key]
      return val !== null && val !== undefined ? String(val) : ''
    })
  )

  autoTable(doc, {
    startY: 40,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 115, 210], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 40 },
  })

  return doc.output('arraybuffer')
}

/**
 * Download file
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename with timestamp
 */
export function generateExportFilename(prefix, extension) {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-')
  return `${prefix}-${timestamp}.${extension}`
}