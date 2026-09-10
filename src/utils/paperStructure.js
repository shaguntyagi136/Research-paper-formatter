export const flattenSections = (sections, parentPath = []) => sections.flatMap((section, index) => {
  const path = [...parentPath, index]
  return [{ section, path }, ...flattenSections(section.children ?? [], path)]
})

export const sectionElements = (section) => [
  ...(section.content ? [{ id: `${section.id}-content`, type: 'paragraph', content: section.content }] : []),
  ...(section.elements ?? []),
]

export const nonEmpty = (values) => values.filter((value) => value?.trim())

// Display labels are deliberately derived at render time. Persisted elements only
// carry their content and identity, so inserting or moving a block never leaves
// stale figure/table numbers behind.
export const getElementNumbering = (paper) => {
  let visual = 0
  let table = 0
  return flattenSections(paper.sections).reduce((numbers, { section }) => {
    sectionElements(section).forEach((element) => {
      if (element.type === 'figure' || element.type === 'chart') numbers[element.id] = { kind: 'figure', value: ++visual }
      if (element.type === 'table') numbers[element.id] = { kind: 'table', value: ++table }
    })
    return numbers
  }, {})
}
