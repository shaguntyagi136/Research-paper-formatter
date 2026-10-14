import EditableContent from './EditableContent'
const createId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`}`

export default function PaperHeader({ paper, onUpdatePaper, selected }) {
  const keywords = paper.keywords.join(', ')
  const abstractLayout = paper.abstractLayout ?? 'full-width'
  const updateAuthor = (id, update) => onUpdatePaper('authors', paper.authors.map((author) => author.id === id ? { ...author, ...update } : author))
  const updateAffiliation = (id, name) => onUpdatePaper('affiliations', paper.affiliations.map((affiliation) => affiliation.id === id ? { ...affiliation, name } : affiliation))
  const addAuthor = () => onUpdatePaper('authors', [...paper.authors, { id: createId('author'), name: '', affiliationIds: paper.affiliations[0] ? [paper.affiliations[0].id] : [] }])
  const removeAuthor = (id) => onUpdatePaper('authors', paper.authors.filter((author) => author.id !== id))
  const addAffiliation = () => onUpdatePaper('affiliations', [...paper.affiliations, { id: createId('affiliation'), name: '' }])
  const removeAffiliation = (id) => {
    onUpdatePaper('affiliations', paper.affiliations.filter((affiliation) => affiliation.id !== id))
    onUpdatePaper('authors', paper.authors.map((author) => ({ ...author, affiliationIds: author.affiliationIds.filter((affiliationId) => affiliationId !== id) })))
  }
  const toggleAuthorAffiliation = (author, affiliationId) => {
    const affiliationIds = author.affiliationIds.includes(affiliationId)
      ? author.affiliationIds.filter((id) => id !== affiliationId)
      : [...author.affiliationIds, affiliationId]
    updateAuthor(author.id, { affiliationIds })
  }

  return <section id="paper-header" className={`paper-header-card ${selected ? 'is-selected' : ''}`}>
    <div className="paper-header-topline"><span>Paper details</span><span>IEEE template</span></div>
    <label className="title-field"><span className="sr-only">Paper title</span><input value={paper.title} onChange={(event) => onUpdatePaper('title', event.target.value)} placeholder="Enter your research paper title" /></label>
    <div className="metadata-grid">
      <section className="metadata-group" aria-label="Authors">
        <div className="metadata-group-heading"><span>Authors</span><button type="button" onClick={addAuthor}>Add author</button></div>
        {paper.authors.map((author, index) => <div className="metadata-entry" key={author.id}>
          <div className="metadata-entry-heading"><span>Author {index + 1}</span><button type="button" onClick={() => removeAuthor(author.id)} aria-label={`Remove author ${index + 1}`}>Remove</button></div>
          <input value={author.name} onChange={(event) => updateAuthor(author.id, { name: event.target.value })} placeholder="Author name" aria-label={`Author ${index + 1} name`} />
          <div className="author-affiliations" role="group" aria-label={`Affiliations for author ${index + 1}`}>
            <span>Affiliations</span>
            {paper.affiliations.length
              ? paper.affiliations.map((affiliation, affiliationIndex) => <label key={affiliation.id}><input type="checkbox" checked={author.affiliationIds.includes(affiliation.id)} onChange={() => toggleAuthorAffiliation(author, affiliation.id)} /><span>{affiliation.name || `Affiliation ${affiliationIndex + 1}`}</span></label>)
              : <small>Add an affiliation to associate it with this author.</small>}
          </div>
        </div>)}
      </section>
      <section className="metadata-group" aria-label="Affiliations">
        <div className="metadata-group-heading"><span>Affiliations</span><button type="button" onClick={addAffiliation}>Add affiliation</button></div>
        {paper.affiliations.map((affiliation, index) => <div className="metadata-entry" key={affiliation.id}>
          <div className="metadata-entry-heading"><span>Affiliation {index + 1}</span><button type="button" onClick={() => removeAffiliation(affiliation.id)} aria-label={`Remove affiliation ${index + 1}`}>Remove</button></div>
          <input value={affiliation.name} onChange={(event) => updateAffiliation(affiliation.id, event.target.value)} placeholder="Department, institution" aria-label={`Affiliation ${index + 1} name`} />
        </div>)}
      </section>
    </div>
    <div className="abstract-layout-setting"><span>Abstract layout</span><div role="group" aria-label="Abstract layout"><button type="button" className={abstractLayout === 'full-width' ? 'is-active' : ''} onClick={() => onUpdatePaper('abstractLayout', 'full-width')}>Full width</button><button type="button" className={abstractLayout === 'two-columns' ? 'is-active' : ''} onClick={() => onUpdatePaper('abstractLayout', 'two-columns')}>Two columns</button></div></div>
    <EditableContent label="Abstract" value={paper.abstract} onChange={(value) => onUpdatePaper('abstract', value)} placeholder="Write a concise summary of your research, methods, findings, and contribution." className="abstract-field" />
    <label className="keywords-field"><span>Keywords</span><input value={keywords} onChange={(event) => onUpdatePaper('keywords', event.target.value.split(',').map((keyword) => keyword.trim()).filter(Boolean))} placeholder="e.g. research, methodology, analysis" /></label>
  </section>
}
