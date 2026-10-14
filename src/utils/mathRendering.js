import katex from 'katex'

export function normalizeMathSource(source) {
  let expression = String(source ?? '').trim()
  const delimiterPairs = [
    ['$$', '$$'],
    ['\\[', '\\]'],
    ['\\(', '\\)'],
    ['$', '$'],
  ]
  const pair = delimiterPairs.find(([start, end]) => expression.startsWith(start) && expression.endsWith(end) && expression.length >= start.length + end.length)
  if (pair) expression = expression.slice(pair[0].length, -pair[1].length).trim()
  return expression
}

export function renderMathToString(source) {
  return katex.renderToString(normalizeMathSource(source), {
    displayMode: true,
    output: 'htmlAndMathml',
    throwOnError: true,
    trust: false,
  })
}

export function isMathParseError(error) {
  return error instanceof katex.ParseError
}
