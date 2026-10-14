import { jsPDF } from 'jspdf'
import { sectionHeading, toRoman } from './sectionLabels'
import { flattenSections, getElementNumbering, nonEmpty, sectionElements } from './paperStructure'
import { getPaperMetadata } from './paperMetadata'
import { latexToPdfText } from './latexToPdfText'
import html2canvas from 'html2canvas'
import { isMathParseError, renderMathToString } from './mathRendering'

const pageSize = { width: 595.28, height: 841.89 }
const margin = 42
const columnGap = 18
const columnWidth = (pageSize.width - margin * 2 - columnGap) / 2
const bodyBottom = pageSize.height - 44

function sanitizeFilename(title) {
  return (title || 'research-paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'research-paper'
}

function writeFullWidthBlock(doc, { label, content, x, y, width, labelWidth, size, leading, labelStyle = 'bold', contentStyle = 'normal' }) {
  doc.setFont('times', contentStyle)
  doc.setFontSize(size)
  const lines = doc.splitTextToSize(content || '', width - labelWidth)
  for (let index = 0; index < Math.max(lines.length, 1); index += 1) {
    if (y + leading > bodyBottom) {
      doc.addPage()
      y = margin
    }
    if (index === 0) {
      doc.setFont('times', labelStyle)
      doc.text(label, x, y)
    }
    if (lines[index]) {
      doc.setFont('times', contentStyle)
      doc.text(lines[index], x + labelWidth, y)
    }
    y += leading
  }
  return y
}

function createFlow(doc, startY) {
  let y = startY
  let column = 0
  let page = doc.getNumberOfPages() - 1
  const columnTop = () => page === 0 ? startY : margin
  const move = () => {
    if (column === 0) { column = 1; y = columnTop() } else { doc.addPage(); page += 1; column = 0; y = columnTop() }
  }
  const x = () => margin + column * (columnWidth + columnGap)
  const room = (height) => bodyBottom - y >= height
  const ensure = (height) => {
    const columnHeight = bodyBottom - margin
    if (height > columnHeight) {
      if (y > columnTop()) move()
      return
    }
    while (!room(height)) move()
  }
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
  const writeHeading = (text, options, nextLineHeight) => {
    const leading = options.leading ?? (options.size ?? 9) * 1.28
    ensure(leading + nextLineHeight)
    writeLines(text, options)
  }
  const space = (amount) => { if (!room(amount)) ensure(amount); y += amount }
  return { x, y: () => y, ensure, writeLines, writeHeading, space, move, room }
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

async function renderEquationImage(source) {
  const markup = renderMathToString(source)
  const container = document.createElement('div')
  container.className = 'math-expression pdf-equation-render'
  container.innerHTML = markup
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${columnWidth}px`,
    padding: '4px 0',
    color: '#151a1b',
    backgroundColor: '#ffffff',
    fontSize: '12px',
  })
  document.body.appendChild(container)
  try {
    if (document.fonts?.ready) await document.fonts.ready
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      logging: false,
      scale: 3,
      width: container.scrollWidth,
      height: container.scrollHeight,
    })
    return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
  } finally {
    container.remove()
  }
}

async function drawEquation(flow, doc, source) {
  let image
  try {
    image = await renderEquationImage(source)
  } catch (error) {
    if (!isMathParseError(error)) throw error
    flow.writeLines(`Equation could not be rendered: ${latexToPdfText(source)}`, { size: 8, leading: 10 })
    flow.space(5)
    return
  }
  const width = columnWidth
  const height = image.height * width / image.width
  flow.ensure(height + 8)
  doc.addImage(image.data, 'PNG', flow.x(), flow.y(), width, height)
  flow.space(height + 8)
}

export async function exportPaperToPdf(paper) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const { authors, affiliations } = getPaperMetadata(paper)
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
  if (authors.length) {
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    const authorLines = doc.splitTextToSize(authors.map((author) => `${author.name}${author.affiliationNumbers.length ? ` ${author.affiliationNumbers.join(',')}` : ''}`).join(', '), fullWidth)
    doc.text(authorLines, pageSize.width / 2, headerY, { align: 'center' })
    headerY += authorLines.length * 12 + 2
  }
  if (affiliations.length) {
    doc.setFont('times', 'italic')
    doc.setFontSize(8.5)
    const affiliationLines = doc.splitTextToSize(affiliations.map((affiliation) => `${affiliation.number}. ${affiliation.name}`).join('   '), fullWidth)
    doc.text(affiliationLines, pageSize.width / 2, headerY, { align: 'center' })
    headerY += affiliationLines.length * 11 + 8
  }
  doc.setDrawColor(190, 197, 193); doc.line(margin, headerY, pageSize.width - margin, headerY); headerY += 15
  if (fullWidthAbstract) {
    headerY = writeFullWidthBlock(doc, { label: 'Abstract—', content: paper.abstract || 'No abstract has been added to this paper yet.', x: margin, y: headerY, width: fullWidth, labelWidth: 42, size: 9, leading: 10 })
    headerY += 8
    if (keywords.length) headerY = writeFullWidthBlock(doc, { label: 'Index Terms—', content: keywords.join(', '), x: margin, y: headerY, width: fullWidth, labelWidth: 58, size: 8.2, leading: 10, labelStyle: 'bold', contentStyle: 'italic' }) + 8
  }
  const flow = createFlow(doc, headerY + 8)
  if (!fullWidthAbstract) {
    flow.writeHeading('ABSTRACT', { size: 9.5, style: 'bold', leading: 12, color: [26, 47, 42] }, 11.5)
    flow.writeLines(paper.abstract || 'No abstract has been added to this paper yet.', { size: 8.8, leading: 11.5 })
    flow.space(5)
    if (keywords.length) { flow.writeLines(`Index Terms— ${keywords.join(', ')}`, { size: 8.2, style: 'italic', leading: 10.5 }); flow.space(5) }
  }
  const numbers = getElementNumbering(paper)
  for (const { section, path } of flattenSections(paper.sections)) {
    flow.space(4)
    flow.writeHeading(sectionHeading(section, path).toUpperCase(), { size: path.length === 1 ? 9.5 : 8.7, style: 'bold', leading: 12, color: [26, 47, 42] }, 11.5)
    flow.space(2)
    for (const element of sectionElements(section)) {
      const displayNumber = numbers[element.id]?.value
      if (element.type === 'figure') drawFigure(flow, doc, { ...element, displayNumber })
      else if (element.type === 'chart') { drawChart(flow, doc, { ...element, displayNumber }) }
      else if (element.type === 'table') { drawTable(flow, doc, { ...element, number: toRoman(displayNumber) }) }
      else if (element.type === 'bullet-list' || element.type === 'numbered-list') { (element.items ?? []).forEach((item, index) => flow.writeLines(`${element.type === 'bullet-list' ? '•' : `${index + 1}.`} ${item}`, { size: 8.8, leading: 11.5, indent: 7 })); flow.space(5) }
      else if (element.type === 'equation') await drawEquation(flow, doc, element.content)
      else if (element.type === 'quote') { flow.writeLines(`“${element.content ?? ''}”${element.source ? ` — ${element.source}` : ''}`, { size: 8.5, style: 'italic', leading: 11.5, indent: 10 }); flow.space(5) }
      else if (element.type === 'code') { flow.writeLines(element.content ?? '', { size: 7.5, leading: 9, indent: 8 }); flow.space(5) }
      else if (element.type === 'heading') { flow.writeLines(element.content ?? '', { size: 8.7, style: 'bold', leading: 12 }); flow.space(3) }
      else { flow.writeLines(element.content ?? '', { size: 8.8, leading: 11.5 }); flow.space(5) }
    }
  }
  if (paper.references.length) {
    flow.space(6)
    flow.writeHeading('REFERENCES', { size: 9.5, style: 'bold', leading: 12, color: [26, 47, 42] }, 10.5)
    paper.references.forEach((reference, index) => { flow.writeLines(`[${index + 1}] ${reference}`, { size: 8, leading: 10.5, indent: 0 }); flow.space(2) })
  }
  doc.save(`${sanitizeFilename(paper.title)}.pdf`)
}
