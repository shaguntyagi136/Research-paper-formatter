import { jsPDF } from 'jspdf'
import { sectionHeading, toRoman } from './sectionLabels'
import { flattenSections, getElementNumbering, nonEmpty, sectionElements } from './paperStructure'

const pageSize = { width: 595.28, height: 841.89 }
const margin = 42
const columnGap = 18
const columnWidth = (pageSize.width - margin * 2 - columnGap) / 2
const bodyBottom = pageSize.height - 44

function sanitizeFilename(title) {
  return (title || 'research-paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'research-paper'
}

function createFlow(doc, startY) {
  let y = startY
  let column = 0
  let page = 0
  const columnTop = () => page === 0 ? startY : margin
  const move = () => {
    if (column === 0) { column = 1; y = columnTop() } else { doc.addPage(); page += 1; column = 0; y = columnTop() }
  }
  const x = () => margin + column * (columnWidth + columnGap)
  const room = (height) => bodyBottom - y >= height
  const ensure = (height) => { if (!room(height) && y > columnTop()) move() }
  const lines = (text, width = columnWidth) => doc.splitTextToSize(String(text || ''), width)
  const writeLines = (text, options = {}) => {
    const { size = 9, style = 'normal', leading = size * 1.28, indent = 0, color = [20, 29, 34] } = options
    doc.setFont('times', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    for (const sourceLine of String(text || '').split(/\n+/)) {
      const wrapped = lines(sourceLine, columnWidth - indent)
      for (const line of wrapped) {
        ensure(leading)
        doc.text(line, x() + indent, y)
        y += leading
      }
    }
  }
  const space = (amount) => { if (!room(amount)) move(); else y += amount }
  return { x, y: () => y, ensure, writeLines, space, move, room }
}

function drawTable(flow, doc, element) {
  const headers = element.headers ?? []
  const rows = element.rows ?? []
  const allRows = headers.length ? [headers, ...rows] : rows
  if (!allRows.length) return
  const columns = Math.max(...allRows.map((row) => row.length), 1)
  const cellWidth = columnWidth / columns
  flow.space(3)
  flow.writeLines(`TABLE ${element.number ?? ''} ${element.caption ?? ''}`.trim(), { size: 7.5, style: 'bold', leading: 9, color: [45, 62, 57] })
  allRows.forEach((row, rowIndex) => {
    doc.setFont('times', rowIndex === 0 && headers.length ? 'bold' : 'normal')
    doc.setFontSize(7)
    const cells = Array.from({ length: columns }, (_, index) => doc.splitTextToSize(String(row[index] ?? ''), cellWidth - 7))
    const rowHeight = Math.max(15, ...cells.map((cell) => cell.length * 8 + 7))
    flow.ensure(rowHeight)
    cells.forEach((cell, cellIndex) => {
      const cellX = flow.x() + cellIndex * cellWidth
      doc.setDrawColor(145, 155, 151)
      doc.rect(cellX, flow.y(), cellWidth, rowHeight)
      doc.text(cell, cellX + 3.5, flow.y() + 9)
    })
    flow.space(rowHeight)
  })
  flow.space(5)
}

function drawFigure(flow, doc, element) {
  const figureHeight = 95
  flow.ensure(figureHeight + 22)
  const figureX = flow.x()
  let imageRendered = false
  if (element.imageUrl?.startsWith('data:image/')) {
    try { doc.addImage(element.imageUrl, 'JPEG', figureX, flow.y(), columnWidth, figureHeight); imageRendered = true } catch { imageRendered = false }
  }
  if (!imageRendered) {
    doc.setDrawColor(165, 174, 169)
    doc.setFillColor(246, 248, 247)
    doc.rect(figureX, flow.y(), columnWidth, figureHeight, 'FD')
    doc.setTextColor(112, 126, 119)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Figure', figureX + columnWidth / 2, flow.y() + figureHeight / 2, { align: 'center' })
  }
  flow.space(figureHeight + 4)
  flow.writeLines(`Fig. ${element.displayNumber}. ${element.caption || 'Figure caption'}`, { size: 7.5, style: 'italic', leading: 9 })
  flow.space(5)
}

function drawChart(flow, doc, element) {
  const height = 104
  const values = (element.data ?? []).map((row) => ({ category: String(row.category ?? ''), value: Number(row.value) || 0 }))
  const max = Math.max(...values.map((row) => row.value), 1)
  flow.ensure(height + 24)
  const x = flow.x()
  const y = flow.y()
  doc.setDrawColor(170, 182, 176)
  doc.line(x + 18, y + 8, x + 18, y + height - 16)
  doc.line(x + 18, y + height - 16, x + columnWidth - 4, y + height - 16)
  const plotWidth = columnWidth - 28
  if (element.chartType === 'line') {
    values.forEach((row, index) => {
      const pointX = x + 22 + (values.length < 2 ? plotWidth / 2 : index * plotWidth / (values.length - 1))
      const pointY = y + height - 20 - (row.value / max) * (height - 34)
      doc.setFillColor(47, 109, 98); doc.circle(pointX, pointY, 2.2, 'F')
      if (index) { const previous = values[index - 1]; const previousX = x + 22 + (index - 1) * plotWidth / (values.length - 1); const previousY = y + height - 20 - (previous.value / max) * (height - 34); doc.setDrawColor(47, 109, 98); doc.setLineWidth(1.4); doc.line(previousX, previousY, pointX, pointY) }
      doc.setTextColor(74, 86, 80); doc.setFontSize(6.5); doc.text(row.category.slice(0, 14), pointX, y + height - 7, { align: 'center' })
    })
  } else {
    const barGap = 4
    const barWidth = Math.max(10, (plotWidth - barGap * Math.max(values.length - 1, 0)) / Math.max(values.length, 1))
    values.forEach((row, index) => {
      const barHeight = (row.value / max) * (height - 34)
      const barX = x + 22 + index * (barWidth + barGap)
      doc.setFillColor(63, 124, 112); doc.rect(barX, y + height - 20 - barHeight, barWidth, barHeight, 'F')
      doc.setTextColor(74, 86, 80); doc.setFontSize(6.5); doc.text(row.category.slice(0, 12), barX + barWidth / 2, y + height - 7, { align: 'center' })
    })
  }
  flow.space(height + 2)
  flow.writeLines(`Fig. ${element.displayNumber}. ${element.caption || element.title || 'Chart'}`, { size: 7.5, style: 'italic', leading: 9 })
  flow.space(5)
}

export async function exportPaperToPdf(paper) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const authors = nonEmpty(paper.authors ?? [])
  const affiliations = nonEmpty(paper.affiliations ?? [])
  const keywords = nonEmpty(paper.keywords ?? [])
  const fullWidth = pageSize.width - margin * 2
  let headerY = 54
  const fullWidthAbstract = (paper.abstractLayout ?? 'full-width') === 'full-width'
  doc.setTextColor(20, 29, 34)
  doc.setFont('times', 'bold')
  doc.setFontSize(17)
  const titleLines = doc.splitTextToSize(paper.title || 'Untitled Research Paper', fullWidth)
  doc.text(titleLines, pageSize.width / 2, headerY, { align: 'center' })
  headerY += titleLines.length * 20 + 8
  if (authors.length) { doc.setFont('times', 'normal'); doc.setFontSize(10); doc.text(authors.join(', '), pageSize.width / 2, headerY, { align: 'center' }); headerY += 14 }
  if (affiliations.length) { doc.setFont('times', 'italic'); doc.setFontSize(8.5); doc.text(affiliations.join(' · '), pageSize.width / 2, headerY, { align: 'center' }); headerY += 19 }
  doc.setDrawColor(190, 197, 193); doc.line(margin, headerY, pageSize.width - margin, headerY); headerY += 15
  if (fullWidthAbstract) {
    doc.setFont('times', 'bold'); doc.setFontSize(9); doc.text('Abstract—', margin, headerY)
    doc.setFont('times', 'normal'); const abstractX = margin + 42; const abstractLines = doc.splitTextToSize(paper.abstract || 'No abstract has been added to this paper yet.', fullWidth - 42); doc.text(abstractLines, abstractX, headerY); headerY += Math.max(abstractLines.length * 10, 10) + 8
    if (keywords.length) { doc.setFont('times', 'bold'); doc.text('Index Terms—', margin, headerY); doc.setFont('times', 'italic'); doc.text(doc.splitTextToSize(keywords.join(', '), fullWidth - 58), margin + 58, headerY); headerY += 17 }
  }
  const flow = createFlow(doc, headerY + 8)
  if (!fullWidthAbstract) {
    flow.writeLines('ABSTRACT', { size: 9.5, style: 'bold', leading: 12, color: [26, 47, 42] })
    flow.writeLines(paper.abstract || 'No abstract has been added to this paper yet.', { size: 8.8, leading: 11.5 })
    flow.space(5)
    if (keywords.length) { flow.writeLines(`Index Terms— ${keywords.join(', ')}`, { size: 8.2, style: 'italic', leading: 10.5 }); flow.space(5) }
  }
  const numbers = getElementNumbering(paper)
  flattenSections(paper.sections).forEach(({ section, path }) => {
    flow.space(4)
    flow.writeLines(sectionHeading(section, path).toUpperCase(), { size: path.length === 1 ? 9.5 : 8.7, style: 'bold', leading: 12, color: [26, 47, 42] })
    flow.space(2)
    sectionElements(section).forEach((element) => {
      const displayNumber = numbers[element.id]?.value
      if (element.type === 'figure') drawFigure(flow, doc, { ...element, displayNumber })
      else if (element.type === 'chart') { drawChart(flow, doc, { ...element, displayNumber }) }
      else if (element.type === 'table') { drawTable(flow, doc, { ...element, number: toRoman(displayNumber) }) }
      else if (element.type === 'bullet-list' || element.type === 'numbered-list') { (element.items ?? []).forEach((item, index) => flow.writeLines(`${element.type === 'bullet-list' ? '•' : `${index + 1}.`} ${item}`, { size: 8.8, leading: 11.5, indent: 7 })); flow.space(5) }
      else if (element.type === 'equation') { flow.writeLines(element.content ?? '', { size: 10, style: 'italic', leading: 14, indent: 14 }); flow.space(5) }
      else if (element.type === 'quote') { flow.writeLines(`“${element.content ?? ''}”${element.source ? ` — ${element.source}` : ''}`, { size: 8.5, style: 'italic', leading: 11.5, indent: 10 }); flow.space(5) }
      else if (element.type === 'code') { flow.writeLines(element.content ?? '', { size: 7.5, leading: 9, indent: 8 }); flow.space(5) }
      else if (element.type === 'heading') { flow.writeLines(element.content ?? '', { size: 8.7, style: 'bold', leading: 12 }); flow.space(3) }
      else { flow.writeLines(element.content ?? '', { size: 8.8, leading: 11.5 }); flow.space(5) }
    })
  })
  if (paper.references.length) {
    flow.space(6)
    flow.writeLines('REFERENCES', { size: 9.5, style: 'bold', leading: 12, color: [26, 47, 42] })
    paper.references.forEach((reference, index) => { flow.writeLines(`[${index + 1}] ${reference}`, { size: 8, leading: 10.5, indent: 0 }); flow.space(2) })
  }
  doc.save(`${sanitizeFilename(paper.title)}.pdf`)
}
