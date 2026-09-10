import { ArrowLeft, Download, Printer } from 'lucide-react'
import Button from '../common/Button'
import IEEEPaperDocument from './IEEEPaperDocument'

export default function PreviewModal({ paper, onClose, onExport, isExporting }) {
  return <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Paper preview"><div className="preview-toolbar"><div><button type="button" className="preview-back" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /> Back to editor</button><span className="preview-template">{paper.template} preview</span></div><div className="preview-actions"><Button icon={Printer} onClick={() => window.print()}>Print</Button><Button icon={Download} variant="primary" onClick={onExport} disabled={isExporting}>{isExporting ? 'Exporting…' : 'Export PDF'}</Button></div></div><main className="preview-scroll"><IEEEPaperDocument paper={paper} className="preview-paper" /></main></div>
}
