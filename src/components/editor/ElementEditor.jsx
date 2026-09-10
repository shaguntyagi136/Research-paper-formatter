import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Copy, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const chartColors = ['#2f6d62', '#7ea999', '#d29b63', '#7c88a7', '#bc7470']

function GrowingTextarea({ value, onChange, className = '', placeholder, ariaLabel }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${Math.max(48, ref.current.scrollHeight)}px` } }, [value])
  return <textarea ref={ref} className={className} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
}

export function ChartGraphic({ element, className = '' }) {
  const data = (element.data ?? []).map((row) => ({ ...row, value: Number(row.value) || 0 }))
  if (element.chartType === 'pie') return <div className={`chart-graphic ${className}`}><ResponsiveContainer width="100%" height={220}><PieChart><Tooltip /><Legend /><Pie data={data} dataKey="value" nameKey="category" outerRadius={72}>{data.map((_, index) => <Cell fill={chartColors[index % chartColors.length]} key={index} />)}</Pie></PieChart></ResponsiveContainer></div>
  const Chart = element.chartType === 'line' ? LineChart : BarChart
  return <div className={`chart-graphic ${className}`}><ResponsiveContainer width="100%" height={220}><Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}><CartesianGrid stroke="#dce5e0" strokeDasharray="3 3" /><XAxis dataKey="category" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />{element.chartType === 'line' ? <Line dataKey="value" stroke="#2f6d62" strokeWidth={2} activeDot={{ r: 4 }} /> : <Bar dataKey="value" fill="#3f7c70" radius={[3, 3, 0, 0]} />}</Chart></ResponsiveContainer></div>
}

function ElementToolbar({ type, onDuplicate, onDelete, onMove }) {
  return <div className="element-toolbar"><span>{type.replace('-', ' ')}</span><button type="button" onClick={() => onMove(-1)} aria-label="Move element up"><ChevronUp size={14} /></button><button type="button" onClick={() => onMove(1)} aria-label="Move element down"><ChevronDown size={14} /></button><button type="button" onClick={onDuplicate} aria-label="Duplicate element"><Copy size={13} /></button><button type="button" onClick={onDelete} aria-label="Delete element"><Trash2 size={13} /></button></div>
}

function ListEditor({ element, onChange, ordered }) {
  const items = element.items ?? []
  const Tag = ordered ? 'ol' : 'ul'
  return <><Tag className="element-list-editor">{items.map((item, index) => <li key={index}><GrowingTextarea value={item} onChange={(value) => onChange({ items: items.map((entry, itemIndex) => itemIndex === index ? value : entry) })} ariaLabel={`List item ${index + 1}`} /><button type="button" onClick={() => onChange({ items: items.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remove list item"><X size={13} /></button></li>)}</Tag><button type="button" className="element-text-action" onClick={() => onChange({ items: [...items, 'List item'] })}><Plus size={13} /> Add item</button></>
}

function TableEditor({ element, onChange }) {
  const headers = element.headers ?? []
  const rows = element.rows ?? []
  const updateCell = (row, column, value) => onChange({ rows: rows.map((entry, rowIndex) => rowIndex === row ? entry.map((cell, columnIndex) => columnIndex === column ? value : cell) : entry) })
  const removeColumn = () => { if (headers.length > 1) onChange({ headers: headers.slice(0, -1), rows: rows.map((row) => row.slice(0, -1)) }) }
  return <div className="table-editor"><input className="block-caption-input" value={element.caption ?? ''} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Table caption" aria-label="Table caption" /><div className="table-editor-scroll"><table><thead><tr>{headers.map((header, index) => <th key={index}><input value={header} onChange={(event) => onChange({ headers: headers.map((entry, cellIndex) => cellIndex === index ? event.target.value : entry) })} aria-label={`Column ${index + 1} heading`} /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, columnIndex) => <td key={columnIndex}><input value={row[columnIndex] ?? ''} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} /></td>)}<td className="table-remove-cell"><button type="button" onClick={() => onChange({ rows: rows.filter((_, index) => index !== rowIndex) })} aria-label="Remove row"><X size={13} /></button></td></tr>)}</tbody></table></div><div className="element-actions-row"><button type="button" className="element-text-action" onClick={() => onChange({ rows: [...rows, Array(headers.length).fill('')] })}><Plus size={13} /> Row</button><button type="button" className="element-text-action" onClick={() => onChange({ headers: [...headers, `Column ${headers.length + 1}`], rows: rows.map((row) => [...row, '']) })}><Plus size={13} /> Column</button><button type="button" className="element-text-action" onClick={removeColumn} disabled={headers.length <= 1}><X size={13} /> Column</button></div></div>
}

function ChartEditor({ element, onChange }) {
  const data = element.data ?? []
  return <div className="chart-editor"><div className="chart-config"><label>Chart type<select value={element.chartType ?? 'bar'} onChange={(event) => onChange({ chartType: event.target.value })}><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option></select></label><label>Title<input value={element.title ?? ''} onChange={(event) => onChange({ title: event.target.value })} placeholder="Chart title" /></label><label>Caption<input value={element.caption ?? ''} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Figure caption" /></label></div><div className="chart-data-grid"><strong>Category</strong><strong>Value</strong>{data.map((row, index) => <div className="chart-data-row" key={index}><input value={row.category ?? ''} onChange={(event) => onChange({ data: data.map((entry, entryIndex) => entryIndex === index ? { ...entry, category: event.target.value } : entry) })} aria-label={`Chart category ${index + 1}`} /><div className="chart-value-row"><input type="number" value={row.value ?? 0} onChange={(event) => onChange({ data: data.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value } : entry) })} aria-label={`Chart value ${index + 1}`} /><button type="button" onClick={() => onChange({ data: data.filter((_, entryIndex) => entryIndex !== index) })} aria-label="Remove data row"><X size={13} /></button></div></div>)}</div><button type="button" className="element-text-action" onClick={() => onChange({ data: [...data, { category: 'New category', value: 0 }] })}><Plus size={13} /> Data row</button><ChartGraphic element={element} /></div>
}

export default function ElementEditor({ element, number, onChange, onDelete, onDuplicate, onMove }) {
  const uploadImage = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange({ imageUrl: String(reader.result) }); reader.readAsDataURL(file) }
  let content
  if (element.type === 'bullet-list') content = <ListEditor element={element} onChange={onChange} />
  else if (element.type === 'numbered-list') content = <ListEditor element={element} onChange={onChange} ordered />
  else if (element.type === 'figure') content = <div className="figure-editor">{element.imageUrl ? <img src={element.imageUrl} alt={element.caption || 'Figure preview'} /> : <label className="image-upload"><ImagePlus size={19} /> Upload image<input type="file" accept="image/*" onChange={uploadImage} /></label>}<input className="block-caption-input" value={element.caption ?? ''} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Figure caption" aria-label="Figure caption" /><small>Fig. {number ?? '—'}. numbering is automatic</small></div>
  else if (element.type === 'table') content = <TableEditor element={element} onChange={onChange} />
  else if (element.type === 'chart') content = <ChartEditor element={element} onChange={onChange} />
  else if (element.type === 'quote') content = <div className="quote-editor"><GrowingTextarea value={element.content} onChange={(content) => onChange({ content })} placeholder="Quotation text" ariaLabel="Quotation text" /><input value={element.source ?? ''} onChange={(event) => onChange({ source: event.target.value })} placeholder="Optional source or attribution" aria-label="Quote source" /></div>
  else if (element.type === 'code') content = <GrowingTextarea className="code-editor" value={element.content} onChange={(content) => onChange({ content })} placeholder="Write code here…" ariaLabel="Code block" />
  else if (element.type === 'equation') content = <input className="equation-editor" value={element.content} onChange={(event) => onChange({ content: event.target.value })} placeholder="E = mc²" aria-label="Equation" />
  else if (element.type === 'heading') content = <input className="heading-block-input" value={element.content} onChange={(event) => onChange({ content: event.target.value })} aria-label="Heading" />
  else content = <GrowingTextarea value={element.content} onChange={(content) => onChange({ content })} placeholder="Write a paragraph…" ariaLabel="Paragraph" />
  return <div className={`paper-element paper-element--${element.type}`}><ElementToolbar type={element.type} onDelete={onDelete} onDuplicate={onDuplicate} onMove={onMove} />{content}</div>
}
