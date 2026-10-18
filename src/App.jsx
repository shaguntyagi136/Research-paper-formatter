import { useMemo, useState } from 'react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import ToolsPanel from './components/layout/ToolsPanel'
import PaperEditor from './components/editor/PaperEditor'
import PreviewModal from './components/preview/PreviewModal'
import IEEEPaperDocument from './components/preview/IEEEPaperDocument'
import HistoryToast from './components/common/HistoryToast'
import { usePaper } from './hooks/usePaper'
import { flattenSections } from './utils/paperStructure'
import './index.css'

function App() {
  const { paper, saveState, historyFeedback, undo, redo, addSection, updatePaperField, updateSectionContent, updateSectionTitle, addSubsection, deleteSection, moveSection, reorderSection, addElement, updateElement, deleteElement, duplicateElement, moveElement } = usePaper()
  const [selectedId, setSelectedId] = useState('paper-header')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [draggedSectionId, setDraggedSectionId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const statistics = useMemo(() => {
    const flatSections = flattenSections(paper.sections)
    const content = [paper.title, ...paper.authors.map((author) => author.name), ...paper.affiliations.map((affiliation) => affiliation.name), paper.abstract, ...paper.keywords, ...flatSections.flatMap(({ section }) => [section.content, ...(section.elements ?? []).map((element) => element.content ?? element.caption ?? '')]), ...paper.references].join(' ')
    const countSections = (sections) => sections.reduce((total, section) => total + 1 + countSections(section.children ?? []), 0)
    return { words: content.trim() ? content.trim().split(/\s+/).length : 0, sections: countSections(paper.sections), figures: flatSections.reduce((total, { section }) => total + (section.elements ?? []).filter((element) => element.type === 'figure').length, 0), tables: flatSections.reduce((total, { section }) => total + (section.elements ?? []).filter((element) => element.type === 'table').length, 0) }
  }, [paper])
  const handleSelect = (id) => { setSelectedId(id); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }
  const handleAddSection = () => { const id = addSection(); handleSelect(id) }
  const handleQuickElement = () => {
    const available = flattenSections(paper.sections).find(({ section }) => section.id === selectedId)?.section ?? paper.sections[0]
    if (available) { const id = addElement(available.id, 'paragraph'); handleSelect(available.id); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }
  }
  const findSection = (sections, id, parentId = null) => {
    for (const section of sections) {
      if (section.id === id) return { section, parentId }
      const found = findSection(section.children ?? [], id, section.id)
      if (found) return found
    }
    return null
  }
  const containsSection = (section, id) => (section.children ?? []).some((child) => child.id === id || containsSection(child, id))
  const handleSectionDragStart = (id) => { setDraggedSectionId(id); setDropTarget(null) }
  const handleSectionDragEnd = () => { setDraggedSectionId(null); setDropTarget(null) }
  const handleSectionDragOver = (event, targetId) => {
    if (!draggedSectionId) return
    event.preventDefault()
    event.stopPropagation()
    const source = findSection(paper.sections, draggedSectionId)
    const target = findSection(paper.sections, targetId)
    const valid = Boolean(source && target && draggedSectionId !== targetId && source.parentId === target.parentId && !containsSection(source.section, targetId))
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextTarget = { id: targetId, position: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after', valid }
    setDropTarget((current) => current?.id === nextTarget.id && current.position === nextTarget.position && current.valid === nextTarget.valid ? current : nextTarget)
    const sidebar = event.currentTarget.closest('.sidebar')
    if (sidebar) {
      const edgeSize = 36
      const scrollStep = 14
      if (event.clientY < sidebar.getBoundingClientRect().top + edgeSize) sidebar.scrollTop -= scrollStep
      else if (event.clientY > sidebar.getBoundingClientRect().bottom - edgeSize) sidebar.scrollTop += scrollStep
    }
  }
  const handleSectionDrop = (event, targetId) => {
    event.preventDefault()
    event.stopPropagation()
    if (dropTarget?.id === targetId && dropTarget.valid && draggedSectionId) {
      reorderSection(draggedSectionId, targetId, dropTarget.position)
    }
    handleSectionDragEnd()
  }
  const sectionDragProps = { draggedSectionId, dropTarget, onSectionDragStart: handleSectionDragStart, onSectionDragEnd: handleSectionDragEnd, onSectionDragOver: handleSectionDragOver, onSectionDrop: handleSectionDrop }
  const handleExport = () => window.print()
  return <>
    <div className="app-shell"><Header template={paper.template} saveState={saveState} onUndo={undo} onRedo={redo} onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={false} /><div className="workspace"><Sidebar paper={paper} selectedId={selectedId} onSelect={handleSelect} onAddSection={handleAddSection} {...sectionDragProps} /><main className="editor-area" aria-label="Research paper editor"><PaperEditor paper={paper} selectedId={selectedId} onSelect={setSelectedId} onUpdatePaper={updatePaperField} onUpdateSection={updateSectionContent} onUpdateSectionTitle={updateSectionTitle} sectionDragProps={sectionDragProps} actions={{ addSubsection, deleteSection, moveSection, reorderSection, addElement, updateElement, deleteElement, duplicateElement, moveElement }} /></main><ToolsPanel paper={paper} statistics={statistics} onAddSection={handleAddSection} onAddElement={handleQuickElement} onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={false} /></div>{isPreviewOpen && <PreviewModal paper={paper} onClose={() => setIsPreviewOpen(false)} onExport={handleExport} isExporting={false} />}</div>
    <HistoryToast feedback={historyFeedback} />
    <div id="paper-print-root" aria-hidden="true"><IEEEPaperDocument paper={paper} className="print-paper" /></div>
  </>
}
export default App
