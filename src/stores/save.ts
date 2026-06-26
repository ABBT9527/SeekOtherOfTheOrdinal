import Decimal from 'break_eternity.js'
import { type OrdinalValue } from '../utils/ordinal'

// ========== 存储版本控制 ==========
const SAVE_VERSION = 3
const SAVE_KEY = '__ORDINAL_GAME_SAVE__'

// ========== 资源与升级类型定义 ==========
export interface DecimalValue {
  value: string  // Decimal 序列化为字符串
}

export interface UpgradeState {
  level: number
  unlocked: boolean
  levelOrdinal?: OrdinalSave
  effectBoosts?: number
}

// 集合升级类型
export interface CollectionUpgrade {
  id: 'successor_set' | 'limit_set'
  name: string
  icon: string
  description: string
  baseCost: string  // 成本（序数表示）
  costGrowth: string  // 成本增长倍率
  effect: string  // 效果描述
}

export interface TheoremUpgrade {
  id: string
  name: string
  icon: string
  description: string
  baseCost: string
  costGrowth: string
  effect: string
  maxLevel: number
}

export interface CollectionState {
  upgrades: Record<string, UpgradeState>
}

export interface TheoremState {
  upgrades: Record<string, UpgradeState>
}

// 集合升级定义
export const COLLECTION_UPGRADES: CollectionUpgrade[] = [
  {
    id: 'successor_set',
    name: '后继集',
    icon: 'n=S(n)',
    description: '自动执行后继',
    baseCost: 'ω',  // ω
    costGrowth: 'ω',  // ω 倍增长
    effect: '每秒自动 +1'
  },
  {
    id: 'limit_set',
    name: '极限集',
    icon: 'n→ω',
    description: '自动执行极限',
    baseCost: 'ω',  // ω
    costGrowth: 'ω^ω',  // ω^ω 倍增长
    effect: '当可执行时自动极限'
  }
]

export const THEOREM_UPGRADES: TheoremUpgrade[] = [
  {
    id: 'cofinal',
    name: '共尾',
    icon: 'cf',
    description: '加成后继速度：1+level',
    baseCost: 'ω^ω',
    costGrowth: 'ω',
    effect: '后继速度 ×(1+level)',
    maxLevel: 20
  },
  {
    id: 'cardinal',
    name: '基数',
    icon: 'κ',
    description: '每级使后继的极限倍增乘数 +0.1',
    baseCost: 'ω^(ω2)',
    costGrowth: 'ω',
    effect: '每级使后继极限倍增乘数 +0.1',
    maxLevel: 5
  },
  {
    id: 'initial_segment',
    name: '初段',
    icon: 'I',
    description: '将后继速度乘以√(level+1)^阶段等级',
    baseCost: 'ω^(ω^2+2)',
    costGrowth: 'ω',
    effect: '后继速度 ×√(level+1)^阶段等级',
    maxLevel: 2
  },
  {
    id: 'unbounded',
    name: '无界',
    icon: '∞',
    description: '每个后继集加成后继+×0.03',
    baseCost: 'ω^(ω^2+ω+2)',
    costGrowth: '9',
    effect: '×(1+0.03×无界Lv)^后继级Lv',
    maxLevel: 5
  }
]

export interface AchievementState {
  id: string
  unlockedAt?: number  // 时间戳
}

export interface ResourceState {
  current: string  // Decimal 字符串
  total?: string  // Decimal 字符串，总获取量
}

// ========== 可拓展的存储结构 ==========
export interface SaveData {
  version: number
  timestamp: number
  meta: {
    settings: UserSettings
    upgrades: Record<string, UpgradeState>
    achievements: AchievementState[]
    resources: Record<string, ResourceState>
    collection: CollectionState
    theorems?: TheoremState
  }
  core: {
    count: string
    ordinal: OrdinalSave
    finiteCount: string
  }
}

export interface OrdinalSave {
  terms: OrdinalTermSave[]
  constant: string
}

export interface OrdinalTermSave {
  exponent: OrdinalSave | number  // 递归结构或有限数值
  coefficient: string
}

export interface UserSettings {
  maxTerms: number
  autoSaveIntervalSeconds: number
  tickIntervalMs: number
  // 预留更多设置项
  [key: string]: any
}

// ========== Decimal 序列化工具 ==========
export function serializeDecimal(d: Decimal): string {
  return d.toString()
}

export function deserializeDecimal(s: string): Decimal {
  return new Decimal(s)
}

// ========== Ordinal 序列化 ==========
export function serializeOrdinal(ordinal: OrdinalValue): OrdinalSave {
  return {
    terms: ordinal.terms.map(term => ({
      exponent: serializeOrdinalRecursive(term.exponent),
      coefficient: serializeDecimal(term.coefficient)
    })),
    constant: serializeDecimal(ordinal.constant)
  }
}

function serializeOrdinalRecursive(ordinal: OrdinalValue): OrdinalSave | number {
  // 如果是有限序数（无项且常数为有限值），直接返回数值
  if (ordinal.terms.length === 0) {
    return ordinal.constant.toNumber()
  }
  // 否则返回完整结构
  return {
    terms: ordinal.terms.map(term => ({
      exponent: serializeOrdinalRecursive(term.exponent),
      coefficient: serializeDecimal(term.coefficient)
    })),
    constant: serializeDecimal(ordinal.constant)
  }
}

export function deserializeOrdinal(save: OrdinalSave): OrdinalValue {
  return {
    terms: save.terms.map(term => ({
      exponent: deserializeOrdinalRecursive(term.exponent),
      coefficient: deserializeDecimal(term.coefficient)
    })),
    constant: deserializeDecimal(save.constant)
  }
}

function deserializeOrdinalRecursive(data: OrdinalSave | number): OrdinalValue {
  if (typeof data === 'number') {
    return {
      terms: [],
      constant: new Decimal(data)
    }
  }
  return {
    terms: data.terms.map(term => ({
      exponent: deserializeOrdinalRecursive(term.exponent),
      coefficient: deserializeDecimal(term.coefficient)
    })),
    constant: deserializeDecimal(data.constant)
  }
}

// ========== 默认存档 ==========
export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    meta: {
      settings: {
        maxTerms: 12,
        autoSaveIntervalSeconds: 60,
        tickIntervalMs: 50
      },
      upgrades: {},
      achievements: [],
      resources: {},
      collection: {
        upgrades: {}
      },
      theorems: {
        upgrades: {}
      }
    },
    core: {
      count: '0',
      ordinal: {
        terms: [],
        constant: '0'
      },
      finiteCount: '0'
    }
  }
}

// ========== 存档操作 ==========
export function saveGame(data: SaveData): void {
  try {
    data.timestamp = Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save game:', e)
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SaveData
  } catch (e) {
    console.error('Failed to load game:', e)
    return null
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (e) {
    console.error('Failed to delete save:', e)
  }
}

export function exportSaveToBase64(): string {
  const data = loadGame() || createDefaultSave()
  const json = JSON.stringify(data)
  return btoa(unescape(encodeURIComponent(json)))
}

export function importSaveFromBase64(base64: string): SaveData {
  const json = decodeURIComponent(escape(atob(base64.trim())))
  const parsed = JSON.parse(json) as SaveData
  const migrated = migrateSaveIfNeeded(parsed)
  saveGame(migrated)
  return migrated
}

// ========== 存档迁移（未来版本升级用） ==========
export function migrateSaveIfNeeded(save: SaveData): SaveData {
  if (save.version === SAVE_VERSION) {
    return save
  }

  // 从旧版本迁移
  while (save.version < SAVE_VERSION) {
    save = migrateStep(save)
    save.version++
  }

  return save
}

function migrateStep(save: SaveData): SaveData {
  if (save.version === 1) {
    save.meta.theorems = {
      upgrades: {}
    }
  }
  if (save.version === 2) {
    save.meta.settings.autoSaveIntervalSeconds = 5
  }
  if (!save.meta.settings.tickIntervalMs || save.meta.settings.tickIntervalMs < 20) {
    save.meta.settings.tickIntervalMs = 50
  }
  return save
}
