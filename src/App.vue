<template>
  <div class="game-container">
    <!-- 几何装饰背景 -->
    <div class="geo-bg">
      <div class="geo-circle"></div>
      <div class="geo-triangle"></div>
      <div class="geo-line"></div>
      <div class="geo-grid"></div>
    </div>

    <header class="top-ordinal-bar">
      <OrdinalDisplay
        :ordinal="game.ordinal.value"
        :count="game.displayCount.value"
        :max-terms="game.maxTerms.value"
        :is-transitioning="game.isTransitioning.value"
        @transition-complete="game.completeTransition"
      />
    </header>

    <main class="cards-stack">
      <!-- 功能大卡片 -->
      <section class="game-card hub-card" :data-version="game.collectionVersion.value">
        <div class="card-header">
          <div class="geo-accent"></div>
          <h2 class="game-title">
            <span class="title-icon">◇</span>
            {{ activePanelTitle }}
          </h2>
        </div>

        <div v-if="activePanel === 'ordinal'" class="ordinal-panel">
          <div class="ordinal-readout">
            <div class="readout-row">
              <span class="readout-label">当前序数</span>
              <span class="readout-value katex-inline">{{ plainOrdinal }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">后继计数</span>
              <span class="readout-value">{{ game.displayCount.value }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">常数项</span>
              <span class="readout-value">{{ game.finitePart.value }}</span>
            </div>
          </div>
          <div class="action-grid ordinal-actions">
            <button
              class="btn btn-primary"
              @click="game.successor()"
              :disabled="game.ordinalCapReached.value"
              :class="{ 'btn-pulse': game.successorPulse.value }"
            >
              <span class="btn-icon">＋</span>
              后继
            </button>
            <button
              class="btn btn-secondary btn-limit-action"
              @click="onLimitClick"
              :disabled="!game.limitAvailable.value"
              :class="{
                'btn-pulse': game.limitPulse.value,
                'cooling': game.limitCooldownActive.value,
                'cooldown-ending': limitCooldownEnding
              }"
            >
              <Transition
                name="limit-cooldown"
                @leave="(el: Element, done: () => void) => { limitCooldownEnding = true; done() }"
                @after-leave="limitCooldownEnding = false"
              >
                <span
                  v-if="game.limitCooldownActive.value"
                  class="limit-button-fill"
                  :style="{ width: `${game.limitCooldownProgress.value}%` }"
                ></span>
              </Transition>
              <Transition name="limit-click">
                <span
                  v-if="limitClickAnimating"
                  class="limit-click-fill"
                ></span>
              </Transition>
              <span class="btn-content">
                <span class="btn-icon">↗</span>
                <span>{{ game.limitCooldownActive.value ? `${game.limitCooldownSecondsLeft.value}s` : '极限' }}</span>
              </span>
            </button>
          </div>
        </div>

        <div v-else-if="activePanel === 'collection'" class="collection-grid">
          <div
            v-for="upgrade in game.COLLECTION_UPGRADES"
            :key="upgrade.id"
            class="collection-item"
            :class="{
              'can-afford': game.canBuyUpgrade(upgrade.id),
              'owned': game.getUpgradeLevel(upgrade.id) > 0
            }"
          >
            <div class="item-header">
              <span class="item-name">{{ upgrade.name }}</span>
              <span class="item-icon">{{ upgrade.icon }}</span>
            </div>
            <Transition name="level-panel" appear>
              <div
                class="item-level-panel"
                :class="getLevelPanelClass(upgrade.id)"
                v-if="game.getUpgradeLevel(upgrade.id) > 0"
              >
                <div class="level-frame-line"></div>
                <span class="level-raw">
                  <OrdinalCost :ordinal="game.getUpgradeLevelDisplayOrdinal(upgrade.id)" />
                </span>
                <Transition name="boost-panel">
                  <span class="level-boost" v-if="game.getUpgradeEffectBoost(upgrade.id) > 0">
                    极限倍率 ×{{ formatBoost(upgrade.id) }}
                  </span>
                </Transition>
              </div>
            </Transition>
            <p class="item-desc">{{ getUpgradeEffectDesc(upgrade.id) }}</p>
            <div class="item-footer">
              <span class="cost-ordinal">序数: <OrdinalCost :ordinal="game.getUpgradeCostOrdinal(upgrade.id)" /></span>
              <button
                class="btn btn-sm"
                @click="game.buyUpgrade(upgrade.id)"
                :disabled="!game.canBuyUpgrade(upgrade.id)"
              >
                后继
              </button>
              <span class="cost-natural">{{ formatCostNaturalPrefix(upgrade.id) }} {{ formatCostNatural(upgrade.id) }}</span>
              <button
                class="btn btn-sm btn-limit-level"
                @click="game.limitUpgradeLevel(upgrade.id)"
                :disabled="!game.canLimitUpgradeLevel(upgrade.id)"
              >
                极限
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="activePanel === 'theorem'" class="theorem-panel">
          <div class="theorem-upgrades">
            <button
              v-for="theorem in game.THEOREM_UPGRADES"
              :key="theorem.id"
              type="button"
              class="theorem-upgrade-card"
              :class="{
                'can-afford': game.canBuyTheorem(theorem.id),
                'owned': game.getTheoremLevel(theorem.id) > 0,
                'unavailable': !game.canBuyTheorem(theorem.id) && game.getTheoremLevel(theorem.id) === 0,
                'active': selectedTheoremId === theorem.id
              }"
              @mouseenter="selectedTheoremId = theorem.id"
              @focus="selectedTheoremId = theorem.id"
              @click="selectAndBuyTheorem(theorem.id)"
              :aria-disabled="!game.canBuyTheorem(theorem.id)"
            >
              <span class="item-name">{{ theorem.name }}</span>
              <span class="item-icon">{{ theorem.icon }}</span>
            </button>
          </div>

          <div class="theorem-detail" v-if="selectedTheorem">
            <div class="theorem-detail-row">
              <b>名称</b>
              <span>
                {{ selectedTheorem.name }}
                <small>
                  Lv.{{ game.getTheoremLevel(selectedTheorem.id) }}/{{ game.getTheoremMaxLevel(selectedTheorem.id) }}
                </small>
              </span>
            </div>
            <div class="theorem-detail-row">
              <b>价格</b>
              <span class="theorem-price">
                <template v-if="game.isTheoremMaxed(selectedTheorem.id)">证毕</template>
                <template v-else>
                  <OrdinalCost :ordinal="game.getTheoremCostOrdinal(selectedTheorem.id)" />
                  <small>({{ theoremCostPrefix(selectedTheorem.id) }} {{ theoremCostNatural(selectedTheorem.id) }})</small>
                </template>
              </span>
            </div>
            <div class="theorem-detail-row">
              <b>描述</b>
              <span v-html="renderTheoremDesc(selectedTheorem.id)"></span>
            </div>
            <div class="theorem-detail-row">
              <b>效果</b>
              <span v-html="renderTheoremEffect(selectedTheorem.id)"></span>
            </div>
          </div>
        </div>

        <div v-else class="settings-panel-grid">
          <div class="settings-control">
            <label class="settings-label" for="maxTerms">最大项数</label>
            <div class="input-group">
              <button class="btn-num" @click="game.maxTerms.value = Math.max(1, game.maxTerms.value - 1)">−</button>
              <input
                id="maxTerms"
                type="number"
                v-model.number="game.maxTerms.value"
                min="1"
                max="50"
              />
              <button class="btn-num" @click="game.maxTerms.value = Math.min(50, game.maxTerms.value + 1)">+</button>
            </div>
          </div>

          <div class="settings-control">
            <label class="settings-label" for="autoSaveSeconds">自动保存间隔（秒）</label>
            <div class="input-group">
              <button class="btn-num" @click="game.autoSaveIntervalSeconds.value = Math.max(1, game.autoSaveIntervalSeconds.value - 10)">−</button>
              <input
                id="autoSaveSeconds"
                type="number"
                min="1"
                v-model.number="game.autoSaveIntervalSeconds.value"
                @change="game.setAutoSaveIntervalSeconds(game.autoSaveIntervalSeconds.value)"
              />
              <button class="btn-num" @click="game.autoSaveIntervalSeconds.value = Math.min(3600, game.autoSaveIntervalSeconds.value + 10)">+</button>
            </div>
          </div>

          <div class="settings-control">
            <label class="settings-label" for="tickInterval">刷新间隔（ms）</label>
            <div class="input-group">
              <button class="btn-num" @click="game.tickIntervalMs.value = Math.max(20, game.tickIntervalMs.value - 10)">−</button>
              <input
                id="tickInterval"
                type="number"
                v-model.number="game.tickIntervalMs.value"
                @change="game.setTickIntervalMs(game.tickIntervalMs.value)"
              />
              <button class="btn-num" @click="game.tickIntervalMs.value = Math.min(500, game.tickIntervalMs.value + 10)">+</button>
            </div>
          </div>

          <div class="settings-save-actions">
            <button class="btn btn-secondary" @click="manualSave">手动保存</button>
            <button class="btn btn-secondary" @click="manualLoad">加载</button>
            <button class="btn btn-secondary" @click="exportToClipboard">导出到粘贴板</button>
            <button class="btn btn-secondary" @click="exportToFile">导出到文件</button>
            <button class="btn btn-secondary" @click="importFromText">从文本导入</button>
            <button class="btn btn-secondary" @click="triggerImportFile">从文件导入</button>
          </div>

          <textarea
            v-model="importTextValue"
            class="settings-import-text"
            placeholder="在这里粘贴 Base64 存档文本"
          ></textarea>

          <input
            ref="importFileInput"
            class="hidden-file-input"
            type="file"
            accept=".txt,text/plain"
            @change="handleImportFile"
          />

          <div v-if="settingsMessage" class="settings-message">{{ settingsMessage }}</div>

          <div class="settings-danger-actions">
            <button
              class="btn btn-danger settings-reset"
              @click="handleResetClick"
            >
              <span class="btn-icon">↺</span>
              {{ resetConfirming ? '再次点击以确认' : '硬重置' }}
            </button>
          </div>
        </div>

        <div v-if="activePanel === 'settings'" class="debug-bar">
          <span class="debug-item">
            <span class="debug-label">当前项数</span>
            <strong>{{ game.termCount.value }}</strong>
          </span>
        </div>

      </section>
    </main>

    <footer class="bottom-dock" :class="{ 'card-glow': game.isTransitioning.value }">
      <button
        v-for="panel in panels"
        :key="panel.id"
        type="button"
        class="dock-card"
        :class="{ active: activePanel === panel.id }"
        @click="activePanel = panel.id"
      >
        <span class="dock-card-title">{{ panel.label }}</span>
      </button>
    </footer>

    <div class="geo-fg">
      <div class="geo-dot" v-for="n in 12" :key="n" :style="getDotStyle(n)"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Decimal from 'break_eternity.js'
import { useGameStore } from './stores/game'
import { formatDecimal } from './utils/ordinal'
import OrdinalDisplay from './components/OrdinalDisplay.vue'
import OrdinalCost from './components/OrdinalCost.vue'

const game = useGameStore()
const importTextValue = ref('')
const settingsMessage = ref('')
const importFileInput = ref<HTMLInputElement | null>(null)
const limitCooldownEnding = ref(false)
const limitClickAnimating = ref(false)
const resetConfirming = ref(false)
let resetConfirmTimer: ReturnType<typeof setTimeout> | null = null
const panels = [
  { id: 'ordinal', label: '序数', title: '序数', desc: '当前值与手动操作' },
  { id: 'collection', label: '集合', title: '集合', desc: '自动化升级' },
  { id: 'theorem', label: '定理', title: '定理', desc: '证明与阶段加成' },
  { id: 'settings', label: '设置', title: '设置', desc: '显示与调试选项' }
] as const
const activePanel = ref<(typeof panels)[number]['id']>('ordinal')
const selectedTheoremId = ref<(typeof game.THEOREM_UPGRADES)[number]['id']>(game.THEOREM_UPGRADES[0]?.id || 'cofinal')
const activePanelTitle = computed(() => panels.find((panel) => panel.id === activePanel.value)?.title || '集合')
const selectedTheorem = computed(() => game.THEOREM_UPGRADES.find((theorem) => theorem.id === selectedTheoremId.value) || game.THEOREM_UPGRADES[0])

const plainOrdinal = computed(() => {
  return game.ordinal.value
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replaceAll('\\omega', 'ω')
    .replaceAll('\\cdots', '⋯')
})

function formatCostNatural(upgradeId: string): string {
  const cost = game.getUpgradeCostNatural(upgradeId)
  if (cost.eq(Infinity)) return '∞'
  return formatDecimal(cost)
}

function formatCostNaturalPrefix(upgradeId: string): string {
  const value = formatCostNatural(upgradeId)
  return value.includes('e') || value === '∞' ? '≈' : '='
}

function theoremCostNatural(theoremId: string): string {
  const cost = game.getTheoremCostNatural(theoremId)
  if (cost.eq(Infinity)) return '∞'
  return formatDecimal(cost)
}

function theoremCostPrefix(theoremId: string): string {
  const value = theoremCostNatural(theoremId)
  return value.includes('e') || value === '∞' ? '≈' : '='
}

function getUpgradeEffectDesc(upgradeId: string): string {
  const speed = formatSpeed(game.getUpgradeEffectValue(upgradeId))

  if (upgradeId === 'successor_set') {
    const cardinalMult = game.getCardinalSuccessorLimitMultiplier()
    if (cardinalMult.gt(1)) {
      return `后继 ${speed} 次/秒（基数×${formatDecimal(cardinalMult)}）`
    }
    return `后继 ${speed} 次/秒`
  } else if (upgradeId === 'limit_set') {
    return `冷却 ${game.limitCooldownDuration.value} 秒（9/${game.limitCooldownDivisor.value}），n=${formatSpeed(game.getLimitSetN())}`
  }
  return ''
}

function formatSpeed(freq: Decimal): string {
  return formatDecimal(freq)
}

function renderTheoremDesc(theoremId: string): string {
  const theorem = game.THEOREM_UPGRADES.find((t) => t.id === theoremId)
  if (!theorem) return ''
  return theorem.description
}

function renderTheoremEffect(theoremId: string): string {
  return game.getTheoremEffectDesc(theoremId)
}

function formatBoost(upgradeId: string): string {
  const boost = game.getUpgradeEffectBoost(upgradeId)
  if (boost <= 0) return '1'
  // 使用连乘避免精度丢失
  let result = 1
  for (let i = 0; i < boost; i++) result *= game.base
  return formatSpeed(new Decimal(result))
}

function onLimitClick() {
  limitClickAnimating.value = true
  setTimeout(() => {
    limitClickAnimating.value = false
  }, 500)
  game.limit()
}

function selectAndBuyTheorem(theoremId: (typeof game.THEOREM_UPGRADES)[number]['id']) {
  selectedTheoremId.value = theoremId
  game.buyTheorem(theoremId)
}

function setSettingsMessage(message: string) {
  settingsMessage.value = message
  window.setTimeout(() => {
    if (settingsMessage.value === message) {
      settingsMessage.value = ''
    }
  }, 3000)
}

function handleResetClick() {
  if (resetConfirming.value) {
    game.reset()
    resetConfirming.value = false
    if (resetConfirmTimer) {
      clearTimeout(resetConfirmTimer)
      resetConfirmTimer = null
    }
    setSettingsMessage('已硬重置')
  } else {
    resetConfirming.value = true
    if (resetConfirmTimer) clearTimeout(resetConfirmTimer)
    resetConfirmTimer = window.setTimeout(() => {
      resetConfirming.value = false
    }, 3000)
  }
}

function manualSave() {
  game.save()
  setSettingsMessage('已手动保存')
}

function manualLoad() {
  const loaded = game.load()
  setSettingsMessage(loaded ? '已加载本地存档' : '没有找到本地存档')
}

async function exportToClipboard() {
  const base64 = game.exportBase64()
  try {
    await navigator.clipboard.writeText(base64)
    setSettingsMessage('Base64 存档已复制到粘贴板')
  } catch {
    importTextValue.value = base64
    setSettingsMessage('无法访问粘贴板，已放入文本框')
  }
}

function exportToFile() {
  const base64 = game.exportBase64()
  const blob = new Blob([base64], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${getExportFileBaseName()}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
  setSettingsMessage('Base64 存档文件已导出')
}

function importFromText() {
  if (!importTextValue.value.trim()) {
    setSettingsMessage('请先粘贴 Base64 存档文本')
    return
  }

  try {
    game.importBase64(importTextValue.value)
    setSettingsMessage('已从文本导入存档')
  } catch {
    setSettingsMessage('导入失败：文本不是有效的 Base64 存档')
  }
}

function triggerImportFile() {
  importFileInput.value?.click()
}

function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      game.importBase64(String(reader.result || ''))
      setSettingsMessage('已从文件导入存档')
    } catch {
      setSettingsMessage('导入失败：文件内容不是有效的 Base64 存档')
    } finally {
      input.value = ''
    }
  }
  reader.readAsText(file, 'utf-8')
}

function getExportFileBaseName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = padTimePart(now.getMonth() + 1)
  const day = padTimePart(now.getDate())
  const hour = padTimePart(now.getHours())
  const minute = padTimePart(now.getMinutes())
  return `seek the order of number_${year}_${month}_${day}_${hour}_${minute}`
}

function padTimePart(value: number): string {
  return String(value).padStart(2, '0')
}

function getLevelPanelClass(upgradeId: string) {
  const ordinal = game.getUpgradeLevelOrdinal(upgradeId)
  return {
    'level-panel-tall': ordinal.includes('\\omega^'),
    'level-panel-boosted': game.getUpgradeEffectBoost(upgradeId) > 0
  }
}

function getDotStyle(n: number) {
  const angle = (n / 12) * Math.PI * 2
  const radius = 140 + Math.sin(n * 1.5) * 40
  const x = 50 + Math.cos(angle) * radius * 0.3
  const y = 50 + Math.sin(angle) * radius * 0.15
  const size = 3 + Math.sin(n * 2) * 2
  const delay = n * 0.3
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`
  }
}

onMounted(() => {
  game.init()
  // 尝试加载存档
  game.load()
})
</script>
