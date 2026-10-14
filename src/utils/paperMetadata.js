export const getPaperMetadata = (paper) => {
  const affiliations = (paper.affiliations ?? [])
    .map((affiliation, index) => ({
      id: typeof affiliation === 'string' ? `affiliation-${index + 1}` : affiliation.id,
      name: typeof affiliation === 'string' ? affiliation : affiliation.name,
    }))
    .filter((affiliation) => affiliation.name?.trim())
    .map((affiliation, index) => ({ ...affiliation, number: index + 1 }))

  const authors = (paper.authors ?? [])
    .map((author, index) => {
      const name = typeof author === 'string' ? author : author.name
      const ids = typeof author === 'string' || !Array.isArray(author.affiliationIds)
        ? affiliations.slice(0, 1).map((affiliation) => affiliation.id)
        : author.affiliationIds
      const affiliationNumbers = ids
        .map((id) => affiliations.find((affiliation) => affiliation.id === id)?.number)
        .filter((number) => number !== undefined)
      return { id: typeof author === 'string' ? `author-${index + 1}` : author.id, name, affiliationNumbers }
    })
    .filter((author) => author.name?.trim())

  return { authors, affiliations }
}
