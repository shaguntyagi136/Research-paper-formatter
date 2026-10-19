import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import html2canvas from 'html2canvas'
import { sectionHeading, toRoman } from './sectionLabels'
import { flattenSections, getElementNumbering, nonEmpty, sectionElements } from './paperStructure'
import { getPaperMetadata } from './paperMetadata'
import { normalizeMathSource, renderMathToString } from './mathRendering'

const page = {
  width: 12240,
  height: 15840,
  margin: { top: 1080, right: 893, bottom: 1440, left: 893 },
}

const black = '000000'

function sanitizeFilename(title) {
  return (title || 'research-paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'research-paper'
}

function textRuns(value, options = {}) {
  const lines = String(value ?? '').split('\n')
  return lines.flatMap((line, index) => [
    ...(index ? [new TextRun({ break: 1 })] : []),
    new TextRun({ text: line, ...options }),
  ])
}

function paragraph(value, options = {}) {
  const { textOptions, ...paragraphOptions } = options
  return new Paragraph({ children: textRuns(value, textOptions), widowControl: true, ...paragraphOptions })
}

function pageProperties(columns) {
  return {
    page: { size: { width: page.width, height: page.height }, margin: page.margin },
    type: SectionType.CONTINUOUS,
    ...(columns ? { column: { count: 2, space: 720 } } : { column: { count: 1, space: 0 } }),
  }
}

function normalizeAbstractLayout(value) {
  return value === 'full-width' ? 'full-width' : 'two-columns'
}

const authorTableBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: black },
  bottom: { style: BorderStyle.NONE, size: 0, color: black },
  left: { style: BorderStyle.NONE, size: 0, color: black },
  right: { style: BorderStyle.NONE, size: 0, color: black },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: black },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: black },
}

function authorGroups(authors, affiliations) {
  return authors.map((author) => ({
    authors: [author],
    affiliationDetails: author.affiliationNumbers
      .map((number) => affiliations.find((affiliation) => affiliation.number === number))
      .filter(Boolean),
  }))
}

function authorCell(group, width) {
  const names = group.authors.map((author) => {
    const references = author.affiliationNumbers.map((number) => new TextRun({ text: String(number), superScript: true, color: black, size: 18, font: 'Times New Roman' }))
    return [
      new TextRun({ text: author.name, color: black, size: 22, font: 'Times New Roman' }),
      ...references,
    ]
  }).flat()
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, keepLines: true, spacing: { after: 30 }, children: names }),
  ]
  if (group.affiliationDetails.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      spacing: { after: 20 },
      children: group.affiliationDetails.flatMap((affiliation, index) => [
        ...(index ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: affiliation.name, italics: true, color: black, size: 18, font: 'Times New Roman' }),
      ]),
    }))
  }
  const emails = group.authors.map((author) => author.email.trim()).filter(Boolean)
  if (emails.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      spacing: { after: 20 },
      children: [new TextRun({ text: emails.join('; '), color: black, size: 18, font: 'Times New Roman' })],
    }))
  }
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children,
  })
}

function authorBlock(authors, affiliations) {
  if (!authors.length) return []
  const groups = authorGroups(authors, affiliations)
  const columns = groups.length === 1 ? 1 : groups.length === 2 ? 2 : 3
  const rows = []
  for (let index = 0; index < groups.length; index += columns) {
    const rowGroups = groups.slice(index, index + columns)
    rows.push(new TableRow({
      children: [
        ...rowGroups.map((group) => authorCell(group, 100 / columns)),
        ...Array.from({ length: columns - rowGroups.length }, () => new TableCell({ width: { size: 100 / columns, type: WidthType.PERCENTAGE }, children: [paragraph('')], borders: authorTableBorders })),
      ],
    }))
  }
  return [new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: authorTableBorders,
    rows,
  })]
}

function titleBlock(paper, authors, affiliations) {
  const children = [
    paragraph(paper.title || 'Untitled Research Paper', {
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      textOptions: { bold: true, color: black, size: 48, font: 'Times New Roman' },
    }),
  ]
  children.push(...authorBlock(authors, affiliations))
  return children
}

function abstractBlock(paper, keywords) {
  return [
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      keepLines: true,
      spacing: { after: 120, line: 228 },
      children: [
        new TextRun({ text: 'Abstract—', bold: true, color: black, size: 18, font: 'Times New Roman' }),
        ...textRuns(paper.abstract || 'No abstract has been added to this paper yet.', { color: black, size: 18, font: 'Times New Roman' }),
      ],
    }),
    ...(keywords.length ? [paragraph(`Index Terms—${keywords.join(', ')}`, { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, textOptions: { color: black, italics: true, size: 18, font: 'Times New Roman' } })] : []),
  ]
}

async function imageDataFromUrl(url) {
  if (!url?.startsWith('data:image/')) return null
  const mimeType = url.slice(5, url.indexOf(';')).toLowerCase()
  const type = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[mimeType]
  if (!type) return null
  const response = await fetch(url)
  const image = new window.Image()
  image.src = url
  await image.decode()
  return { data: new Uint8Array(await response.arrayBuffer()), type, width: image.naturalWidth, height: image.naturalHeight }
}

async function renderEquationImage(source) {
  const container = window.document.createElement('div')
  container.className = 'math-expression word-equation-render'
  container.innerHTML = renderMathToString(source)
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    display: 'inline-block',
    padding: '2px 4px',
    color: '#000000',
    backgroundColor: 'transparent',
    fontSize: '16px',
    lineHeight: '1',
  })
  window.document.body.appendChild(container)
  try {
    if (window.document.fonts?.ready) await window.document.fonts.ready
    const canvas = await html2canvas(container, {
      backgroundColor: null,
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

function tableBlock(element, number) {
  const headers = element.headers ?? []
  const rows = element.rows ?? []
  const allRows = headers.length ? [headers, ...rows] : rows
  const columns = Math.max(...allRows.map((row) => row.length), 1)
  const tableRows = allRows.map((row, rowIndex) => new TableRow({
    children: Array.from({ length: columns }, (_, index) => new TableCell({
      children: [paragraph(row[index] ?? '', { textOptions: { bold: rowIndex === 0 && headers.length > 0, color: black, size: 16, font: 'Times New Roman' } })],
      width: { size: 100 / columns, type: WidthType.PERCENTAGE },
    })),
  }))
  return [
    paragraph(`TABLE ${toRoman(number)}`, { alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: element.caption ? 20 : 80, line: 216 }, textOptions: { bold: true, color: black, size: 16, font: 'Times New Roman' } }),
    ...(element.caption ? [paragraph(element.caption, { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 80, line: 216 }, textOptions: { color: black, size: 16, font: 'Times New Roman' } })] : []),
    ...(tableRows.length ? [new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' }, top: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' }, left: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' }, right: { style: BorderStyle.SINGLE, size: 2, color: 'A0AAA5' } } })] : []),
  ]
}

async function elementBlocks(element, numbers) {
  const number = numbers[element.id]?.value
  if (element.type === 'figure') {
    const image = await imageDataFromUrl(element.imageUrl)
    return [
      ...(image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, keepNext: true, children: [new ImageRun({ data: image.data, transformation: { width: Math.min(430, image.width || 430), height: Math.min(300, (image.height || 150) * Math.min(430 / (image.width || 430), 1)) }, type: image.type })] })] : []),
      paragraph(`Fig. ${number}. ${element.caption || 'Figure caption'}`, { alignment: AlignmentType.LEFT, spacing: { after: 80, before: 40, line: 216 }, textOptions: { color: black, size: 16, font: 'Times New Roman' } }),
    ]
  }
  if (element.type === 'chart') {
    const chartRows = (element.data ?? []).map((row) => `${row.category ?? ''}: ${row.value ?? ''}`).join('; ')
    return [paragraph(`Fig. ${number}. ${element.caption || element.title || 'Chart'} — ${chartRows || 'No chart data'}`, { alignment: AlignmentType.LEFT, spacing: { after: 80, before: 40, line: 216 }, textOptions: { color: black, size: 16, font: 'Times New Roman' } })]
  }
  if (element.type === 'table') return tableBlock(element, number)
  if (element.type === 'bullet-list' || element.type === 'numbered-list') {
    return (element.items ?? []).map((item) => paragraph(item, {
      bullet: element.type === 'bullet-list' ? { level: 0 } : undefined,
      numbering: element.type === 'numbered-list' ? { reference: 'paper-numbered-list', level: 0 } : undefined,
      spacing: { after: 40, line: 228 },
      textOptions: { color: black, size: 18, font: 'Times New Roman' },
    }))
  }
  if (element.type === 'equation') {
    const source = normalizeMathSource(element.content ?? '') || '(empty equation)'
    try {
      const image = await renderEquationImage(source)
      const width = Math.min(430, image.width / 3)
      return [new Paragraph({ alignment: AlignmentType.CENTER, keepLines: true, spacing: { before: 120, after: 120 }, children: [new ImageRun({ data: image.data, transformation: { width, height: (image.height / image.width) * width }, type: 'png' })] })]
    } catch {
      return [paragraph(`Equation: ${source}`, { alignment: AlignmentType.CENTER, keepLines: true, spacing: { before: 120, after: 120 }, textOptions: { color: black, size: 16, font: 'Times New Roman' } })]
    }
  }
  if (element.type === 'quote')   return [paragraph(`“${element.content ?? ''}”${element.source ? ` — ${element.source}` : ''}`, { indent: { left: 360, right: 360 }, spacing: { after: 120, line: 228 }, textOptions: { color: black, italics: true, size: 17, font: 'Times New Roman' } })]
  if (element.type === 'code') return [paragraph(element.content ?? '', { shading: { fill: 'F1F3F2' }, spacing: { after: 100 }, textOptions: { color: black, size: 15, font: 'Courier New' } })]
  if (element.type === 'heading') return [paragraph(element.content ?? '', { keepNext: true, keepLines: true, spacing: { before: 120, after: 60 }, textOptions: { bold: true, color: black, size: 18, font: 'Times New Roman' } })]
  return [paragraph(element.content ?? '', { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 288 }, spacing: { after: 120, line: 228 }, textOptions: { color: black, size: 18, font: 'Times New Roman' } })]
}

export async function exportPaperToWord(paper) {
  const { authors, affiliations } = getPaperMetadata(paper)
  const keywords = nonEmpty(paper.keywords ?? [])
  const abstractLayout = normalizeAbstractLayout(paper.abstractLayout)
  const numbers = getElementNumbering(paper)
  const titleChildren = titleBlock(paper, authors, affiliations)
  const abstractChildren = abstractBlock(paper, keywords)
  const bodyChildren = []

  for (const { section, path } of flattenSections(paper.sections)) {
    const headingLevel = path.length === 1 ? HeadingLevel.HEADING_1 : path.length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
    const headingText = path.length === 1 ? sectionHeading(section, path).toUpperCase() : sectionHeading(section, path)
    bodyChildren.push(paragraph(headingText, {
      heading: headingLevel,
      alignment: path.length === 1 ? AlignmentType.CENTER : path.length === 2 ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      keepNext: true,
      keepLines: true,
      indent: path.length >= 3 ? { firstLine: 288 } : undefined,
      spacing: { before: path.length === 1 ? 160 : 120, after: path.length === 1 ? 80 : 60 },
      textOptions: { bold: path.length === 1, italics: path.length > 1, color: black, size: path.length === 1 ? 19 : 18, font: 'Times New Roman' },
    }))
    for (const element of sectionElements(section)) bodyChildren.push(...await elementBlocks(element, numbers))
  }
  if (paper.references.length) {
    bodyChildren.push(paragraph('REFERENCES', { heading: HeadingLevel.HEADING_1, keepNext: true, keepLines: true, spacing: { before: 100, after: 50 }, textOptions: { bold: true, color: black, size: 19, font: 'Times New Roman' } }))
    paper.references.forEach((reference, index) => bodyChildren.push(paragraph(`[${index + 1}] ${reference}`, { alignment: AlignmentType.JUSTIFIED, hanging: { left: 360 }, spacing: { after: 50, line: 180 }, textOptions: { color: black, size: 16, font: 'Times New Roman' } })))
  }

  const wordDocument = new Document({
    styles: {
      default: {
        document: {
          run: { color: black, font: 'Times New Roman' },
        },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, color: black, font: 'Times New Roman' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { italics: true, color: black, font: 'Times New Roman' } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { italics: true, color: black, font: 'Times New Roman' } },
      ],
    },
    numbering: { config: [{ reference: 'paper-numbered-list', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }] },
    sections: abstractLayout === 'full-width'
      ? [
        { properties: pageProperties(false), children: [...titleChildren, ...abstractChildren] },
        { properties: pageProperties(true), children: bodyChildren },
      ]
      : [
        { properties: pageProperties(false), children: titleChildren },
        { properties: pageProperties(true), children: [...abstractChildren, ...bodyChildren] },
      ],
  })
  const blob = await Packer.toBlob(wordDocument)
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${sanitizeFilename(paper.title)}.docx`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
