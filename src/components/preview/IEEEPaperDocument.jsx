import { sectionHeading, toRoman } from '../../utils/sectionLabels'
import { flattenSections, getElementNumbering, nonEmpty, sectionElements } from '../../utils/paperStructure'
import { getPaperMetadata } from '../../utils/paperMetadata'
import { ChartGraphic } from '../editor/ElementEditor'
import MathExpression from '../common/MathExpression'

const splitParagraph = (content, maxLength = 280) => String(content ?? '').split(/\n+/).filter(Boolean).flatMap((paragraph) => {
  const words = paragraph.trim().split(/\s+/); const chunks = []; let chunk = ''
  words.forEach((word) => { const candidate = `${chunk} ${word}`.trim(); if (candidate.length > maxLength && chunk) { chunks.push(chunk); chunk = word } else chunk = candidate })
  if (chunk) chunks.push(chunk); return chunks
})
function Paragraph({ content }) { return <p className="ieee-paragraph">{content}</p> }
function Figure({ element, number }) { return <figure className="ieee-figure">{element.imageUrl ? <img src={element.imageUrl} alt={element.alt ?? element.caption ?? 'Paper figure'} /> : <div className="ieee-figure-placeholder">Figure</div>}<figcaption>Fig. {number}. {element.caption || 'Figure caption'}</figcaption></figure> }
function Table({ element, number }) { const headers = element.headers ?? []; const rows = element.rows ?? []; return <figure className="ieee-table-wrap"><figcaption>TABLE {toRoman(number)}<span>{element.caption || 'Table caption'}</span></figcaption><table className="ieee-table"><thead>{headers.length > 0 && <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>}</thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></figure> }
function PaperElement({ element, numbers }) {
  if (element.type === 'figure') return <Figure element={element} number={numbers[element.id]?.value} />
  if (element.type === 'table') return <Table element={element} number={numbers[element.id]?.value} />
  if (element.type === 'chart') return <figure className="ieee-figure ieee-chart"><ChartGraphic element={element} /><figcaption>Fig. {numbers[element.id]?.value}. {element.caption || element.title || 'Chart'}</figcaption></figure>
  if (element.type === 'bullet-list' || element.type === 'numbered-list') { const List = element.type === 'bullet-list' ? 'ul' : 'ol'; return <List className="ieee-list">{(element.items ?? []).map((item, index) => <li key={index}>{item}</li>)}</List> }
  if (element.type === 'equation') return <MathExpression source={element.content} className="ieee-equation" />
  if (element.type === 'quote') return <blockquote className="ieee-quote">{element.content}{element.source && <footer>— {element.source}</footer>}</blockquote>
  if (element.type === 'code') return <pre className="ieee-code"><code>{element.content}</code></pre>
  if (element.type === 'heading') return <h3 className="ieee-inline-heading">{element.content}</h3>
  return <Paragraph content={element.content ?? ''} />
}
const elementHeight = (element) => {
  if (element.type === 'figure' || element.type === 'chart') return 245
  if (element.type === 'table') return 72 + (element.rows?.length ?? 0) * 31
  if (element.type === 'code') return 60 + String(element.content ?? '').split('\n').length * 15
  if (element.type === 'bullet-list' || element.type === 'numbered-list') return 22 + (element.items?.length ?? 0) * 28
  if (element.type === 'quote') return 85
  if (element.type === 'equation') return 45
  if (element.type === 'heading') return 28
  return 76
}
function documentBlocks(paper) {
  const blocks = []
  if ((paper.abstractLayout ?? 'full-width') === 'two-columns') {
    blocks.push({ id: 'abstract-heading', type: 'abstract-heading', height: 20 })
    splitParagraph(paper.abstract || 'No abstract has been added to this paper yet.', 58).forEach((content, index) => blocks.push({ id: `abstract-${index}`, type: 'abstract-content', content, height: 18 }))
    if (paper.keywords?.length) splitParagraph(paper.keywords.join(', '), 58).forEach((content, index) => blocks.push({ id: `keywords-${index}`, type: 'keywords', content, showLabel: index === 0, height: 18 }))
  }
  flattenSections(paper.sections).forEach(({ section, path }) => { blocks.push({ id: `${section.id}-heading`, type: 'section', path, section, height: path.length === 1 ? 28 : 24 }); sectionElements(section).forEach((element, index) => { if (element.type === 'paragraph') splitParagraph(element.content).forEach((content, paragraphIndex) => blocks.push({ id: `${element.id ?? section.id}-${index}-${paragraphIndex}`, type: 'element', element: { ...element, content }, height: 76 })); else blocks.push({ id: element.id ?? `${section.id}-${index}`, type: 'element', element, height: elementHeight(element) }) }) })
  if (paper.references.length) { blocks.push({ id: 'references-heading', type: 'references-heading', height: 28 }); paper.references.forEach((reference, index) => splitParagraph(reference, 245).forEach((content, part) => blocks.push({ id: `reference-${index}-${part}`, type: 'reference', index, content, height: 65 }))) }
  return blocks
}
function estimateFirstPageHeaderHeight(paper, authors, affiliations, keywords, fullWidthAbstract) {
  const lines = (value, charactersPerLine) => Math.max(1, Math.ceil(String(value ?? '').length / charactersPerLine))
  let height = lines(paper.title || 'Untitled Research Paper', 55) * 29 + 11
  if (authors.length) height += lines(authors.map((author) => author.name).join(', '), 100) * 18
  if (affiliations.length) height += lines(affiliations.map((affiliation) => affiliation.name).join(' '), 120) * 14 + 17
  if (fullWidthAbstract) {
    height += 17 + lines(paper.abstract || 'No abstract has been added to this paper yet.', 120) * 15 + 7
    if (keywords.length) height += lines(keywords.join(', '), 120) * 15 + 7
  }
  return height + 20
}
function paginate(blocks, firstCapacity) {
  const pages = []
  let page = [[], []]
  let column = 0
  let used = 0
  let capacity = firstCapacity
  const nextColumn = () => {
    if (column === 0) { column = 1; used = 0 }
    else { pages.push(page); page = [[], []]; column = 0; used = 0; capacity = 850 }
  }
  if (blocks.length && blocks[0].height > firstCapacity) {
    pages.push(page)
    page = [[], []]
    capacity = 850
  }
  blocks.forEach((block, index) => {
    const nextBlock = blocks[index + 1]
    const keepWithNext = block.type === 'section' || block.type === 'references-heading'
    const requiredHeight = block.height + (keepWithNext ? nextBlock?.height ?? 0 : 0)
    if (used + requiredHeight > capacity && page[column].length) nextColumn()
    page[column].push(block)
    used += block.height
  })
  if (page[0].length || page[1].length) pages.push(page)
  return pages
}
function RenderBlock({ block, numbers }) { if (block.type === 'section') return <h2 className={`ieee-page-section-heading ieee-page-section-heading--level-${block.path.length}`}>{sectionHeading(block.section, block.path)}</h2>; if (block.type === 'abstract-heading') return <h2 className="ieee-column-abstract-heading">Abstract</h2>; if (block.type === 'abstract-content') return <div className="ieee-column-abstract-content">{block.content}</div>; if (block.type === 'keywords') return <div className="ieee-column-keywords">{block.showLabel && <strong>Index Terms—</strong>}{block.content}</div>; if (block.type === 'references-heading') return <h2 className="ieee-page-section-heading">References</h2>; if (block.type === 'reference') return <p className="ieee-reference"><span>[{block.index + 1}]</span>{block.content}</p>; return <PaperElement element={block.element} numbers={numbers} /> }
function PageHeader({ paper, authors, affiliations, keywords, fullWidthAbstract }) { return <header className="ieee-title-block"><h1>{paper.title || 'Untitled Research Paper'}</h1>{authors.length > 0 && <p className="ieee-authors">{authors.map((author, index) => <span key={author.id}>{index > 0 && ', '}{author.name}{author.affiliationNumbers.length > 0 && <sup>{author.affiliationNumbers.join(',')}</sup>}</span>)}</p>}{affiliations.length > 0 && <p className="ieee-affiliations">{affiliations.map((affiliation) => <span key={affiliation.id}><sup>{affiliation.number}</sup> {affiliation.name}</span>)}</p>}{fullWidthAbstract && <><div className="ieee-abstract"><h2>Abstract</h2><p>{paper.abstract || 'No abstract has been added to this paper yet.'}</p></div>{keywords.length > 0 && <p className="ieee-keywords"><strong>Index Terms—</strong>{keywords.join(', ')}</p>}</>}</header> }
export default function IEEEPaperDocument({ paper, id, className = '' }) { const { authors, affiliations } = getPaperMetadata(paper); const keywords = nonEmpty(paper.keywords ?? []); const numbers = getElementNumbering(paper); const fullWidthAbstract = (paper.abstractLayout ?? 'full-width') === 'full-width'; const firstPageCapacity = Math.max(0, 930 - estimateFirstPageHeaderHeight(paper, authors, affiliations, keywords, fullWidthAbstract)); const pages = paginate(documentBlocks(paper), firstPageCapacity); return <div id={id} className={`ieee-paper-pages ${className}`} aria-label="IEEE paper preview">{pages.map((columns, pageIndex) => <article className={`ieee-paper ieee-paper--page ${pageIndex === 0 ? 'ieee-paper--first-page' : ''}`} key={pageIndex} aria-label={`Page ${pageIndex + 1}`}>{pageIndex === 0 && <PageHeader paper={paper} authors={authors} affiliations={affiliations} keywords={keywords} fullWidthAbstract={fullWidthAbstract} />}<div className="ieee-page-body">{columns.map((column, columnIndex) => <div className="ieee-page-column" key={columnIndex}>{column.map((block) => <RenderBlock block={block} numbers={numbers} key={block.id} />)}</div>)}</div><span className="ieee-page-number">{pageIndex + 1}</span></article>)}</div> }
