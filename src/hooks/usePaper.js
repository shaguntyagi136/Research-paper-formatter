import { useState } from 'react'
import { defaultPaper } from '../data/defaultPaper'
const cloneDefaultPaper = () => JSON.parse(JSON.stringify(defaultPaper))
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
  if (type === 'equation') return { ...base, content: 'E = mc²' }
  if (type === 'heading') return { ...base, content: 'Subheading' }
  return { ...base, content: '' }
}
export function usePaper() {
  const [paper, setPaper] = useState(cloneDefaultPaper)
  const updatePaperField = (field, value) => setPaper((current) => ({ ...current, [field]: value }))
  const updateSectionContent = (id, content) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, id, (section) => ({ ...section, content })) }))
  const updateSectionTitle = (id, title) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, id, (section) => ({ ...section, title })) }))
  const addSection = () => { const id = createId(); setPaper((current) => ({ ...current, sections: [...current.sections, { id, title: 'New Section', level: 1, order: current.sections.length + 1, content: '', elements: [], children: [] }] })); return id }
  const addSubsection = (parentId) => { const id = createId(); setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, parentId, (section) => ({ ...section, children: [...(section.children ?? []), { id, title: 'New Subsection', level: 2, order: (section.children ?? []).length + 1, content: '', elements: [], children: [] }] })) })); return id }
  const deleteSection = (id) => setPaper((current) => ({ ...current, sections: removeNestedSection(current.sections, id) }))
  const moveSection = (id, direction) => setPaper((current) => ({ ...current, sections: moveNestedSection(current.sections, id, direction) }))
  const addElement = (sectionId, type) => { const element = defaultElement(type); setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: [...(section.elements ?? []), { ...element, order: (section.elements ?? []).length + 1 }] })) })); return element.id }
  const updateElement = (sectionId, elementId, update) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: (section.elements ?? []).map((element) => element.id === elementId ? { ...element, ...update } : element) })) }))
  const deleteElement = (sectionId, elementId) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => ({ ...section, elements: (section.elements ?? []).filter((element) => element.id !== elementId) })) }))
  const duplicateElement = (sectionId, elementId) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => { const item = (section.elements ?? []).find((element) => element.id === elementId); return item ? { ...section, elements: [...section.elements, { ...JSON.parse(JSON.stringify(item)), id: createId('element'), order: section.elements.length + 1 }] } : section }) }))
  const moveElement = (sectionId, elementId, direction) => setPaper((current) => ({ ...current, sections: updateNestedSection(current.sections, sectionId, (section) => { const index = (section.elements ?? []).findIndex((element) => element.id === elementId); return index < 0 ? section : { ...section, elements: moveInList(section.elements, index, direction).map((element, order) => ({ ...element, order })) } }) }))
  return { paper, updatePaperField, updateSectionContent, updateSectionTitle, addSection, addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement }
}
