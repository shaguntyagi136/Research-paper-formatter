import { useMemo, useState } from 'react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import ToolsPanel from './components/layout/ToolsPanel'
import PaperEditor from './components/editor/PaperEditor'
import PreviewModal from './components/preview/PreviewModal'
import { usePaper } from './hooks/usePaper'
import { exportPaperToPdf } from './utils/exportPaperToPdf'
import { flattenSections } from './utils/paperStructure'
import './index.css'

function App() {
  const { paper, addSection, updatePaperField, updateSectionContent, updateSectionTitle, addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement } = usePaper()
  const [selectedId, setSelectedId] = useState('paper-header')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [exportState, setExportState] = useState({ status: 'idle', error: '' })
  const statistics = useMemo(() => {
    const flatSections = flattenSections(paper.sections)
    const content = [paper.title, ...paper.authors, ...paper.affiliations, paper.abstract, ...paper.keywords, ...flatSections.flatMap(({ section }) => [section.content, ...(section.elements ?? []).map((element) => element.content ?? element.caption ?? '')]), ...paper.references].join(' ')
    const countSections = (sections) => sections.reduce((total, section) => total + 1 + countSections(section.children ?? []), 0)
    return { words: content.trim() ? content.trim().split(/\s+/).length : 0, sections: countSections(paper.sections), figures: flatSections.reduce((total, { section }) => total + (section.elements ?? []).filter((element) => element.type === 'figure').length, 0), tables: flatSections.reduce((total, { section }) => total + (section.elements ?? []).filter((element) => element.type === 'table').length, 0) }
  }, [paper])
  const handleSelect = (id) => { setSelectedId(id); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }
  const handleAddSection = () => { const id = addSection(); handleSelect(id) }
  const handleQuickElement = () => {
    const available = flattenSections(paper.sections).find(({ section }) => section.id === selectedId)?.section ?? paper.sections[0]
    if (available) { const id = addElement(available.id, 'paragraph'); handleSelect(available.id); window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }
  }
  const handleExport = async () => {
    setExportState({ status: 'loading', error: '' })
    try {
      await exportPaperToPdf(paper)
      setExportState({ status: 'complete', error: '' })
      window.setTimeout(() => setExportState({ status: 'idle', error: '' }), 2400)
    } catch (error) {
      setExportState({ status: 'error', error: error instanceof Error ? error.message : 'We could not generate your PDF. Please try again.' })
    }
  }
  return <div className="app-shell"><Header template={paper.template} saveState="Saved" onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={exportState.status === 'loading'} /><div className="workspace"><Sidebar paper={paper} selectedId={selectedId} onSelect={handleSelect} onAddSection={handleAddSection} /><main className="editor-area" aria-label="Research paper editor"><PaperEditor paper={paper} selectedId={selectedId} onSelect={setSelectedId} onUpdatePaper={updatePaperField} onUpdateSection={updateSectionContent} onUpdateSectionTitle={updateSectionTitle} actions={{ addSubsection, deleteSection, moveSection, addElement, updateElement, deleteElement, duplicateElement, moveElement }} /></main><ToolsPanel paper={paper} statistics={statistics} onAddSection={handleAddSection} onAddElement={handleQuickElement} onPreview={() => setIsPreviewOpen(true)} onExport={handleExport} isExporting={exportState.status === 'loading'} /></div>{exportState.status === 'error' && <div className="export-notice export-notice--error" role="alert">{exportState.error}<button type="button" onClick={() => setExportState({ status: 'idle', error: '' })} aria-label="Dismiss export error">×</button></div>}{exportState.status === 'complete' && <div className="export-notice" role="status">PDF downloaded successfully.</div>}{isPreviewOpen && <PreviewModal paper={paper} onClose={() => setIsPreviewOpen(false)} onExport={handleExport} isExporting={exportState.status === 'loading'} />}</div>
}
export default App
