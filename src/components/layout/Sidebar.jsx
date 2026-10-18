import { useState } from 'react'
import { ChevronDown, ChevronRight, FilePlus2, FileText, GripVertical, Plus } from 'lucide-react'
import Button from '../common/Button'
import { sectionHeading } from '../../utils/sectionLabels'

function OutlineItem({ section, path, selectedId, onSelect, collapsedIds, onToggle, dragProps }) {
  const isSelected = selectedId === section.id
  const isCollapsed = collapsedIds.has(section.id)
  const hasChildren = section.children?.length > 0
  const dropTarget = dragProps.dropTarget?.id === section.id ? dragProps.dropTarget : null
  const rowClassName = [
    'outline-row',
    path.length > 1 && 'outline-row--child',
    dragProps.draggedSectionId === section.id && 'is-dragging',
    dropTarget && `is-drop-${dropTarget.position}`,
    dropTarget && (dropTarget.valid ? 'is-drop-valid' : 'is-drop-invalid'),
  ].filter(Boolean).join(' ')

  return <div className="outline-branch">
    <div
      className={rowClassName}
      data-section-id={section.id}
      onDragOver={(event) => dragProps.onSectionDragOver(event, section.id)}
      onDrop={(event) => dragProps.onSectionDrop(event, section.id)}
    >
      <button
        type="button"
        className="outline-drag-handle"
        draggable="true"
        title={`Drag ${section.title} to reorder`}
        aria-label={`Drag ${section.title} to reorder`}
        onDragStart={(event) => {
          event.stopPropagation()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', section.id)
          dragProps.onSectionDragStart(section.id)
        }}
        onDragEnd={dragProps.onSectionDragEnd}
      ><GripVertical size={13} aria-hidden="true" /></button>
      {hasChildren
        ? <button type="button" className="outline-disclosure" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.title}`} aria-expanded={!isCollapsed} onClick={() => onToggle(section.id)}>
          {isCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
        : <span className="outline-disclosure outline-disclosure--empty" aria-hidden="true" />}
      <button type="button" className={`outline-item ${isSelected ? 'is-selected' : ''} ${path.length > 1 ? 'is-child' : ''}`} onClick={() => onSelect(section.id)}>
        <span>{sectionHeading(section, path)}</span>
      </button>
    </div>
    {!isCollapsed && section.children?.map((child, index) => <OutlineItem key={child.id} section={child} path={[...path, index]} selectedId={selectedId} onSelect={onSelect} collapsedIds={collapsedIds} onToggle={onToggle} dragProps={dragProps} />)}
  </div>
}

export default function Sidebar({ paper, selectedId, onSelect, onAddSection, draggedSectionId, dropTarget, onSectionDragStart, onSectionDragEnd, onSectionDragOver, onSectionDrop }) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const toggleSection = (id) => setCollapsedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const dragProps = { draggedSectionId, dropTarget, onSectionDragStart, onSectionDragEnd, onSectionDragOver, onSectionDrop }

  return <aside className="sidebar" aria-label="Paper outline">
    <div className="sidebar-heading"><span>Paper outline</span><FileText size={16} aria-hidden="true" /></div>
    <div className="template-indicator"><FilePlus2 size={14} aria-hidden="true" /> IEEE conference paper</div>
    <nav className="outline-nav" aria-label="Paper sections">
      <button type="button" className={`outline-item outline-item--header ${selectedId === 'paper-header' ? 'is-selected' : ''}`} onClick={() => onSelect('paper-header')}><ChevronRight size={14} aria-hidden="true" /><span>Paper details</span></button>
      {paper.sections.map((section, index) => <OutlineItem key={section.id} section={section} path={[index]} selectedId={selectedId} onSelect={onSelect} collapsedIds={collapsedIds} onToggle={toggleSection} dragProps={dragProps} />)}
      <button type="button" className={`outline-item outline-item--references ${selectedId === 'references' ? 'is-selected' : ''}`} onClick={() => onSelect('references')}><ChevronRight size={14} aria-hidden="true" /><span>References</span></button>
    </nav>
    <Button icon={Plus} className="add-section-button" onClick={onAddSection}>Add section</Button>
  </aside>
}
