import Decimal from 'break_eternity.js'

export interface OrdinalTerm {
  exponent: OrdinalValue
  coefficient: Decimal
}

export interface OrdinalValue {
  terms: OrdinalTerm[]
  constant: Decimal
}

export const BASE = 3

export function D(value: number | string | Decimal = 0): Decimal {
  return new Decimal(value)
}

export function createZeroOrdinal(): OrdinalValue {
  return {
    terms: [],
    constant: D(0)
  }
}

export function cloneOrdinal(value: OrdinalValue): OrdinalValue {
  return {
    terms: value.terms.map((term) => ({
      exponent: cloneOrdinal(term.exponent),
      coefficient: D(term.coefficient)
    })),
    constant: D(value.constant)
  }
}

export function successorOrdinal(value: OrdinalValue): OrdinalValue {
  const next = cloneOrdinal(value)
  next.constant = next.constant.add(1)
  return next
}

export function successor(value: OrdinalValue): OrdinalValue {
  const next = cloneOrdinal(value)
  next.constant = next.constant.add(1)
  return next
}

export function limitOnce(value: OrdinalValue, _base = BASE): { value: OrdinalValue; changed: boolean } {
  const current = normalizeOrdinal(value)
  const maximized = ordinalFromNatural(ordinalToNatural(current))
  return {
    value: maximized,
    changed: compareOrdinal(maximized, current) > 0
  }
}

export function canLimit(value: OrdinalValue, _base = BASE): boolean {
  const current = normalizeOrdinal(value)
  const maximized = ordinalFromNatural(ordinalToNatural(current))
  return compareOrdinal(maximized, current) > 0
}

export function getVisibleTermCount(value: OrdinalValue): number {
  return value.terms.length + (value.constant.gt(0) ? 1 : 0)
}

export function renderOrdinalToKaTeX(value: OrdinalValue, maxTerms: number): string {
  const normalized = normalizeOrdinal(value)
  const parts: string[] = []

  for (const term of normalized.terms) {
    parts.push(renderTerm(term, maxTerms))
  }

  if (normalized.constant.gt(0)) {
    parts.push(`\\text{${formatOrdinalNumber(normalized.constant)}}`)
  }

  if (parts.length === 0) return '\\text{0}'

  const shown = parts.slice(0, maxTerms)
  const suffix = parts.length > maxTerms ? '\\text{+}\\cdots' : ''
  return shown.join('\\text{+}') + suffix
}

export function renderOrdinalToPlain(value: OrdinalValue, maxTerms = 8): string {
  const normalized = normalizeOrdinal(value)
  const parts: string[] = []

  for (const term of normalized.terms) {
    parts.push(renderPlainTerm(term, maxTerms))
  }

  if (normalized.constant.gt(0)) {
    parts.push(formatOrdinalNumber(normalized.constant))
  }

  if (parts.length === 0) return '0'

  const shown = parts.slice(0, maxTerms)
  const suffix = parts.length > maxTerms ? '+⋯' : ''
  return shown.join('+') + suffix
}

export function formatDecimal(value: Decimal | number | string): string {
  const n = D(value)
  if (n.eq(0)) return '0'
  if (n.lt(0)) return `-${formatDecimal(n.mul(-1))}`

  const width = 7
  if (n.gt(1_000_000)) {
    return formatScientificFixedWidth(n, width)
  }

  if (n.gte(1)) {
    const integerDigits = Math.floor(n.log10().toNumber()) + 1
    if (integerDigits >= width) {
      return n.floor().toFixed(0)
    }
    return toFixedFloor(n, width - integerDigits - 1)
  }

  return toFixedFloor(n, width - 2)
}

export function formatOrdinalNumber(value: Decimal | number | string): string {
  const n = D(value)
  if (n.eq(0)) return '0'
  if (n.lt(0)) return `-${formatOrdinalNumber(n.mul(-1))}`
  if (n.floor().eq(n) && n.lte(1_000_000)) {
    return n.toFixed(0)
  }
  return formatDecimal(n)
}

function formatScientificFixedWidth(value: Decimal, width: number): string {
  const exponent = value.exponent
  const exponentText = String(exponent)
  const mantissaWidth = width - 1 - exponentText.length

  if (mantissaWidth <= 1) {
    return `1e${exponentText}`.slice(0, width)
  }

  const mantissa = D(value.mantissa)
  const decimalPlaces = Math.max(0, mantissaWidth - 2)
  const mantissaText = decimalPlaces > 0
    ? toFixedFloor(mantissa, decimalPlaces)
    : mantissa.floor().toFixed(0)
  return `${mantissaText}e${exponentText}`
}

export function getOrdinalTier(value: OrdinalValue): number {
  const normalized = normalizeOrdinal(value)
  if (compareOrdinal(normalized, OMEGA_OMEGA_OMEGA) >= 0) return 5
  if (compareOrdinal(normalized, OMEGA_OMEGA_N_STAGE) >= 0) return 4
  if (compareOrdinal(normalized, OMEGA_OMEGA) >= 0) return 3
  if (compareOrdinal(normalized, OMEGA) >= 0) return 1
  return 0
}

export function getOrdinalTierName(tier: number): string {
  const names = ['有限', 'ω', 'ω²', 'ω^ω', 'ω^ω^n', 'ω^ω^ω']
  return names[tier] || 'ω^ω+'
}

export const OMEGA: OrdinalValue = {
  terms: [{ exponent: { terms: [], constant: D(1) }, coefficient: D(1) }],
  constant: D(0)
}

export const OMEGA_OMEGA: OrdinalValue = {
  terms: [{ exponent: cloneOrdinal(OMEGA), coefficient: D(1) }],
  constant: D(0)
}

export const OMEGA_OMEGA_N_STAGE: OrdinalValue = {
  terms: [{
    exponent: {
      terms: [{ exponent: { terms: [], constant: D(2) }, coefficient: D(1) }],
      constant: D(0)
    },
    coefficient: D(1)
  }],
  constant: D(0)
}

export const OMEGA_OMEGA_OMEGA: OrdinalValue = {
  terms: [{ exponent: cloneOrdinal(OMEGA_OMEGA), coefficient: D(1) }],
  constant: D(0)
}

export function getOrdinalStageLevel(value: OrdinalValue): number {
  const normalized = normalizeOrdinal(value)
  if (compareOrdinal(normalized, OMEGA_OMEGA_N_STAGE) >= 0) return 4
  if (compareOrdinal(normalized, OMEGA_OMEGA) >= 0) return 3
  if (compareOrdinal(normalized, OMEGA) >= 0) return 2
  return 1
}

export function isOrdinalCapReached(value: OrdinalValue): boolean {
  return compareOrdinal(normalizeOrdinal(value), OMEGA_OMEGA_OMEGA) >= 0
}

export function clampOrdinalToCap(value: OrdinalValue): OrdinalValue {
  return isOrdinalCapReached(value) ? cloneOrdinal(OMEGA_OMEGA_OMEGA) : normalizeOrdinal(value)
}

// Ordinal 转换为近似的自然数值（用于资源计算）
// 语义：ordinalToNatural(ordinal) = ordinal 包含的"后继单位"总数
export function ordinalToNatural(ordinal: OrdinalValue): Decimal {
  let total = D(0)
  for (const term of ordinal.terms) {
    const exponentNatural = ordinalToNatural(term.exponent)
    const termValue = D(term.coefficient).mul(basePower(exponentNatural))
    total = total.add(termValue)
  }

  return total.add(D(ordinal.constant))
}

// 只计算序数中非常数项（ω-terms）的自然数值，用于购买判定
export function getTermsNatural(ordinal: OrdinalValue): Decimal {
  let total = D(0)
  for (const term of ordinal.terms) {
    const exponentNatural = ordinalToNatural(term.exponent)
    const termValue = D(term.coefficient).mul(basePower(exponentNatural))
    total = total.add(termValue)
  }
  return total
}

// 自然数转换为序数（ordinalToNatural 的反函数）
// ordinalFromNatural(n) 返回一个 ordinal 使得 ordinalToNatural(ordinal) = n
// 实现：将 n 分解为 BASE 进制数字，每一位对应一个 ω 项的系数
export function ordinalFromNatural(n: Decimal): OrdinalValue {
  const input = D(n).floor()
  if (input.lte(0)) return createZeroOrdinal()
  if (input.lt(BASE)) return { terms: [], constant: input }

  const result: OrdinalValue = { terms: [], constant: D(0) }
  let remaining = input
  let guard = 0

  while (remaining.gt(0) && guard < 256) {
    guard++

    if (remaining.lt(BASE)) {
      result.constant = remaining.floor()
      break
    }

    let power = remaining.log(BASE).floor()
    // 修正 break_eternity.js log() 的浮点精度误差：
    // 当 remaining 恰好是 BASE 的幂时，log 可能返回 (k - epsilon) 导致 floor() 得到 k-1
    while (basePower(power.add(1)).lte(remaining)) {
      power = power.add(1)
    }
    const powerValue = basePower(power)
    // 使用精确比较避免 Decimal.div() 浮点误差（如 729/729=0.999...）
    let coefficient: Decimal
    if (remaining.gte(powerValue.mul(BASE - 1))) {
      coefficient = D(BASE - 1)
    } else if (remaining.gte(powerValue.mul(2))) {
      coefficient = D(2)
    } else if (remaining.gte(powerValue)) {
      coefficient = D(1)
    } else {
      coefficient = D(0)
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

  return normalizeOrdinal(result)
}

// Ordinal 减去一个自然数，结果按当前基数重新规范化为嵌套序数对象。
export function subtractFromOrdinal(ordinal: OrdinalValue, n: Decimal): OrdinalValue {
  if (n.lte(0)) return cloneOrdinal(ordinal)

  const nat = ordinalToNatural(ordinal)
  if (nat.lt(n)) {
    // 不应该发生，购买前应检查
    return cloneOrdinal(ordinal)
  }

  return ordinalFromNatural(nat.sub(n))
}

// Ordinal 减去另一个 Ordinal。
// 使用局部借位：优先扣除同指数项；不足时只从最接近的更高指数项借位，
// 再把借来的一个单位按基数展开。这样不会把整个尾部常数或其它低阶项一起重算。
export function subtractOrdinal(ordinal: OrdinalValue, cost: OrdinalValue): OrdinalValue {
  const current = normalizeOrdinal(ordinal)
  const required = normalizeOrdinal(cost)

  if (compareOrdinal(current, required) < 0) {
    return cloneOrdinal(current)
  }

  return subtractOrdinalLocal(current, required) ?? cloneOrdinal(current)
}

// 购买判定用：序数必须达到价格，且扣除后必须严格变小。
export function canSubtractOrdinal(ordinal: OrdinalValue, cost: OrdinalValue): boolean {
  const current = normalizeOrdinal(ordinal)
  const required = normalizeOrdinal(cost)
  if (compareOrdinal(current, required) < 0) return false

  const after = subtractOrdinal(current, required)
  return compareOrdinal(after, current) < 0
}

// 测试用：把当前序数按“约 3 倍资源量”的方向快速推进。
// 有最高项时直接把最高项指数 +1；只有有限常数时按自然数 3 倍重算。
export function tripleHighestTermExponent(value: OrdinalValue): OrdinalValue {
  const next = normalizeOrdinal(cloneOrdinal(value))

  if (next.terms.length === 0) {
    const natural = next.constant.gt(0) ? next.constant.mul(BASE) : D(BASE)
    return ordinalFromNatural(natural)
  }

  next.terms[0].exponent = successorOrdinal(next.terms[0].exponent)
  return normalizeOrdinal(next)
}

function subtractOrdinalLocal(current: OrdinalValue, required: OrdinalValue): OrdinalValue | null {
  const result = cloneOrdinal(current)

  for (const requiredTerm of required.terms) {
    if (!subtractTermUnits(result, requiredTerm.exponent, requiredTerm.coefficient)) {
      return null
    }
  }

  if (required.constant.gt(0)) {
    if (!subtractConstantUnits(result, required.constant)) {
      return null
    }
  }

  return normalizeOrdinal(result)
}

function subtractTermUnits(result: OrdinalValue, exponent: OrdinalValue, amount: Decimal): boolean {
  let remaining = D(amount)
  let guard = 0

  while (remaining.gt(0) && guard < 512) {
    guard++
    const normalized = normalizeOrdinal(result)
    result.terms = normalized.terms
    result.constant = normalized.constant

    const exact = result.terms.find((term) => compareOrdinal(term.exponent, exponent) === 0)
    if (exact && exact.coefficient.gt(0)) {
      const paid = exact.coefficient.lt(remaining) ? D(exact.coefficient) : D(remaining)
      exact.coefficient = exact.coefficient.sub(paid)
      remaining = remaining.sub(paid)
      continue
    }

    const borrow = findSmallestHigherTerm(result, exponent)
    if (!borrow) return false

    borrow.coefficient = borrow.coefficient.sub(1)

    const borrowedValue = basePower(ordinalToNatural(borrow.exponent))
    const unitCostValue = basePower(ordinalToNatural(exponent))
    // 使用 round() 避免 Decimal.div() 浮点误差（如 19683/729=26.999...）
    const maxPay = borrowedValue.div(unitCostValue).round()
    if (maxPay.lte(0)) return false

    const paid = maxPay.lt(remaining) ? maxPay : D(remaining)
    const remainderValue = borrowedValue.sub(unitCostValue.mul(paid)).floor()
    if (remainderValue.gt(0)) {
      addOrdinalInto(result, ordinalFromBorrowRemainder(remainderValue))
    }
    remaining = remaining.sub(paid)
  }

  return remaining.lte(0)
}

function subtractConstantUnits(result: OrdinalValue, amount: Decimal): boolean {
  let remaining = D(amount)
  let guard = 0

  while (remaining.gt(0) && guard < 512) {
    guard++
    if (result.constant.gt(0)) {
      const paid = result.constant.lt(remaining) ? D(result.constant) : D(remaining)
      result.constant = result.constant.sub(paid)
      remaining = remaining.sub(paid)
      continue
    }

    const borrow = findSmallestHigherTerm(result, createZeroOrdinal())
    if (!borrow) return false

    borrow.coefficient = borrow.coefficient.sub(1)
    const borrowedValue = basePower(ordinalToNatural(borrow.exponent))
    const paid = borrowedValue.lt(remaining) ? borrowedValue : D(remaining)
    const remainderValue = borrowedValue.sub(paid).floor()
    if (remainderValue.gt(0)) {
      addOrdinalInto(result, ordinalFromBorrowRemainder(remainderValue))
    }
    remaining = remaining.sub(paid)
  }

  return remaining.lte(0)
}

function findSmallestHigherTerm(value: OrdinalValue, exponent: OrdinalValue): OrdinalTerm | null {
  let best: OrdinalTerm | null = null
  for (const term of value.terms) {
    if (term.coefficient.lte(0)) continue
    if (compareOrdinal(term.exponent, exponent) <= 0) continue
    if (!best || compareOrdinal(term.exponent, best.exponent) < 0) {
      best = term
    }
  }
  return best
}

function addOrdinalInto(target: OrdinalValue, addition: OrdinalValue) {
  for (const term of addition.terms) {
    addTerm(target, term.exponent, term.coefficient)
  }
  target.constant = target.constant.add(addition.constant)
}

// 借位展开专用：将资源量按 BASE 进制展开为 ω 基序数项。
// 与 ordinalFromNatural 不同，这里将每个幂的指数 power 分解为
// quotient = power // BASE 和 remainder = power % BASE，
// 生成形如 ω^(ω·quotient + remainder) 的项，使得指数自身也是
// ω 基序数结构，从而保持正确的序数比较语义。
function ordinalFromBorrowRemainder(value: Decimal): OrdinalValue {
  const input = D(value).floor()
  if (input.lte(0)) return createZeroOrdinal()
  if (input.lt(BASE)) return { terms: [], constant: input }

  const result: OrdinalValue = { terms: [], constant: D(0) }
  let remaining = input
  let guard = 0

  while (remaining.gt(0) && guard < 512) {
    guard++

    if (remaining.lt(BASE)) {
      result.constant = remaining.floor()
      break
    }

    const power = remaining.log(BASE).floor()
    const powerValue = basePower(power)
    let coefficient = remaining.div(powerValue).floor()

    if (coefficient.gte(BASE)) {
      coefficient = D(BASE - 1)
    }

    if (power.lte(0)) {
      result.constant = result.constant.add(coefficient)
    } else if (coefficient.gt(0)) {
      const quotient = power.div(BASE).floor()
      const remainder = power.mod(BASE)
      result.terms.push({
        exponent: {
          terms: [{ exponent: { terms: [], constant: D(1) }, coefficient: quotient }],
          constant: D(remainder)
        },
        coefficient: D(coefficient)
      })
    }

    const spent = powerValue.mul(coefficient)
    const nextRemaining = remaining.sub(spent).floor()
    if (nextRemaining.gte(remaining)) break
    remaining = nextRemaining
  }

  return normalizeOrdinal(result)
}

function renderTerm(term: OrdinalTerm, maxTerms: number): string {
  const isExponentOne = isFiniteOrdinal(term.exponent, 1)
  const omega = isExponentOne
    ? '\\omega'
    : `\\omega^{${renderOrdinalToKaTeX(term.exponent, maxTerms)}}`

  if (term.coefficient.eq(1)) return omega
  return `${omega}\\text{${formatOrdinalNumber(term.coefficient)}}`
}

function renderPlainTerm(term: OrdinalTerm, maxTerms: number): string {
  const isExponentOne = isFiniteOrdinal(term.exponent, 1)
  const exponentText = renderOrdinalToPlain(term.exponent, maxTerms)
  const omega = isExponentOne
    ? 'ω'
    : exponentText.includes('+')
      ? `ω^{${exponentText}}`
      : `ω^${exponentText}`

  if (term.coefficient.eq(1)) return omega
  return `${omega}${formatOrdinalNumber(term.coefficient)}`
}

function addTerm(value: OrdinalValue, exponent: OrdinalValue, coefficient: Decimal) {
  if (coefficient.lte(0)) return

  const existing = value.terms.find((term) => compareOrdinal(term.exponent, exponent) === 0)
  if (existing) {
    existing.coefficient = existing.coefficient.add(coefficient)
  } else {
    value.terms.push({
      exponent: cloneOrdinal(exponent),
      coefficient: D(coefficient)
    })
  }
}

function normalizeOrdinal(value: OrdinalValue): OrdinalValue {
  const merged: OrdinalTerm[] = []

  for (const term of value.terms) {
    if (term.coefficient.lte(0)) continue
    const exponent = normalizeOrdinal(term.exponent)
    const existing = merged.find((item) => compareOrdinal(item.exponent, exponent) === 0)
    if (existing) {
      existing.coefficient = existing.coefficient.add(term.coefficient)
    } else {
      merged.push({
        exponent,
        coefficient: D(term.coefficient)
      })
    }
  }

  merged.sort((a, b) => -compareOrdinal(a.exponent, b.exponent))

  return {
    terms: merged,
    constant: D(value.constant)
  }
}

// 序数比较：a > b 返回 1，a < b 返回 -1，a == b 返回 0
export function compareOrdinal(a: OrdinalValue, b: OrdinalValue): number {
  const aNorm = normalizeOrdinal(a)
  const bNorm = normalizeOrdinal(b)
  const aTerms = aNorm.terms
  const bTerms = bNorm.terms
  const len = Math.max(aTerms.length, bTerms.length)

  for (let i = 0; i < len; i++) {
    const left = aTerms[i]
    const right = bTerms[i]
    if (!left && right) return -1
    if (left && !right) return 1
    if (!left || !right) break

    const expCompare = compareOrdinal(left.exponent, right.exponent)
    if (expCompare !== 0) return expCompare

    if (left.coefficient.gt(right.coefficient)) return 1
    if (left.coefficient.lt(right.coefficient)) return -1
  }

  if (aNorm.constant.gt(bNorm.constant)) return 1
  if (aNorm.constant.lt(bNorm.constant)) return -1
  return 0
}

// 便捷检查：ordinal >= minRequirement
export function ordinalAtLeast(ordinal: OrdinalValue, minRequired: OrdinalValue): boolean {
  return compareOrdinal(ordinal, minRequired) >= 0
}

function isFiniteOrdinal(value: OrdinalValue, finite: number): boolean {
  return value.terms.length === 0 && value.constant.eq(finite)
}

function toFixedFloor(value: Decimal, places: number): string {
  const safePlaces = Math.max(0, Math.floor(places))
  const scale = Decimal.pow(10, safePlaces)
  return value.mul(scale).floor().div(scale).toFixed(safePlaces)
}

function basePower(exponent: Decimal): Decimal {
  return Decimal.pow(BASE, exponent).round()
}
