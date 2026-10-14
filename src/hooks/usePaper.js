import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { defaultPaper } from '../data/defaultPaper'
const cloneDefaultPaper = () => JSON.parse(JSON.stringify(defaultPaper))
const PAPER_STORAGE_KEY = 'research-paper-app:draft:v1'
const SAVE_DEBOUNCE_MS = 500

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeAffiliation = (affiliation, index) => {
  if (typeof affiliation === 'string') return { id: `affiliation-${index + 1}`, name: affiliation }
  if (!isRecord(affiliation)) return null
  return {
    ...affiliation,
    id: typeof affiliation.id === 'string' ? affiliation.id : `affiliation-${index + 1}`,
    name: typeof affiliation.name === 'string' ? affiliation.name : '',
  }
}

const normalizeAuthor = (author, index, affiliations) => {
  if (typeof author === 'string') {
    return {
      id: `author-${index + 1}`,
      name: author,
      affiliationIds: affiliations.length ? [affiliations[0].id] : [],
    }
  }
  if (!isRecord(author)) return null
  const affiliationIds = Array.isArray(author.affiliationIds)
    ? author.affiliationIds.filter((id) => affiliations.some((affiliation) => affiliation.id === id))
    : affiliations.length ? [affiliations[0].id] : []
  return {
    ...author,
    id: typeof author.id === 'string' ? author.id : `author-${index + 1}`,
    name: typeof author.name === 'string' ? author.name : '',
    affiliationIds,
  }
}

const normalizeElement = (element, index) => {
  if (!isRecord(element)) return null
  return {
    ...element,
    id: typeof element.id === 'string' ? element.id : createId('element'),
    type: typeof element.type === 'string' ? element.type : 'paragraph',
    order: Number.isFinite(element.order) ? element.order : index + 1,
  }
}

const normalizeSection = (section, index) => {
  if (!isRecord(section)) return null
  return {
    ...section,
    id: typeof section.id === 'string' ? section.id : createId(),
    title: typeof section.title === 'string' ? section.title : 'Untitled Section',
    level: Number.isFinite(section.level) ? section.level : 1,
    order: Number.isFinite(section.order) ? section.order : index + 1,
    content: typeof section.content === 'string' ? section.content : '',
    elements: Array.isArray(section.elements)
      ? section.elements.map(normalizeElement).filter(Boolean)
      : [],
    children: Array.isArray(section.children)
      ? section.children.map(normalizeSection).filter(Boolean)
      : [],
  }
}

const normalizePaper = (savedPaper) => {
  const paper = { ...cloneDefaultPaper(), ...savedPaper }
  const affiliations = Array.isArray(paper.affiliations)
    ? paper.affiliations.map(normalizeAffiliation).filter(Boolean)
    : cloneDefaultPaper().affiliations
  return {
    ...paper,
    template: typeof paper.template === 'string' ? paper.template : defaultPaper.template,
    abstractLayout: typeof paper.abstractLayout === 'string' ? paper.abstractLayout : defaultPaper.abstractLayout,
    title: typeof paper.title === 'string' ? paper.title : '',
    authors: Array.isArray(paper.authors)
      ? paper.authors.map((author, index) => normalizeAuthor(author, index, affiliations)).filter(Boolean)
      : cloneDefaultPaper().authors,
    affiliations,
    abstract: typeof paper.abstract === 'string' ? paper.abstract : '',
    keywords: Array.isArray(paper.keywords) ? paper.keywords.filter((value) => typeof value === 'string') : [],
    references: Array.isArray(paper.references) ? paper.references.filter((value) => typeof value === 'string') : [],
    sections: Array.isArray(paper.sections)
      ? paper.sections.map(normalizeSection).filter(Boolean)
      : cloneDefaultPaper().sections,
  }
}

const loadPaper = () => {
  try {
    const savedPaper = window.localStorage.getItem(PAPER_STORAGE_KEY)
    if (savedPaper === null) return cloneDefaultPaper()
    const parsedPaper = JSON.parse(savedPaper)
    return isRecord(parsedPaper) ? normalizePaper(parsedPaper) : cloneDefaultPaper()
  } catch {
    return cloneDefaultPaper()
  }
}

const createId = (prefix = 'section') => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`}`
const updateNestedSection = (sections, id, update) => sections.map((section) => section.id === id ? update(section) : { ...section, children: updateNestedSection(section.children ?? [], id, update) })
const removeNestedSection = (sections, id) => sections.filter((section) => section.id !== id).map((section) => ({ ...section, children: removeNestedSection(section.children ?? [], id) }))
const moveInList = (items, index, direction) => {
  const next = [...items]; const target = index + direction
  if (target < 0 || target >= next.length) return items
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
const moveNestedSection = (sections, id, direction) => {
  const index = sections.findIndex((section) => section.id === id)
  if (index !== -1) return moveInList(sections, index, direction)
  return sections.map((section) => ({ ...section, children: moveNestedSection(section.children ?? [], id, direction) }))
}
const defaultElement = (type) => {
  const id = createId('element')
  const base = { id, type, order: 0 }
  if (type === 'bullet-list' || type === 'numbered-list') return { ...base, items: ['List item'] }
  if (type === 'figure') return { ...base, imageUrl: '', caption: '' }
  if (type === 'table') return { ...base, headers: ['Column 1', 'Column 2'], rows: [['', '']], caption: '' }
  if (type === 'chart') return { ...base, chartType: 'bar', title: '', caption: '', data: [{ category: 'Category A', value: 10 }, { category: 'Category B', value: 7 }] }
  if (type === 'quote') return { ...base, content: '', source: '' }
  if (type === 'code') return { ...base, content: '' }
  if (type === 'equation') return { ...base, content: 'E = mc^2' }
  if (type === 'heading') return { ...base, content: 'Subheading' }
  return { ...base, content: '' }
}
export function usePaper() {
  const [paper, setPaperState] = useState(loadPaper)
  const [saveState, setSaveState] = useState('saving')
  const paperRef = useRef(paper)
  const setPaper = (update) => {
    setSaveState('saving')
    setPaperState(update)
  }
  const savePaper = useCallback((paperToSave) => {
    try {
      window.localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(paperToSave))
      setSaveState('saved')
    } catch {
      setSaveState('failed')
    }
  }, [])

  useLayoutEffect(() => {
    paperRef.current = paper
  }, [paper])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => savePaper(paper), SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [paper, savePaper])

  useEffect(() => {
    const flushLatestPaper = () => savePaper(paperRef.current)
    window.addEventListener('pagehide', flushLatestPaper)
    return () => window.removeEventListener('pagehide', flushLatestPaper)
  }, [savePaper])

  const updatePaperField = (field, value) => setPaper((current) => ({ ...current, [field]: value }))
  const updateSectionContent = (id, content) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, id, (section) => ({ ...section, content })) }))
  const updateSectionTitle = (id, title) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, id, (section) => ({ ...section, title })) }))
  const addSection = () => { const id = createId(); setPaper((current) => ({ ...current, sections: [...current.sections, { id, title: 'New Section', level: 1, order: current.sections.length + 1, content: '', elements: [], children: [] }] })); return id }
  const addSubsection = (parentId) => { const id = createId(); setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, parentId, (section) => ({ ...section, children: [...(section.children ?? []), { id, title: 'New Subsection', level: (section.level ?? 1) + 1, order: (section.children ?? []).length + 1, content: '', elements: [], children: [] }] })) })); return id }
  const deleteSection = (id) => setPaper((current) => ({ ...current, sections: removeNestedSection(current.sections, id) }))
  const moveSection = (id, direction) => setPaper((current) => ({ ...current, sections: moveNestedSection(current.sections, id, direction) }))
  const addElement = (sectionId, type) => { const element = defaultElement(type); setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: [...(section.elements ?? []), { ...element, order: (section.elements ?? []).length + 1 }] })) })); return element.id }
  const updateElement = (sectionId, elementId, update) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: (section.elements ?? []).map((element) => element.id === elementId ? { ...element, ...update } : element) })) }))
  const deleteElement = (sectionId, elementId) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: (section.elements ?? []).filter((element) => element.id !== elementId) })) }))
  const duplicateElement = (sectionId, elementId) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => { const item = (section.elements ?? []).find((element) => element.id === elementId); return item ? { ...section, elements: [...section.elements, { ...JSON.parse(JSON.stringify(item)), id: createId('element'), order: section.elements.length + 1 }] } : section }) }))
  const moveElement = (sectionId, elementId, direction) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => { const index = (section.elements ?? []).findIndex((element) => element.id === elementId); return index < 0 ? section : { ...section, elements: moveInList(section.elements, index, direction).map((element, order) => ({ ...element, order })) } }) }))
  return { paper, saveState, updatePaperField, updateSectionContent, updateSectionTitle, addSection, addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement }
}
