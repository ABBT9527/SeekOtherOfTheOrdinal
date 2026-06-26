import Decimal from 'break_eternity.js'

const BASE = 3

function D(value: number | string | Decimal = 0): Decimal {
  return new Decimal(value)
}

function createZeroOrdinal() {
  return { terms: [], constant: D(0) }
}

function ordinalFromNatural(n: Decimal) {
  const input = D(n).floor()
  if (input.lte(0)) return createZeroOrdinal()
  if (input.lt(BASE)) return { terms: [], constant: input }

  const result = { terms: [] as any[], constant: D(0) }
  let remaining = input
  let guard = 0

  while (remaining.gt(0) && guard < 256) {
    guard++

    if (remaining.lt(BASE)) {
      result.constant = remaining.floor()
      break
    }

    const power = remaining.log(BASE).floor()
    const powerValue = Decimal.pow(BASE, power).round()
    let coefficient = remaining.div(powerValue).floor()

    if (coefficient.gte(BASE)) {
      coefficient = D(BASE - 1)
    }

    if (power.lte(0)) {
      result.constant = result.constant.add(coefficient)
    } else if (coefficient.gt(0)) {
      result.terms.push({
        exponent: ordinalFromNatural(power),
        coefficient: D(coefficient)
      })
    }

    const spent = powerValue.mul(coefficient)
    const nextRemaining = remaining.sub(spent).floor()
    if (nextRemaining.gte(remaining)) break
    remaining = nextRemaining
  }

  return result
}

function renderOrdinalToPlain(value: any, maxTerms = 8): string {
  const parts: string[] = []
  for (const term of value.terms) {
    parts.push(renderPlainTerm(term, maxTerms))
  }
  if (value.constant.gt(0)) {
    parts.push(value.constant.toString())
  }
  if (parts.length === 0) return '0'
  return parts.join('+')
}

function renderPlainTerm(term: any, maxTerms: number): string {
  const exp = renderPlainOrdinal(term.exponent, maxTerms)
  if (term.coefficient.eq(1)) {
    return `ω^(${exp})`
  }
  return `ω^(${exp})·${term.coefficient}`
}

function renderPlainOrdinal(value: any, maxTerms: number): string {
  const parts: string[] = []
  for (const term of value.terms) {
    parts.push(renderPlainTerm(term, maxTerms))
  }
  if (value.constant.gt(0)) {
    parts.push(value.constant.toString())
  }
  if (parts.length === 0) return '0'
  return parts.join('+')
}

function getTheoremCostAsOrdinal(theoremId: string, level: number) {
  if (theoremId === 'cofinal') {
    return ordinalFromNatural(D(BASE).pow(3 + level))
  }
  if (theoremId === 'cardinal') {
    return ordinalFromNatural(D(BASE).pow(6 + level))
  }
  if (theoremId === 'initial_segment') {
    return ordinalFromNatural(D(BASE).pow(9 + level))
  }
  if (theoremId === 'unbounded') {
    return ordinalFromNatural(D(BASE).pow(18 + level * 2))
  }
  return createZeroOrdinal()
}

// 测试
const theorems = ['cofinal', 'cardinal', 'initial_segment', 'unbounded']
for (const t of theorems) {
  for (let level = 0; level < 3; level++) {
    const cost = getTheoremCostAsOrdinal(t, level)
    console.log(`${t} Lv.${level}: ${renderOrdinalToPlain(cost, 8)} (natural=${cost.terms.reduce((s: number, tr: any) => s + tr.coefficient.toNumber() * Math.pow(3, tr.exponent.constant.toNumber()), 0) + cost.constant.toNumber()})`)
  }
}
