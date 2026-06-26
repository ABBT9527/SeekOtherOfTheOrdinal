import { ref, computed, type Ref } from 'vue'
import Decimal from 'break_eternity.js'
import {
  BASE,
  D,
  canLimit,
  createZeroOrdinal,
  formatDecimal,
  formatOrdinalNumber,
  clampOrdinalToCap,
  getOrdinalTier,
  getOrdinalStageLevel,
  getVisibleTermCount,
  isOrdinalCapReached,
  limitOnce,
  OMEGA_OMEGA,
  ordinalToNatural,
  ordinalFromNatural,
  ordinalAtLeast,
  subtractOrdinal,
  getTermsNatural,
  renderOrdinalToPlain,
  renderOrdinalToKaTeX,
  successor,
  tripleHighestTermExponent,
  type OrdinalValue
} from '../utils/ordinal'
import {
  saveGame,
  loadGame,
  exportSaveToBase64,
  importSaveFromBase64,
  createDefaultSave,
  serializeOrdinal,
  deserializeOrdinal,
  serializeDecimal,
  deserializeDecimal,
  migrateSaveIfNeeded,
  COLLECTION_UPGRADES,
  THEOREM_UPGRADES,
  type UpgradeState
} from './save'

// ========== 游戏状态单例 ==========
const GLOBAL_KEY = '__ORDINAL_GAME_LOGIC_STATE_V2__'

interface GameState {
  ordinalValue: Ref<OrdinalValue>
  count: Ref<Decimal>
  finiteCount: Ref<Decimal>
  base: number
  maxTerms: Ref<number>
  autoSaveIntervalSeconds: Ref<number>
  tickIntervalMs: Ref<number>
  katexReady: Ref<boolean>
  isTransitioning: Ref<boolean>
  successorPulse: Ref<boolean>
  limitPulse: Ref<boolean>
  limitCooldownRemainingMs: Ref<number>
  limitCooldownTotalMs: Ref<number>
  limitSetN: Ref<Decimal>
  lastSave: Ref<number>
  collectionVersion: Ref<number>
  collection: Record<string, UpgradeState>
  theorems: Record<string, UpgradeState>
  successorTimer: ReturnType<typeof setInterval> | null
  limitTimer: ReturnType<typeof setInterval> | null
}

function createState(): GameState {
  return {
    ordinalValue: ref(createZeroOrdinal()),
    count: ref(D(0)),
    finiteCount: ref(D(0)),
    base: BASE,
    maxTerms: ref(12),
    autoSaveIntervalSeconds: ref(60),
    tickIntervalMs: ref(50),
    katexReady: ref(false),
    isTransitioning: ref(false),
    successorPulse: ref(false),
    limitPulse: ref(false),
    limitCooldownRemainingMs: ref(0),
    limitCooldownTotalMs: ref(0),
    limitSetN: ref(D(BASE)),
    lastSave: ref(0),
    collectionVersion: ref(0),
    collection: {},
    theorems: {},
    successorTimer: null,
    limitTimer: null,
  }
}

// 从全局获取或创建状态
const state: GameState = (window as any)[GLOBAL_KEY] || createState()
;(window as any)[GLOBAL_KEY] = state

const AUTO_LOOP_INTERVAL_MS = 50

let lastOrdinalLevel = 0
let pulseTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性
const ordinal = computed(() => {
  const ordinalText = renderOrdinalToKaTeX(state.ordinalValue.value, state.maxTerms.value)
  const finite = state.finiteCount.value
  if (finite.lte(0)) return ordinalText
  // 将常数项追加到序数显示中
  if (ordinalText === '\\text{0}') {
    return `\\text{${formatOrdinalNumber(finite)}}`
  }
  return `${ordinalText}\\text{+}\\text{${formatOrdinalNumber(finite)}}`
})

const termCount = computed(() => {
  return getVisibleTermCount(state.ordinalValue.value)
})

const displayCount = computed(() => {
  if (ordinalCapReached.value) {
    return `${formatDecimal(ordinalToNatural(state.ordinalValue.value))} (已达硬上限)`
  }
  const total = ordinalToNatural(state.ordinalValue.value).add(state.finiteCount.value)
  return formatDecimal(total)
})
const ordinalCapReached = computed(() => isOrdinalCapReached(state.ordinalValue.value))
const limitCooldownActive = computed(() => state.limitCooldownRemainingMs.value > 0)
const limitCooldownProgress = computed(() => {
  if (state.limitCooldownTotalMs.value <= 0) return 100
  const elapsed = state.limitCooldownTotalMs.value - state.limitCooldownRemainingMs.value
  return Math.max(0, Math.min(100, (elapsed / state.limitCooldownTotalMs.value) * 100))
})
const limitCooldownSecondsLeft = computed(() => (state.limitCooldownRemainingMs.value / 1000).toFixed(1))
const limitCooldownDuration = computed(() => {
  state.collectionVersion.value
  return getLimitCooldownSeconds().toFixed(2)
})
const limitCooldownDivisor = computed(() => {
  state.collectionVersion.value
  return getLimitCooldownDivisor().toFixed(2)
})
const limitAvailable = computed(() => !limitCooldownActive.value && state.finiteCount.value.gt(0))
const finitePart = computed(() => formatOrdinalNumber(state.finiteCount.value))
const ordinalStageLevel = computed(() => getOrdinalStageLevel(state.ordinalValue.value))

function checkTransition(previousLevel: number) {
  const currentLevel = getOrdinalTier(state.ordinalValue.value)
  if (currentLevel > previousLevel) {
    triggerTransition()
  }
  lastOrdinalLevel = currentLevel
}

function triggerTransition() {
  state.isTransitioning.value = true
  setTimeout(() => {
    state.isTransitioning.value = false
  }, 1500)
}

function completeTransition() {
  state.isTransitioning.value = false
}

function successorAction() {
  if (ordinalCapReached.value) return false
  state.finiteCount.value = state.finiteCount.value.add(1)
  pulse('successor')
  save()
  return true
}

function limitAction() {
  if (!limitAvailable.value) return false
  // 先进入冷却等待，冷却结束后再执行极限
  startLimitCooldown()
  pulse('limit')
  startAutoTick()
  save()
  return true
}

// 冷却结束后执行极限操作：将常数项合并到序数中并最大化，
// 规范化后的常数项直接归类到 finiteCount，序数只保留 ω-terms
function onLimitCooldownComplete() {
  if (state.finiteCount.value.lte(0)) return

  const previousLevel = lastOrdinalLevel

  // 已达上限时只归零常数项，序数保持不变
  if (isOrdinalCapReached(state.ordinalValue.value)) {
    state.finiteCount.value = D(0)
    applyCofinalSuccessors()
    checkTransition(previousLevel)
    startAutoTick()
    save()
    return
  }

  const totalNatural = ordinalToNatural(state.ordinalValue.value).add(state.finiteCount.value)
  const newOrdinal = ordinalFromNatural(totalNatural)

  // 将规范化后的常数项归类到 finiteCount
  state.finiteCount.value = D(newOrdinal.constant)
  newOrdinal.constant = D(0)

  setOrdinalAndCount(newOrdinal)
  applyCofinalSuccessors()
  checkTransition(previousLevel)
  startAutoTick()
  save()
}

function reset() {
  state.ordinalValue.value = createZeroOrdinal()
  state.count.value = D(0)
  state.finiteCount.value = D(0)
  lastOrdinalLevel = 0
  state.successorPulse.value = false
  state.limitPulse.value = false
  state.limitCooldownRemainingMs.value = 0
  state.limitCooldownTotalMs.value = 0
  state.limitSetN.value = D(BASE)
  state.isTransitioning.value = false
  state.collection = {}
  state.theorems = {}
  touchCollection()
  stopAutoTick()
  if (pulseTimer) {
    clearTimeout(pulseTimer)
    pulseTimer = null
  }
  save()
}

function debugTriple() {
  if (ordinalCapReached.value) return
  setOrdinalAndCount(tripleHighestTermExponent(state.ordinalValue.value))
  save()
}

function save() {
  const saveData = createDefaultSave()
  saveData.core.count = serializeDecimal(state.count.value)
  saveData.core.ordinal = serializeOrdinal(state.ordinalValue.value)
  saveData.core.finiteCount = serializeDecimal(state.finiteCount.value)
  saveData.meta.settings.maxTerms = state.maxTerms.value
  saveData.meta.settings.autoSaveIntervalSeconds = sanitizeAutoSaveInterval(state.autoSaveIntervalSeconds.value)
  saveData.meta.settings.tickIntervalMs = sanitizeTickInterval(state.tickIntervalMs.value)
  saveData.meta.collection = { upgrades: state.collection }
  saveData.meta.theorems = { upgrades: state.theorems }
  saveGame(saveData)
  state.lastSave.value = Date.now()
}

function load(): boolean {
  const saved = loadGame()
  if (!saved) return false

  const migrated = migrateSaveIfNeeded(saved)
  state.count.value = deserializeDecimal(migrated.core.count)
  state.ordinalValue.value = clampOrdinalToCap(deserializeOrdinal(migrated.core.ordinal))
  state.finiteCount.value = deserializeDecimal(migrated.core.finiteCount || '0')
  state.count.value = ordinalToNatural(state.ordinalValue.value)
  state.maxTerms.value = migrated.meta.settings.maxTerms
  state.autoSaveIntervalSeconds.value = sanitizeAutoSaveInterval(migrated.meta.settings.autoSaveIntervalSeconds)
  state.tickIntervalMs.value = sanitizeTickInterval(migrated.meta.settings.tickIntervalMs)
  state.collection = migrated.meta.collection?.upgrades || {}
  state.theorems = migrated.meta.theorems?.upgrades || {}
  touchCollection()
  lastOrdinalLevel = getOrdinalTier(state.ordinalValue.value)
  state.lastSave.value = migrated.timestamp

  // 启动自动tick如果有升级
  if (getUpgradeLevel('successor_set') > 0 || getUpgradeLevel('limit_set') > 0) {
    startAutoTick()
  }

  return true
}

function exportBase64(): string {
  save()
  return exportSaveToBase64()
}

function importBase64(base64: string): boolean {
  importSaveFromBase64(base64)
  return load()
}

function init() {
  const checkKatex = setInterval(() => {
    if (typeof window.katex !== 'undefined') {
      state.katexReady.value = true
      clearInterval(checkKatex)
    }
  }, 200)

  setTimeout(() => {
    clearInterval(checkKatex)
  }, 8000)

  lastOrdinalLevel = getOrdinalTier(state.ordinalValue.value)
}

function pulse(type: 'successor' | 'limit') {
  state.successorPulse.value = type === 'successor'
  state.limitPulse.value = type === 'limit'
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    state.successorPulse.value = false
    state.limitPulse.value = false
  }, 180)
}

function touchCollection() {
  state.collectionVersion.value++
}

function sanitizeAutoSaveInterval(value: number): number {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) return 5
  return Math.max(1, Math.floor(normalized))
}

function setAutoSaveIntervalSeconds(value: number) {
  state.autoSaveIntervalSeconds.value = sanitizeAutoSaveInterval(value)
  save()
}

function sanitizeTickInterval(value: number): number {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) return 50
  return Math.max(20, Math.min(500, Math.floor(normalized)))
}

function setTickIntervalMs(value: number) {
  state.tickIntervalMs.value = sanitizeTickInterval(value)
  // 重启自动 tick 以应用新间隔
  startAutoTick()
  save()
}

function getLimitSetN(): Decimal {
  const purchaseCount = getUpgradeLevel('limit_set')
  if (purchaseCount <= 0) return D(0)
  const limitBoostCount = getUpgradeEffectBoost('limit_set')
  return D(purchaseCount).mul(D(BASE).pow(limitBoostCount))
}

function getLimitCooldownSeconds(): number {
  const n = getLimitSetN()
  if (n.lte(0)) return 9
  // t = 9 / log_ω(log_ω(n+3) + 2)
  const log3N = n.add(3).log(BASE).toNumber()
  const divisor = Math.log(log3N + 2) / Math.log(BASE)
  if (divisor <= 0) return 9
  return Math.max(0.25, 9 / divisor)
}

function getLimitCooldownDivisor(): number {
  const n = getLimitSetN()
  if (n.lte(0)) return 1
  const log3N = n.add(3).log(BASE).toNumber()
  const divisor = Math.log(log3N + 2) / Math.log(BASE)
  return Math.max(1, divisor)
}

function startLimitCooldown() {
  const totalMs = getLimitCooldownSeconds() * 1000
  state.limitCooldownTotalMs.value = totalMs
  state.limitCooldownRemainingMs.value = totalMs
}

function setOrdinalAndCount(value: OrdinalValue, count?: Decimal) {
  const capped = clampOrdinalToCap(value)
  state.ordinalValue.value = capped
  state.count.value = count ? D(count) : ordinalToNatural(capped)

  if (isOrdinalCapReached(capped)) {
    state.ordinalValue.value = clampOrdinalToCap(capped)
    state.count.value = ordinalToNatural(state.ordinalValue.value)
    stopAutoTick()
  }
}

function applyCofinalSuccessors() {
  const level = getTheoremLevel('cofinal')
  if (level <= 0 || ordinalCapReached.value) return
  addSuccessorSteps(D(level).mul(getInitialSegmentMultiplier()))
}

// ========== 集合升级功能 ==========

// 获取成本序数（OrdinalValue 形式，用于序数比较）
function getUpgradeCostAsOrdinal(upgradeId: string): OrdinalValue {
  const upgrade = COLLECTION_UPGRADES.find(u => u.id === upgradeId)
  if (!upgrade) return createZeroOrdinal()

  const level = state.collection[upgradeId]?.level || 0

  // 根据 baseCost 和 costGrowth 生成序数。
  // 价格指数必须使用 ordinalFromNatural 规范化为“该计数下最高可达序数”：
  // 例如指数计数 4/5 会变成 ω+1/ω+2，因此价格为 ω^(ω+1)/ω^(ω+2)。
  if (upgrade.baseCost === 'ω') {
    return createPowerCostFromExponentCount(D(level + 1))
  }
  if (upgrade.baseCost === 'ω^ω') {
    return createPowerCostFromExponentCount(D(BASE).add(level))
  }

  // 默认：ω（基础情况）
  return {
    terms: [{ exponent: { terms: [], constant: D(1) }, coefficient: D(1) }],
    constant: D(0)
  }
}

function ensureUpgradeState(upgradeId: string): UpgradeState {
  if (!state.collection[upgradeId]) {
    state.collection[upgradeId] = {
      level: 0,
      unlocked: true,
      levelOrdinal: serializeOrdinal(createZeroOrdinal()),
      effectBoosts: 0
    }
  }

  const upgrade = state.collection[upgradeId]
  if (!upgrade.levelOrdinal) {
    upgrade.levelOrdinal = serializeOrdinal(ordinalFromNatural(D(upgrade.level || 0)))
  }
  if (typeof upgrade.effectBoosts !== 'number') {
    upgrade.effectBoosts = 0
  }

  return upgrade
}

function getUpgradeLevelOrdinalValue(upgradeId: string): OrdinalValue {
  const upgrade = ensureUpgradeState(upgradeId)
  return deserializeOrdinal(upgrade.levelOrdinal!)
}

function setUpgradeLevelOrdinalValue(upgradeId: string, value: OrdinalValue) {
  ensureUpgradeState(upgradeId).levelOrdinal = serializeOrdinal(value)
}

function createPowerCostFromExponentCount(exponentCount: Decimal): OrdinalValue {
  return {
    terms: [{
      exponent: ordinalFromNatural(exponentCount),
      coefficient: D(1)
    }],
    constant: D(0)
  }
}

// 计算升级成本（自然数形式，用于计算）
function getUpgradeCostNatural(upgradeId: string): Decimal {
  const costOrdinal = getUpgradeCostAsOrdinal(upgradeId)
  return ordinalToNatural(costOrdinal)
}

// 计算升级成本（序数形式，用于显示）
function getUpgradeCostOrdinal(upgradeId: string): string {
  const costOrdinal = getUpgradeCostAsOrdinal(upgradeId)
  // 使用 renderOrdinalToKaTeX 正确渲染序数
  return renderOrdinalToKaTeX(costOrdinal, 8)
}

function getUpgradeLevelOrdinal(upgradeId: string): string {
  return renderOrdinalToKaTeX(getUpgradeLevelOrdinalValue(upgradeId), 8)
}

function getUpgradeLevelDisplayOrdinal(upgradeId: string): string {
  const levelOrdinal = getUpgradeLevelOrdinal(upgradeId)
  const rawLevel = formatOrdinalNumber(D(getUpgradeLevel(upgradeId)))
  return `\\mathrm{Lv.}\\,${levelOrdinal}\\,\\mathrm{(${rawLevel})}`
}

function getUpgradeLevelLabel(upgradeId: string): string {
  const rawLevel = formatOrdinalNumber(D(getUpgradeLevel(upgradeId)))
  const levelOrdinal = renderOrdinalToPlain(getUpgradeLevelOrdinalValue(upgradeId), 8)
  return `Lv.${levelOrdinal}(${rawLevel})`
}

function getUpgradeEffectBoost(upgradeId: string): number {
  return ensureUpgradeState(upgradeId).effectBoosts || 0
}

function getUnboundedMultiplier(): Decimal {
  const unboundedLevel = getTheoremLevel('unbounded')
  if (unboundedLevel <= 0) return D(1)
  const successorSetLevel = getUpgradeLevel('successor_set')
  if (successorSetLevel <= 0) return D(1)
  const base = D(1).add(D(unboundedLevel).mul(0.03))
  return multiplyIntegerTimes(base, successorSetLevel)
}

function getUpgradeEffectValue(upgradeId: string): Decimal {
  const levelValue = ordinalToNatural(getUpgradeLevelOrdinalValue(upgradeId))
  if (levelValue.lte(0)) return D(0)
  const boost = getUpgradeEffectBoost(upgradeId)
  let value = levelValue.mul(multiplyIntegerTimes(D(state.base), boost))
  if (upgradeId === 'successor_set') {
    value = value.mul(getCardinalSuccessorLimitMultiplier())
    value = value.mul(getInitialSegmentMultiplier())
    value = value.mul(getCofinalSpeedMultiplier())
    value = value.mul(getUnboundedMultiplier())
  }
  return value
}

function canLimitUpgradeLevel(upgradeId: string): boolean {
  const levelOrdinal = getUpgradeLevelOrdinalValue(upgradeId)
  return ensureUpgradeState(upgradeId).level > 0 && canLimitUpgradeLevelOrdinal(levelOrdinal)
}

function limitUpgradeLevel(upgradeId: string): boolean {
  if (!canLimitUpgradeLevel(upgradeId)) return false

  const before = getUpgradeLevelOrdinalValue(upgradeId)
  const result = limitUpgradeLevelOnce(before)
  if (!result.changed) return false

  setUpgradeLevelOrdinalValue(upgradeId, result.value)
  const upgrade = ensureUpgradeState(upgradeId)
  upgrade.effectBoosts = (upgrade.effectBoosts || 0) + 1
  touchCollection()
  startAutoTick()
  save()
  return true
}

function limitUpgradeLevelOnce(value: OrdinalValue): { value: OrdinalValue; changed: boolean } {
  const next = cloneLevelOrdinal(value)

  for (const term of next.terms) {
    const exponentLimit = limitUpgradeLevelOnce(term.exponent)
    if (exponentLimit.changed) {
      term.exponent = exponentLimit.value
      return { value: normalizeLevelOrdinal(next), changed: true }
    }
  }

  for (const term of next.terms) {
    if (term.coefficient.gte(state.base)) {
      term.coefficient = term.coefficient.sub(state.base)
      addLevelTerm(next, successor(term.exponent), D(1))
      return { value: normalizeLevelOrdinal(next), changed: true }
    }
  }

  if (next.constant.gte(state.base)) {
    next.constant = next.constant.sub(state.base)
    addLevelTerm(next, { terms: [], constant: D(1) }, D(1))
    return { value: normalizeLevelOrdinal(next), changed: true }
  }

  return { value: next, changed: false }
}

function canLimitUpgradeLevelOrdinal(value: OrdinalValue): boolean {
  if (value.constant.gte(state.base)) return true
  return value.terms.some((term) => term.coefficient.gte(state.base) || canLimitUpgradeLevelOrdinal(term.exponent))
}

function cloneLevelOrdinal(value: OrdinalValue): OrdinalValue {
  return {
    terms: value.terms.map((term) => ({
      exponent: cloneLevelOrdinal(term.exponent),
      coefficient: D(term.coefficient)
    })),
    constant: D(value.constant)
  }
}

function normalizeLevelOrdinal(value: OrdinalValue): OrdinalValue {
  const merged: OrdinalValue = {
    terms: [],
    constant: D(value.constant)
  }

  for (const term of value.terms) {
    if (term.coefficient.lte(0)) continue
    addLevelTerm(merged, normalizeLevelOrdinal(term.exponent), term.coefficient)
  }

  merged.terms.sort((a, b) => -ordinalCompareForLevel(a.exponent, b.exponent))
  return merged
}

function addLevelTerm(target: OrdinalValue, exponent: OrdinalValue, coefficient: Decimal) {
  if (coefficient.lte(0)) return
  const normalizedExponent = normalizeLevelOrdinal(exponent)
  const existing = target.terms.find((term) => ordinalCompareForLevel(term.exponent, normalizedExponent) === 0)
  if (existing) {
    existing.coefficient = existing.coefficient.add(coefficient)
  } else {
    target.terms.push({
      exponent: normalizedExponent,
      coefficient: D(coefficient)
    })
  }
}

function ordinalCompareForLevel(a: OrdinalValue, b: OrdinalValue): number {
  const aText = renderOrdinalToPlain(a, 64)
  const bText = renderOrdinalToPlain(b, 64)
  if (aText === bText) return 0
  return ordinalAtLeast(a, b) ? 1 : -1
}

// 检查是否可购买升级：只用非常数项（ω-terms）计算
function canBuyUpgrade(upgradeId: string): boolean {
  const costNatural = getUpgradeCostNatural(upgradeId)
  const currentTermsNatural = getTermsNatural(state.ordinalValue.value)
  return currentTermsNatural.gte(costNatural)
}

// 购买升级：使用序数局部借位减法，只扣除非常数项，保留常数项不受影响
function buyUpgrade(upgradeId: string) {
  if (!canBuyUpgrade(upgradeId)) return false

  const upgrade = COLLECTION_UPGRADES.find(u => u.id === upgradeId)
  if (!upgrade) return false

  const costOrdinal = getUpgradeCostAsOrdinal(upgradeId)
  const costNatural = ordinalToNatural(costOrdinal)
  const currentTermsNatural = getTermsNatural(state.ordinalValue.value)
  const nextTermsNatural = currentTermsNatural.sub(costNatural).floor()
  if (nextTermsNatural.gte(currentTermsNatural)) return false

  // 优先使用序数借位减法；如果借位失败（指数结构不匹配），回退到自然数减法
  const subtracted = subtractOrdinal(state.ordinalValue.value, costOrdinal)
  const subtractedTermsNatural = getTermsNatural(subtracted)
  if (subtractedTermsNatural.lt(currentTermsNatural)) {
    setOrdinalAndCount(subtracted, ordinalToNatural(subtracted))
  } else {
    // 回退：只重构 terms 部分，保留原有常数项
    const newTerms = ordinalFromNatural(nextTermsNatural)
    const newOrdinal = {
      terms: newTerms.terms,
      constant: state.ordinalValue.value.constant
    }
    setOrdinalAndCount(newOrdinal, ordinalToNatural(newOrdinal))
  }

  // 增加升级等级
  const upgradeState = ensureUpgradeState(upgradeId)
  upgradeState.level++
  setUpgradeLevelOrdinalValue(upgradeId, successor(getUpgradeLevelOrdinalValue(upgradeId)))
  touchCollection()

  // 启动/重启自动tick
  startAutoTick()
  save()
  return true
}

// 获取升级等级
function getUpgradeLevel(upgradeId: string): number {
  return state.collection[upgradeId]?.level || 0
}

// ========== 定理升级功能 ==========

function ensureTheoremState(theoremId: string): UpgradeState {
  if (!state.theorems[theoremId]) {
    state.theorems[theoremId] = {
      level: 0,
      unlocked: true
    }
  }
  return state.theorems[theoremId]
}

function getTheoremCostAsOrdinal(theoremId: string): OrdinalValue {
  const level = getTheoremLevel(theoremId)

  if (theoremId === 'cofinal') {
    // base: ω^ω = 3^3, growth: ×3 per level
    return ordinalFromNatural(D(BASE).pow(3 + level).round())
  }
  if (theoremId === 'cardinal') {
    // base: ω^(ω·2) = 3^6, growth: ×3 per level
    return ordinalFromNatural(D(BASE).pow(6 + level).round())
  }
  if (theoremId === 'initial_segment') {
    // Lv.0: 3^11 = ω^(ω^2+2), Lv.1: 3^17（下调3倍）
    const exponent = level === 0 ? 11 : 17
    return ordinalFromNatural(D(BASE).pow(exponent).round())
  }
  if (theoremId === 'unbounded') {
    // base: ω^(ω^2+ω+2) = 3^14, growth: ×9 = ×3^2 per level
    return ordinalFromNatural(D(BASE).pow(14 + level * 2).round())
  }
  return OMEGA_OMEGA
}

function omegaPowerWithOmegaTail(tail: number): OrdinalValue {
  const exponent = {
    terms: [{
      exponent: { terms: [], constant: D(1) },
      coefficient: D(1)
    }],
    constant: D(tail)
  }
  return {
    terms: [{ exponent, coefficient: D(1) }],
    constant: D(0)
  }
}

function omegaPowerWithOmegaCoefficientAndTail(coefficient: number, tail: number): OrdinalValue {
  return {
    terms: [{
      exponent: {
        terms: [{
          exponent: { terms: [], constant: D(1) },
          coefficient: D(coefficient)
        }],
        constant: D(tail)
      },
      coefficient: D(1)
    }],
    constant: D(0)
  }
}

function omegaPowerWithOmegaSquaredTail(tail: number): OrdinalValue {
  return {
    terms: [{
      exponent: {
        terms: [{
          exponent: { terms: [], constant: D(2) },
          coefficient: D(1)
        }],
        constant: D(tail)
      },
      coefficient: D(1)
    }],
    constant: D(0)
  }
}

function getTheoremCostNatural(theoremId: string): Decimal {
  return ordinalToNatural(getTheoremCostAsOrdinal(theoremId))
}

function getTheoremCostOrdinal(theoremId: string): string {
  return renderOrdinalToKaTeX(getTheoremCostAsOrdinal(theoremId), 8)
}

function canBuyTheorem(theoremId: string): boolean {
  if (isTheoremMaxed(theoremId)) return false
  const costNatural = ordinalToNatural(getTheoremCostAsOrdinal(theoremId))
  const currentTermsNatural = getTermsNatural(state.ordinalValue.value)
  return currentTermsNatural.gte(costNatural)
}

function buyTheorem(theoremId: string): boolean {
  if (!canBuyTheorem(theoremId)) return false

  const costOrdinal = getTheoremCostAsOrdinal(theoremId)
  const costNatural = ordinalToNatural(costOrdinal)
  const currentTermsNatural = getTermsNatural(state.ordinalValue.value)
  const nextTermsNatural = currentTermsNatural.sub(costNatural).floor()
  if (nextTermsNatural.gte(currentTermsNatural)) return false

  // 优先使用序数借位减法；如果借位失败（指数结构不匹配），回退到自然数减法
  const subtracted = subtractOrdinal(state.ordinalValue.value, costOrdinal)
  const subtractedTermsNatural = getTermsNatural(subtracted)
  if (subtractedTermsNatural.lt(currentTermsNatural)) {
    setOrdinalAndCount(subtracted, ordinalToNatural(subtracted))
  } else {
    // 回退：只重构 terms 部分，保留原有常数项
    const newTerms = ordinalFromNatural(nextTermsNatural)
    const newOrdinal = {
      terms: newTerms.terms,
      constant: state.ordinalValue.value.constant
    }
    setOrdinalAndCount(newOrdinal, ordinalToNatural(newOrdinal))
  }

  ensureTheoremState(theoremId).level++
  touchCollection()
  startAutoTick()
  save()
  return true
}

function getTheoremLevel(theoremId: string): number {
  return state.theorems[theoremId]?.level || 0
}

function getTheoremMaxLevel(theoremId: string): number {
  return THEOREM_UPGRADES.find((item) => item.id === theoremId)?.maxLevel || 1
}

function isTheoremMaxed(theoremId: string): boolean {
  return getTheoremLevel(theoremId) >= getTheoremMaxLevel(theoremId)
}

function getInitialSegmentMultiplier(): Decimal {
  const level = getTheoremLevel('initial_segment')
  if (level <= 0) return D(1)
  // 使用 Decimal.pow 避免重复 sqrt 乘法造成的精度丢失
  // √(level+1)^stageLevel = (level+1)^(stageLevel/2)
  return D(level + 1).pow(ordinalStageLevel.value / 2)
}

function getCofinalSpeedMultiplier(): Decimal {
  return D(1).add(getTheoremLevel('cofinal'))
}

function getSuccessorLimitBoostBase(): Decimal {
  return D(state.base).add(D(getTheoremLevel('cardinal')).mul(0.1))
}

function getCardinalSuccessorLimitMultiplier(): Decimal {
  const boost = getUpgradeEffectBoost('successor_set')
  if (boost <= 0) return D(1)
  const ratio = getSuccessorLimitBoostBase().div(state.base)
  return multiplyIntegerTimes(ratio, boost)
}

function getTheoremEffectDesc(theoremId: string): string {
  if (theoremId === 'cofinal') {
    return `×${formatDecimal(getCofinalSpeedMultiplier())}`
  }
  if (theoremId === 'initial_segment') {
    return `×${formatDecimal(getInitialSegmentMultiplier())}（阶段Lv.${ordinalStageLevel.value}）`
  }
  if (theoremId === 'cardinal') {
    return `×${formatDecimal(getCardinalSuccessorLimitMultiplier())}`
  }
  if (theoremId === 'unbounded') {
    return `×${formatDecimal(getUnboundedMultiplier())}`
  }
  return ''
}

function multiplyIntegerTimes(base: Decimal, times: number): Decimal {
  const count = Math.max(0, Math.floor(times))
  let result = D(1)
  for (let i = 0; i < count; i++) {
    result = result.mul(base)
  }
  return result
}

// 自动tick（每秒执行 3^{level-1} 次，level=0 时每秒 0 次）
function startAutoTick() {
  stopAutoTick()

  if (
    getUpgradeEffectValue('successor_set').lte(0)
    && getUpgradeEffectValue('limit_set').lte(0)
    && !limitCooldownActive.value
  ) {
    return
  }

  let lastTick = Date.now()
  let lastAutoSave = Date.now()
  let successorRemainder = D(0)

  state.successorTimer = setInterval(() => {
    if (ordinalCapReached.value) {
      stopAutoTick()
      return
    }

    const now = Date.now()
    const elapsed = Math.max(0, now - lastTick)
    lastTick = now

    if (state.limitCooldownRemainingMs.value > 0) {
      state.limitCooldownRemainingMs.value = Math.max(0, state.limitCooldownRemainingMs.value - elapsed)
      // 冷却结束，执行极限操作
      if (state.limitCooldownRemainingMs.value <= 0) {
        onLimitCooldownComplete()
      }
    }

    const successorFreq = getUpgradeEffectValue('successor_set')
    if (!ordinalCapReached.value && successorFreq.gt(0)) {
      const budget = successorRemainder.add(successorFreq.mul(elapsed).div(1000))
      const steps = budget.floor()
      successorRemainder = budget.sub(steps)

      if (steps.gt(0)) {
        addSuccessorSteps(steps)
      }
    }

    // limit_set 不再自动增加 n，n 由购买次数和极限次数静态决定

    if (
      state.limitCooldownRemainingMs.value <= 0
      && getUpgradeEffectValue('successor_set').lte(0)
      && getUpgradeEffectValue('limit_set').lte(0)
    ) {
      stopAutoTick()
      return
    }

    const autoSaveIntervalMs = sanitizeAutoSaveInterval(state.autoSaveIntervalSeconds.value) * 1000
    if (now - lastAutoSave > autoSaveIntervalMs) {
      save()
      lastAutoSave = now
    }
  }, state.tickIntervalMs.value)
}

function addSuccessorSteps(steps: number | Decimal) {
  if (ordinalCapReached.value) return
  const amount = D(steps)
  state.finiteCount.value = state.finiteCount.value.add(amount)
}

function stopAutoTick() {
  if (state.successorTimer) {
    clearInterval(state.successorTimer)
    state.successorTimer = null
  }
  if (state.limitTimer) {
    clearInterval(state.limitTimer)
    state.limitTimer = null
  }
}

// ========== 导出所有状态和方法 ==========
export function useGameStore() {
  return {
    ordinalValue: state.ordinalValue,
    count: state.count,
    finiteCount: state.finiteCount,
    base: state.base,
    maxTerms: state.maxTerms,
    autoSaveIntervalSeconds: state.autoSaveIntervalSeconds,
    tickIntervalMs: state.tickIntervalMs,
    katexReady: state.katexReady,
    isTransitioning: state.isTransitioning,
    successorPulse: state.successorPulse,
    limitPulse: state.limitPulse,
    limitCooldownRemainingMs: state.limitCooldownRemainingMs,
    limitCooldownTotalMs: state.limitCooldownTotalMs,
    limitCooldownActive,
    limitCooldownProgress,
    limitCooldownSecondsLeft,
    limitCooldownDuration,
    limitCooldownDivisor,
    limitSetN: state.limitSetN,
    lastSave: state.lastSave,
    collectionVersion: state.collectionVersion,
    collection: state.collection,
    theorems: state.theorems,
    ordinal,
    termCount,
    displayCount,
    finitePart,
    ordinalCapReached,
    ordinalStageLevel,
    limitAvailable,
    ordinalToNatural,
    ordinalFromNatural,
    successor: successorAction,
    limit: limitAction,
    reset,
    save,
    load,
    exportBase64,
    importBase64,
    setAutoSaveIntervalSeconds,
    setTickIntervalMs,
    init,
    completeTransition,
    // 集合升级
    buyUpgrade,
    getUpgradeLevel,
    getUpgradeCostNatural,
    getUpgradeCostOrdinal,
    getUpgradeCostAsOrdinal,
    getUpgradeLevelOrdinal,
    getUpgradeLevelDisplayOrdinal,
    getUpgradeLevelLabel,
    getUpgradeEffectBoost,
    getUpgradeEffectValue,
    getLimitSetN,
    getLimitCooldownDivisor,
    canLimitUpgradeLevel,
    limitUpgradeLevel,
    canBuyUpgrade,
    COLLECTION_UPGRADES,
    buyTheorem,
    getTheoremLevel,
    getTheoremMaxLevel,
    isTheoremMaxed,
    getTheoremCostNatural,
    getTheoremCostOrdinal,
    getTheoremEffectDesc,
    canBuyTheorem,
    getInitialSegmentMultiplier,
    getCardinalSuccessorLimitMultiplier,
    THEOREM_UPGRADES,
  }
}
