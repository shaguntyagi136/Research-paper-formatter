import { useMemo, useState } from 'react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import ToolsPanel from './components/layout/ToolsPanel'
import PaperEditor from './components/editor/PaperEditor'
import PreviewModal from './components/preview/PreviewModal'
import IEEEPaperDocument from './components/preview/IEEEPaperDocument'
import { usePaper } from './hooks/usePaper'
import { flattenSections } from './utils/paperStructure'
import './index.css'

function App() {
  const { paper, saveState, addSection, updatePaperField, updateSectionContent, updateSectionTitle, addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement } = usePaper()
  const [selectedId, setSelectedId] = useState('paper-header')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
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
  const handleExport = () => window.print()
  return <>
    <div className="app-shell"><Header template={paper.template} saveState={saveState} onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={false} /><div className="workspace"><Sidebar paper={paper} selectedId={selectedId} onSelect={handleSelect} onAddSection={handleAddSection} /><main className="editor-area" aria-label="Research paper editor"><PaperEditor paper={paper} selectedId={selectedId} onSelect={setSelectedId} onUpdatePaper={updatePaperField} onUpdateSection={updateSectionContent} onUpdateSectionTitle={updateSectionTitle} actions={{ addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement }} /></main><ToolsPanel paper={paper} statistics={statistics} onAddSection={handleAddSection} onAddElement={handleQuickElement} onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={false} /></div>{isPreviewOpen && <PreviewModal paper={paper} onClose={() => setIsPreviewOpen(false)} onExport={handleExport} isExporting={false} />}</div>
    <div id="paper-print-root" aria-hidden="true"><IEEEPaperDocument paper={paper} className="print-paper" /></div>
  </>
}
export default App
