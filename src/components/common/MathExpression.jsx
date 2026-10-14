import { useMemo } from 'react'
import 'katex/dist/katex.min.css'
import { isMathParseError, renderMathToString } from '../../utils/mathRendering'

export default function MathExpression({ source, className = '' }) {
  const result = useMemo(() => {
    try {
      return { markup: renderMathToString(source), error: '' }
    } catch (error) {
      if (!isMathParseError(error)) throw error
      return { markup: '', error: 'Equation could not be rendered. Check the LaTeX syntax.' }
    }
  }, [source])

  if (result.error) return <div className={`math-expression-error ${className}`} role="alert">{result.error}</div>
  return <div className={`math-expression ${className}`} dangerouslySetInnerHTML={{ __html: result.markup }} />
}
