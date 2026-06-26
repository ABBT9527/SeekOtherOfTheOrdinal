<template>
  <div
    class="ordinal-container"
    :class="{
      'transitioning': isTransitioning,
      'tier-1': currentTier === 1,
      'tier-2': currentTier === 2,
      'tier-3': currentTier === 3,
      'tier-4': currentTier === 4,
      'tier-5': currentTier >= 5
    }"
  >
    <div class="ordinal-wrapper">
      <div class="ordinal-label">H</div>
      <div class="ordinal-sub">{{ subscript }}</div>
      <div ref="katexEl" class="katex-render"></div>
    </div>
    <div class="count-under">
      count: {{ count }}
    </div>

    <!-- 过渡动画层 -->
    <Transition name="ordinal-flash">
      <div v-if="isTransitioning" class="transition-overlay">
        <div class="transition-ring"></div>
        <div class="transition-ring ring-2"></div>
        <div class="transition-text">
          {{ tierName }}
        </div>
      </div>
    </Transition>

    <!-- 几何装饰 -->
    <div class="ordinal-geo">
      <div class="geo-bracket left"></div>
      <div class="geo-bracket right"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { getOrdinalTierName } from '../utils/ordinal'

interface Props {
  ordinal: string
  count: string
  maxTerms: number
  isTransitioning: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  transitionComplete: []
}>()

const katexEl = ref<HTMLElement | null>(null)
const currentTier = ref(0)
const tierName = computed(() => getOrdinalTierName(currentTier.value))

// 从 ordinal 字符串中提取序数部分用于计算层级
const subscript = computed(() => {
  // 这里我们根据 ordinal 的内容推断层级
  if (props.ordinal.includes('\\omega^{\\omega^{\\omega')) return 'ω^ω^ω'
  if (props.ordinal.includes('\\omega^{\\omega^{')) return 'ω^ω^n'
  if (props.ordinal.includes('\\omega^{\\omega')) return 'ω^ω'
  if (props.ordinal.includes('\\omega^')) return 'ω^n'
  if (props.ordinal.includes('\\omega')) return 'ω'
  return ''
})

// 监听 ordinal 变化，更新 KaTeX 渲染
watch(() => props.ordinal, async (newOrdinal) => {
  await nextTick()
  renderKatex(newOrdinal)

  // 更新层级
  // 从渲染内容推断层级（简化版）
  if (newOrdinal.includes('\\omega^{\\omega^{\\omega')) currentTier.value = 5
  else if (newOrdinal.includes('\\omega^{\\omega^{')) currentTier.value = 4
  else if (newOrdinal.includes('\\omega^{\\omega')) currentTier.value = 3
  else if (newOrdinal.includes('\\omega^')) currentTier.value = 3
  else if (newOrdinal.includes('\\omega')) currentTier.value = 1
  else currentTier.value = 0
}, { immediate: true })

// 监听过渡动画结束
watch(() => props.isTransitioning, (val) => {
  if (!val) {
    emit('transitionComplete')
  }
})

function renderKatex(latex: string) {
  if (!katexEl.value || typeof window.katex === 'undefined') return

  try {
    const fullLatex = `H_{${latex}}`
    window.katex.render(fullLatex, katexEl.value, {
      throwOnError: false,
      displayMode: false,
      trust: true
    })
  } catch (err) {
    console.error('KaTeX render error:', err)
    if (katexEl.value) {
      katexEl.value.innerHTML = `<span class="fallback">${latex}</span>`
    }
  }
}
</script>

<style scoped>
.ordinal-container {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding: 12px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 38px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.25;
  max-width: 100%;
  overflow: visible;
  white-space: nowrap;
  pointer-events: none;
  background: rgba(250, 251, 252, 0.94);
  border: 1px solid rgba(226, 228, 232, 0.95);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.ordinal-wrapper {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  max-width: 100%;
  overflow: hidden;
  position: relative;
  z-index: 2;
}

.count-under {
  margin-top: 2px;
  padding-left: 0;
  font-size: 13px;
  font-weight: 600;
  color: #5a5e66;
  letter-spacing: 0.2px;
  text-align: left;
  position: relative;
  z-index: 2;
}

.ordinal-label {
  font-size: 0.7em;
  font-weight: 700;
  color: #5a5e66;
  margin-right: 4px;
}

.ordinal-sub {
  font-size: 0.5em;
  color: #9a9ea6;
  vertical-align: sub;
  margin-right: 2px;
}

.katex-render {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.katex-render :deep(.katex) {
  font-size: 1em;
  font-style: normal !important;
}

.katex-render :deep(.katex *),
.katex-render :deep(.katex .mord),
.katex-render :deep(.katex .mbin),
.katex-render :deep(.katex .mrel),
.katex-render :deep(.katex .mopen),
.katex-render :deep(.katex .mclose) {
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 600 !important;
  font-style: normal !important;
}

/* 层级颜色变化 */
.tier-1 { color: #2c5282; }
.tier-2 { color: #276749; }
.tier-3 { color: #744210; }
.tier-4 { color: #742a2a; }
.tier-5 { color: #4a1d5f; }

/* 过渡动画 */
.transitioning {
  transform: scale(1.05);
}

.transition-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}

.transition-ring {
  position: absolute;
  width: 60px;
  height: 60px;
  border: 2px solid currentColor;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  animation: ringExpand 1.5s ease-out forwards;
}

.ring-2 {
  animation-delay: 0.2s;
}

.transition-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.4em;
  font-weight: 700;
  color: currentColor;
  opacity: 0;
  animation: textFade 1.5s ease-out forwards;
  white-space: nowrap;
}

@keyframes ringExpand {
  0% {
    width: 40px;
    height: 40px;
    opacity: 0.8;
  }
  100% {
    width: 200px;
    height: 200px;
    opacity: 0;
  }
}

@keyframes textFade {
  0%, 20% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  40%, 60% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

/* 几何括号装饰 */
.ordinal-geo {
  position: absolute;
  top: 0;
  left: -12px;
  right: -12px;
  bottom: 0;
  pointer-events: none;
  overflow: visible;
}

.geo-bracket {
  position: absolute;
  width: 8px;
  height: 100%;
  border: 2px solid currentColor;
  opacity: 0.15;
  transition: opacity 0.3s;
}

.geo-bracket.left {
  left: 0;
  border-right: none;
  border-radius: 4px 0 0 4px;
}

.geo-bracket.right {
  right: 0;
  border-left: none;
  border-radius: 0 4px 4px 0;
}

.ordinal-container:hover .geo-bracket {
  opacity: 0.3;
}

/* 过渡动画类 */
.ordinal-flash-enter-active,
.ordinal-flash-leave-active {
  transition: opacity 0.3s ease;
}

.ordinal-flash-enter-from,
.ordinal-flash-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 600px) {
  .ordinal-container {
    font-size: 24px;
    padding: 9px 12px;
  }
}
</style>
