export const toRoman = (number) => { const numerals = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [5, 'V'], [4, 'IV'], [1, 'I']]; let remaining = number; return numerals.reduce((result, [value, symbol]) => { while (remaining >= value) { result += symbol; remaining -= value } return result }, '') }
export const sectionLabel = (path) => path.length === 1 ? `${toRoman(path[0] + 1)}.` : `${String.fromCharCode(65 + path[path.length - 1])}.`
export const sectionHeading = (section, path) => `${sectionLabel(path)} ${section.title}`
