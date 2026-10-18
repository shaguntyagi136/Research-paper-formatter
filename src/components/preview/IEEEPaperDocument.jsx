import { useLayoutEffect, useRef, useState } from 'react'
import { sectionHeading, toRoman } from '../../utils/sectionLabels'
import { flattenSections, getElementNumbering, nonEmpty, sectionElements } from '../../utils/paperStructure'
import { getPaperMetadata } from '../../utils/paperMetadata'
import { ChartGraphic } from '../editor/ElementEditor'
import MathExpression from '../common/MathExpression'

const LETTER_BODY_HEIGHT = 888

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
  if (element.type === 'chart') return 210
  if (element.type === 'figure') return 245
  if (element.type === 'table') return 72 + (element.rows?.length ?? 0) * 31
  if (element.type === 'code') return 60 + String(element.content ?? '').split('\n').length * 15
  if (element.type === 'bullet-list' || element.type === 'numbered-list') return 22 + (element.items?.length ?? 0) * 28
  if (element.type === 'quote') return 85
  if (element.type === 'equation') return 45
  if (element.type === 'heading') return 28
  return 76
}
function documentBlocks(paper) {
  const abstractBlocks = []
  const bodyBlocks = []
  if ((paper.abstractLayout ?? 'two-columns') === 'two-columns') {
    abstractBlocks.push({ id: 'abstract', type: 'abstract-content', content: paper.abstract || 'No abstract has been added to this paper yet.', showHeading: true })
    if (paper.keywords?.length) {
      abstractBlocks.push({ id: 'keywords', type: 'keywords', content: paper.keywords.join(', '), showLabel: true })
    }
  }
  flattenSections(paper.sections).forEach(({ section, path }) => { bodyBlocks.push({ id: `${section.id}-heading`, type: 'section', path, section }); sectionElements(section).forEach((element, index) => bodyBlocks.push({ id: element.id ?? `${section.id}-${index}`, type: 'element', element })) })
  if (paper.references.length) { bodyBlocks.push({ id: 'references-heading', type: 'references-heading' }); paper.references.forEach((reference, index) => bodyBlocks.push({ id: `reference-${index}`, type: 'reference', index, content: reference })) }
  return { abstractBlocks, bodyBlocks }
}
function fallbackHeight(block) {
  if (block.type === 'section' || block.type === 'references-heading') return block.path?.length === 1 ? 30 : 26
  if (block.type === 'abstract-content' || block.type === 'keywords') return Math.max(20, Math.ceil(block.content.length / 42) * 14 + 4)
  if (block.type === 'reference') return Math.max(18, Math.ceil(block.content.length / 60) * 12 + 5)
  return elementHeight(block.element)
}
function paginate(abstractBlocks, bodyBlocks, firstCapacity, heights = {}) {
  const pages = []
  let page = [[], []]
  let column = 0
  let used = 0
  let capacity = firstCapacity
  const nextColumn = () => {
    if (column === 0) { column = 1; used = 0 }
    else { pages.push(page); page = [[], []]; column = 0; used = 0; capacity = LETTER_BODY_HEIGHT }
  }
  const place = (block, nextBlock) => {
    const height = heights[block.id] ?? fallbackHeight(block)
    const keepWithNext = block.type === 'section' || block.type === 'references-heading'
    const requiredHeight = height + (keepWithNext && nextBlock ? heights[nextBlock.id] ?? fallbackHeight(nextBlock) : 0)
    if (used + requiredHeight > capacity && page[column].length) nextColumn()
    page[column].push(block)
    used += height
  }
  abstractBlocks.forEach((block, index) => place(block, abstractBlocks[index + 1]))
  // If the two-column abstract reached the right column, reserve that page for
  // its preamble. Starting body content on the next page preserves reading order.
  if (abstractBlocks.length && column === 1 && page[1].length) nextColumn()
  bodyBlocks.forEach((block, index) => place(block, bodyBlocks[index + 1]))
  if (page[0].length || page[1].length) pages.push(page)
  return pages
}
function RenderBlock({ block, numbers, measure = false }) { const content = block.type === 'section' ? <h2 className={`ieee-page-section-heading ieee-page-section-heading--level-${block.path.length}`}>{sectionHeading(block.section, block.path)}</h2> : block.type === 'abstract-content' ? <p className="ieee-column-abstract-content">{block.showHeading && <strong>Abstract—</strong>}{block.content}</p> : block.type === 'keywords' ? <p className="ieee-column-keywords">{block.showLabel && <strong>Index Terms—</strong>}{block.content}</p> : block.type === 'references-heading' ? <h2 className="ieee-page-section-heading">References</h2> : block.type === 'reference' ? <p className="ieee-reference"><span>[{block.index + 1}]</span>{block.content}</p> : <PaperElement element={block.element} numbers={numbers} />; return <div className="ieee-page-block" data-block-id={measure ? block.id : undefined}>{content}</div> }
function PageHeader({ paper, authors, affiliations, keywords, measure = false }) {
  const fullWidthAbstract = (paper.abstractLayout ?? 'two-columns') === 'full-width'
  return <header className="ieee-title-block" data-measure-header={measure || undefined}>
    <h1>{paper.title || 'Untitled Research Paper'}</h1>
    {authors.length > 0 && <div className="ieee-author-grid" aria-label="Authors">{authors.map((author) => {
      const authorAffiliations = author.affiliationNumbers.map((number) => affiliations.find((affiliation) => affiliation.number === number)).filter(Boolean)
      return <section className="ieee-author-block" key={author.id}>
        <div className="ieee-author-name">{author.name}</div>
        {authorAffiliations.map((affiliation) => <div className="ieee-author-affiliation" key={affiliation.id}>{affiliation.name}</div>)}
        {author.email.trim() && <div className="ieee-author-email">{author.email}</div>}
      </section>
    })}</div>}
    {fullWidthAbstract && <div className="ieee-abstract-block">
      <div className="ieee-abstract"><h2>Abstract</h2><p>{paper.abstract || 'No abstract has been added to this paper yet.'}</p></div>
      {keywords.length > 0 && <p className="ieee-keywords"><strong>Index Terms—</strong>{keywords.join(', ')}</p>}
    </div>}
  </header>
}
export default function IEEEPaperDocument({ paper, id, className = '' }) {
  const { authors, affiliations } = getPaperMetadata(paper)
  const keywords = nonEmpty(paper.keywords ?? [])
  const numbers = getElementNumbering(paper)
  const { abstractBlocks, bodyBlocks } = documentBlocks(paper)
  const measureRef = useRef(null)
  const [measurements, setMeasurements] = useState({ headerHeight: 0, blockHeights: {} })

  useLayoutEffect(() => {
    const measure = () => {
      const root = measureRef.current
      if (!root) return
      const header = root.querySelector('[data-measure-header]')
      const blockHeights = Object.fromEntries([...root.querySelectorAll('[data-block-id]')].map((node) => [node.dataset.blockId, Math.ceil(node.getBoundingClientRect().height)]))
      const headerStyle = header ? window.getComputedStyle(header) : null
      const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height + Number.parseFloat(headerStyle.marginBottom || 0)) : 0
      setMeasurements((current) => JSON.stringify(current.blockHeights) === JSON.stringify(blockHeights) && current.headerHeight === headerHeight ? current : { headerHeight, blockHeights })
    }
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [paper, abstractBlocks.length, bodyBlocks.length])

  const firstPageCapacity = Math.max(0, LETTER_BODY_HEIGHT - measurements.headerHeight)
  const pages = paginate(abstractBlocks, bodyBlocks, firstPageCapacity || LETTER_BODY_HEIGHT, measurements.blockHeights)
  const allBlocks = [...abstractBlocks, ...bodyBlocks]
  return <><div id={id} className={`ieee-paper-pages ${className}`} aria-label="IEEE paper preview">{pages.map((columns, pageIndex) => <article className={`ieee-paper ieee-paper--page ${pageIndex === 0 ? 'ieee-paper--first-page' : ''}`} key={pageIndex} aria-label={`Page ${pageIndex + 1}`}>{pageIndex === 0 && <PageHeader paper={paper} authors={authors} affiliations={affiliations} keywords={keywords} />}<div className="ieee-page-body">{columns.map((column, columnIndex) => <div className="ieee-page-column" key={columnIndex}>{column.map((block) => <RenderBlock block={block} numbers={numbers} key={block.id} />)}</div>)}</div></article>)}</div><div className="ieee-pagination-measure" ref={measureRef} aria-hidden="true"><PageHeader paper={paper} authors={authors} affiliations={affiliations} keywords={keywords} measure /><div className="ieee-page-column">{allBlocks.map((block) => <RenderBlock block={block} numbers={numbers} measure key={block.id} />)}</div></div></>
}
