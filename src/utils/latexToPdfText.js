const greekNames = {
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon',
  varepsilon: 'epsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', vartheta: 'theta',
  iota: 'iota', kappa: 'kappa', lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi',
  pi: 'pi', varpi: 'pi', rho: 'rho', varrho: 'rho', sigma: 'sigma', varsigma: 'sigma',
  tau: 'tau', upsilon: 'upsilon', phi: 'phi', varphi: 'phi', chi: 'chi', psi: 'psi',
  omega: 'omega', Gamma: 'Gamma', Delta: 'Delta', Theta: 'Theta', Lambda: 'Lambda',
  Xi: 'Xi', Pi: 'Pi', Sigma: 'Sigma', Upsilon: 'Upsilon', Phi: 'Phi', Psi: 'Psi', Omega: 'Omega',
}

const symbols = {
  pm: '+/-', mp: '-/+', times: 'x', cdot: '*', div: '/', leq: '<=', le: '<=',
  geq: '>=', ge: '>=', neq: '!=', approx: '~=', infty: 'infinity', partial: 'd',
  nabla: 'nabla', forall: 'for all', exists: 'exists', in: 'in', to: '->',
  rightarrow: '->', leftarrow: '<-', Rightarrow: '=>', Leftarrow: '<=',
  ell: 'l', degree: 'deg',
}

const extractGroup = (text, start) => {
  if (text[start] !== '{') return null
  let depth = 0
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    if (text[index] === '}') depth -= 1
    if (depth === 0) return { value: text.slice(start + 1, index), end: index + 1 }
  }
  return null
}

const replaceCommandsWithGroups = (source, command, format) => {
  let text = source
  let index = 0
  while ((index = text.indexOf(command, index)) !== -1) {
    const first = extractGroup(text, index + command.length)
    if (!first) {
      index += command.length
      continue
    }
    let replacement
    let end = first.end
    if (format === 'sqrt') {
      replacement = `sqrt(${latexToPdfText(first.value)})`
    } else {
      const second = extractGroup(text, first.end)
      if (!second) {
        index = first.end
        continue
      }
      replacement = `( ${latexToPdfText(first.value)} ) / ( ${latexToPdfText(second.value)} )`
      end = second.end
    }
    text = `${text.slice(0, index)}${replacement}${text.slice(end)}`
    index += replacement.length
  }
  return text
}

export function latexToPdfText(source) {
  let text = normalizeMathSource(source)
  for (let pass = 0; pass < 20; pass += 1) {
    const next = replaceCommandsWithGroups(replaceCommandsWithGroups(text, '\\frac', 'frac'), '\\sqrt', 'sqrt')
    if (next === text) break
    text = next
  }
  text = text
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\\(?:,|;|:|!|quad|qquad)/g, ' ')
    .replace(/\^\{([^{}]*)\}/g, '^($1)')
    .replace(/_\{([^{}]*)\}/g, '_($1)')
    .replace(/\\([A-Za-z]+)|\\([{}%&#_$])/g, (match, command, escaped) => {
      if (command === 'sum') return 'SUM'
      if (command === 'prod') return 'PRODUCT'
      if (command === 'int') return 'INTEGRAL'
      if (command === 'lim') return 'lim'
      if (command === 'text' || command === 'mathrm' || command === 'mathbf' || command === 'mathit') return ''
      return greekNames[command] ?? symbols[command] ?? escaped ?? command
    })
    .replace(/[{}]/g, '')
    .replace(/\\ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || '(empty equation)'
}
import { normalizeMathSource } from './mathRendering'
