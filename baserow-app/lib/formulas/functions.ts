import type { FormulaValue, FormulaError } from './types'

export type FormulaFunction = (...args: FormulaValue[]) => FormulaValue | FormulaError

export const FORMULA_FUNCTIONS: Record<string, FormulaFunction> = {
  // String functions
  CONCAT: (...args) => {
    return args.map(a => a === null || a === undefined ? '' : String(a)).join('')
  },

  UPPER: (str) => {
    if (str === null || str === undefined) return '#VALUE!'
    return String(str).toUpperCase()
  },

  LOWER: (str) => {
    if (str === null || str === undefined) return '#VALUE!'
    return String(str).toLowerCase()
  },

  LEFT: (str, num) => {
    if (str === null || str === undefined) return '#VALUE!'
    const n = typeof num === 'number' ? Math.floor(num) : 1
    return String(str).substring(0, Math.max(0, n))
  },

  RIGHT: (str, num) => {
    if (str === null || str === undefined) return '#VALUE!'
    const s = String(str)
    const n = typeof num === 'number' ? Math.floor(num) : 1
    return s.substring(Math.max(0, s.length - n))
  },

  LEN: (str) => {
    if (str === null || str === undefined) return 0
    return String(str).length
  },

  FIND: (search, text, startPos?) => {
    if (search === null || text === null) return '#VALUE!'
    const s = String(text)
    const searchStr = String(search)
    const start = typeof startPos === 'number' ? Math.max(0, Math.floor(startPos) - 1) : 0
    const index = s.indexOf(searchStr, start)
    return index === -1 ? 0 : index + 1 // 1-indexed
  },

  SUBSTITUTE: (text, oldText, newText, instanceNum?) => {
    if (text === null || oldText === null || newText === null) return '#VALUE!'
    let s = String(text)
    const old = String(oldText)
    const newStr = String(newText)

    if (instanceNum !== undefined && typeof instanceNum === 'number') {
      // Replace specific instance
      const parts = s.split(old)
      if (parts.length <= instanceNum) return s
      const before = parts.slice(0, instanceNum).join(old)
      const after = parts.slice(instanceNum).join(old)
      return before + newStr + after
    }

    // Replace all
    return s.split(old).join(newStr)
  },

  // Math functions
  ROUND: (num, decimals?) => {
    if (num === null || num === undefined) return '#VALUE!'
    const n = typeof num === 'number' ? num : parseFloat(String(num))
    if (isNaN(n)) return '#VALUE!'
    const d = decimals !== undefined && typeof decimals === 'number' ? decimals : 0
    return Math.round(n * Math.pow(10, d)) / Math.pow(10, d)
  },

  FLOOR: (num) => {
    if (num === null || num === undefined) return '#VALUE!'
    const n = typeof num === 'number' ? num : parseFloat(String(num))
    if (isNaN(n)) return '#VALUE!'
    return Math.floor(n)
  },

  CEILING: (num) => {
    if (num === null || num === undefined) return '#VALUE!'
    const n = typeof num === 'number' ? num : parseFloat(String(num))
    if (isNaN(n)) return '#VALUE!'
    return Math.ceil(n)
  },

  // Conditional functions
  IF: (condition, trueValue, falseValue) => {
    const cond = Boolean(condition)
    return cond ? trueValue : falseValue
  },

  SWITCH: (value, ...cases) => {
    if (cases.length < 2) return '#ERROR!'
    // SWITCH(value, case1, result1, case2, result2, ..., default)
    const val = value
    for (let i = 0; i < cases.length - 1; i += 2) {
      if (cases[i] === val) {
        return cases[i + 1]
      }
    }
    // Default value (last argument if odd number of args)
    return cases.length % 2 === 1 ? cases[cases.length - 1] : null
  },

  // Date functions
  NOW: () => {
    return new Date()
  },

  TODAY: () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  },

  DATEADD: (date, amount, unit) => {
    if (date === null || amount === null || unit === null) return '#VALUE!'
    
    const d = date instanceof Date ? date : new Date(String(date))
    if (isNaN(d.getTime())) return '#VALUE!'
    
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount))
    if (isNaN(amt)) return '#VALUE!'
    
    const u = String(unit).toUpperCase()
    const result = new Date(d)

    switch (u) {
      case 'YEAR':
      case 'YEARS':
        result.setFullYear(result.getFullYear() + amt)
        break
      case 'MONTH':
      case 'MONTHS':
        result.setMonth(result.getMonth() + amt)
        break
      case 'DAY':
      case 'DAYS':
        result.setDate(result.getDate() + amt)
        break
      case 'HOUR':
      case 'HOURS':
        result.setHours(result.getHours() + amt)
        break
      case 'MINUTE':
      case 'MINUTES':
        result.setMinutes(result.getMinutes() + amt)
        break
      default:
        return '#VALUE!'
    }

    return result
  },

  DATETIME_FORMAT: (date, format) => {
    if (date === null || format === null) return '#VALUE!'
    
    const d = date instanceof Date ? date : new Date(String(date))
    if (isNaN(d.getTime())) return '#VALUE!'
    
    const fmt = String(format)
    let result = fmt

    // Simple format replacements
    result = result.replace(/YYYY/g, d.getFullYear().toString())
    result = result.replace(/YY/g, (d.getFullYear() % 100).toString().padStart(2, '0'))
    result = result.replace(/MM/g, (d.getMonth() + 1).toString().padStart(2, '0'))
    result = result.replace(/DD/g, d.getDate().toString().padStart(2, '0'))
    result = result.replace(/HH/g, d.getHours().toString().padStart(2, '0'))
    result = result.replace(/mm/g, d.getMinutes().toString().padStart(2, '0'))
    result = result.replace(/ss/g, d.getSeconds().toString().padStart(2, '0'))

    return result
  },
}
