<script setup>
import { getRoomColor } from '../utils/roomColors'
import { usePlanModal } from '../composables/usePlanModal'

const props = defineProps({ room: { type: String, required: true } })
const { openPlan } = usePlanModal()
</script>

<template>
  <span
    class="room-tag"
    :style="{ background: getRoomColor(room).bg, color: getRoomColor(room).color, borderColor: getRoomColor(room).border }"
    role="button"
    title="Voir sur le plan"
    @click.stop="openPlan(room)"
  >📍 {{ room }}</span>
</template>

<style scoped>
.room-tag {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.75rem; font-weight: 700;
  padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid;
  white-space: nowrap; cursor: pointer;
  transition: filter 0.15s;
}
.room-tag:hover { filter: brightness(0.92); }
</style>
