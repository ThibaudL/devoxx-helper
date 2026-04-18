<script setup>
import { computed, ref } from 'vue'
import { useSessionsStore } from '../stores/sessions'
import SessionModal from '../components/SessionModal.vue'

const selectedSession = ref(null)

const store = useSessionsStore()

const scrollEl = ref(null)
let isDragging = false
let startX = 0
let scrollLeft = 0

function onMouseDown(e) {
  isDragging = true
  startX = e.pageX - scrollEl.value.offsetLeft
  scrollLeft = scrollEl.value.scrollLeft
  scrollEl.value.style.cursor = 'grabbing'
  scrollEl.value.style.userSelect = 'none'
}

function onMouseMove(e) {
  if (!isDragging) return
  e.preventDefault()
  const x = e.pageX - scrollEl.value.offsetLeft
  scrollEl.value.scrollLeft = scrollLeft - (x - startX)
}

function onMouseUp() {
  isDragging = false
  scrollEl.value.style.cursor = 'grab'
  scrollEl.value.style.userSelect = ''
}

function onMouseLeave() {
  if (isDragging) onMouseUp()
}

const PX_PER_MIN = 3
const CARD_WIDTH  = 220
const TIME_WIDTH  = 64

const DAYS = [
  { value: 'wednesday', label: 'Mercredi 22' },
  { value: 'thursday',  label: 'Jeudi 23' },
  { value: 'friday',    label: 'Vendredi 24' },
]
const activeDay = ref('wednesday')

const FORMAT_COLORS = {
  'Keynote':    { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  'Conference': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  '2H Deep Dive': { bg: '#fef9c3', color: '#92400e', border: '#fde68a' },
  'Tools-in-Action': { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'Quickie':    { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
}

function formatColor(fmt) {
  return FORMAT_COLORS[fmt] ?? { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
}

function toMin(iso) {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function formatRange(start, end) {
  const fmt = iso => new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })
  return `${fmt(start)} - ${fmt(end)}`
}

const dayData = computed(() => {
  const sessions = store.sessions.filter(s => s.day === activeDay.value && s.room)
  if (!sessions.length) return null

  const rooms = [...new Map(sessions.map(s => [s.room, s.room_weight])).entries()]
    .sort((a, b) => (a[1] ?? 99) - (b[1] ?? 99))
    .map(([name]) => name)

  const allMins = sessions.flatMap(s => [toMin(s.start_time), toMin(s.end_time)])
  const dayStartMin = Math.min(...allMins)
  const dayEndMin   = Math.max(...allMins)
  const totalHeight = (dayEndMin - dayStartMin) * PX_PER_MIN

  const timeMarks = []
  for (let h = Math.floor(dayStartMin / 60); h <= Math.ceil(dayEndMin / 60); h++) {
    const min = h * 60
    if (min < dayStartMin || min > dayEndMin) continue
    timeMarks.push({ label: `${String(h).padStart(2, '0')}:00`, top: (min - dayStartMin) * PX_PER_MIN })
  }

  // detect slot boundaries (unique start times) for horizontal dividers
  const slotTops = [...new Set(sessions.map(s => toMin(s.start_time)))]
    .sort((a, b) => a - b)
    .map(m => (m - dayStartMin) * PX_PER_MIN)

  const sessionsWithPos = sessions.map(s => {
    const startMin = toMin(s.start_time)
    const endMin   = toMin(s.end_time)
    const top      = (startMin - dayStartMin) * PX_PER_MIN
    const height   = Math.max((endMin - startMin) * PX_PER_MIN - 4, s.is_break ? 24 : 60)
    const col      = rooms.indexOf(s.room)
    const bookmarked = store.bookmarkedIds.has(s.id)
    return { ...s, top, height, col, bookmarked, startMin, endMin }
  })

  // group breaks by start_time so one banner covers all columns
  const breakBanners = []
  const seenBreaks = new Map()
  for (const s of sessionsWithPos) {
    if (!s.is_break) continue
    const key = s.start_time
    if (!seenBreaks.has(key)) {
      seenBreaks.set(key, { ...s })
      breakBanners.push(seenBreaks.get(key))
    }
  }

  // conflicts
  const bookmarkedList = sessionsWithPos.filter(s => s.bookmarked)
  const conflictIds = new Set()
  for (let i = 0; i < bookmarkedList.length; i++) {
    for (let j = i + 1; j < bookmarkedList.length; j++) {
      const a = bookmarkedList[i], b = bookmarkedList[j]
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflictIds.add(a.id)
        conflictIds.add(b.id)
      }
    }
  }

  return { rooms, timeMarks, slotTops, totalHeight, sessions: sessionsWithPos, conflictIds, breakBanners }
})

const totalWidth = computed(() =>
  dayData.value ? TIME_WIDTH + dayData.value.rooms.length * CARD_WIDTH : 0
)
</script>

<template>
  <div>
    <div class="day-tabs">
      <button
        v-for="d in DAYS" :key="d.value"
        :class="['day-tab', { active: activeDay === d.value }]"
        @click="activeDay = d.value"
      >{{ d.label }}</button>
    </div>

    <div v-if="!dayData" class="empty">Chargement...</div>

    <div
      v-else
      ref="scrollEl"
      class="scroll-outer"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
    >
      <div class="grid-root" :style="{ width: totalWidth + 'px' }">

        <!-- sticky header: time gutter + room names -->
        <div class="header-row" :style="{ width: totalWidth + 'px' }">
          <div class="time-gutter-header" :style="{ width: TIME_WIDTH + 'px' }" />
          <div
            v-for="room in dayData.rooms" :key="room"
            class="room-header"
            :style="{ width: CARD_WIDTH + 'px' }"
          >{{ room }}</div>
        </div>

        <!-- body: time gutter + session grid -->
        <div class="body-row">
          <!-- time gutter -->
          <div class="time-gutter" :style="{ width: TIME_WIDTH + 'px', height: dayData.totalHeight + 'px' }">
            <div
              v-for="m in dayData.timeMarks" :key="m.label"
              class="time-label"
              :style="{ top: m.top + 'px' }"
            >{{ m.label }}</div>
          </div>

          <!-- session area -->
          <div
            class="session-area"
            :style="{
              width: (dayData.rooms.length * CARD_WIDTH) + 'px',
              height: dayData.totalHeight + 'px',
            }"
          >
            <!-- slot dividers -->
            <div
              v-for="(top, i) in dayData.slotTops" :key="'slot-' + i"
              class="slot-line"
              :style="{ top: top + 'px' }"
            />

            <!-- column dividers -->
            <div
              v-for="(room, i) in dayData.rooms" :key="'col-' + room"
              class="col-line"
              :style="{ left: (i * CARD_WIDTH) + 'px', height: dayData.totalHeight + 'px' }"
            />

            <!-- break banners (full-width) -->
            <div
              v-for="b in dayData.breakBanners" :key="'break-' + b.start_time"
              class="break-banner"
              :style="{ top: b.top + 'px', height: b.height + 'px', width: (dayData.rooms.length * CARD_WIDTH) + 'px' }"
            >
              {{ b.title }} · {{ formatRange(b.start_time, b.end_time) }}
            </div>

            <!-- sessions (non-break) -->
            <div
              v-for="s in dayData.sessions.filter(s => !s.is_break)" :key="s.id"
              class="session-card"
              :class="{
                bookmarked: s.bookmarked,
                conflict:   dayData.conflictIds.has(s.id),
              }"
              :style="{
                top:    s.top + 'px',
                height: s.height + 'px',
                left:   (s.col * CARD_WIDTH + 4) + 'px',
                width:  (CARD_WIDTH - 8) + 'px',
              }"
              @click="selectedSession = s"
            >
              <!-- top row: time + format badge -->
              <div class="card-top">
                <span class="card-time">{{ formatRange(s.start_time, s.end_time) }}</span>
                <span
                  v-if="s.format"
                  class="format-badge"
                  :style="{ background: formatColor(s.format).bg, color: formatColor(s.format).color, borderColor: formatColor(s.format).border }"
                >{{ s.format }}</span>
              </div>

              <!-- title -->
              <p class="card-title">{{ s.title }}</p>

              <!-- speakers -->
              <div class="card-speakers">
                <span v-for="(name, i) in s.speakers" :key="i" class="speaker-name">
                  <img v-if="s.speaker_images[i]" :src="s.speaker_images[i]" :alt="name" class="speaker-avatar" />
                  {{ name }}
                </span>
              </div>

              <!-- footer: track + bookmark + room -->
              <div class="card-footer">
                <span v-if="s.track" class="track-badge">{{ s.track }}</span>
                <span class="bookmark-icon">{{ s.bookmarked ? '♥' : '♡' }}</span>
                <span class="room-label">{{ s.room }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <SessionModal :session="selectedSession" @close="selectedSession = null" />
  </div>
</template>

<style scoped>
.day-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.day-tab {
  padding: 0.4rem 1.1rem;
  border: 1px solid #ddd;
  border-radius: 999px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
}

.day-tab.active {
  background: #f97316;
  border-color: #f97316;
  color: white;
}

.scroll-outer {
  overflow-x: auto;
  overflow-y: visible;
  border-top: 1px solid #e5e7eb;
  cursor: grab;
}

.grid-root {
  min-width: max-content;
}

/* sticky header */
.header-row {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 20;
  background: white;
  border-bottom: 2px solid #e5e7eb;
}

.time-gutter-header {
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
}

.room-header {
  flex-shrink: 0;
  padding: 0.4rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #6b7280;
  text-align: center;
  border-right: 1px solid #f3f4f6;
  box-sizing: border-box;
}

/* body */
.body-row {
  display: flex;
}

.time-gutter {
  position: relative;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
}

.time-label {
  position: absolute;
  right: 8px;
  font-size: 0.72rem;
  color: #9ca3af;
  transform: translateY(-50%);
  white-space: nowrap;
}

/* session area */
.session-area {
  position: relative;
}

.slot-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e7eb;
  pointer-events: none;
}

.col-line {
  position: absolute;
  top: 0;
  width: 1px;
  background: #f3f4f6;
  pointer-events: none;
}

/* session card */
.session-card {
  position: absolute;
  border-radius: 6px;
  border: 1px solid #bae6fd;
  background: #f0f9ff;
  padding: 5px 7px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  box-sizing: border-box;
  transition: box-shadow 0.15s;
}

.session-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  z-index: 5;
}

.session-card.bookmarked {
  background: #fff7ed;
  border-color: #f97316;
}

.session-card.conflict {
  background: #fef2f2;
  border-color: #ef4444;
  border-width: 2px;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.card-time {
  font-size: 0.65rem;
  color: #6b7280;
  white-space: nowrap;
}

.format-badge {
  font-size: 0.6rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}

.card-title {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  color: #111827;
}

.session-card.bookmarked .card-title { color: #c2410c; }
.session-card.conflict   .card-title { color: #b91c1c; }

.card-speakers {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.speaker-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speaker-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  flex-wrap: wrap;
}

.track-badge {
  font-size: 0.58rem;
  background: #d1fae5;
  color: #065f46;
  padding: 1px 5px;
  border-radius: 999px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.bookmark-icon {
  margin-left: auto;
  font-size: 0.85rem;
  color: #f97316;
}

.room-label {
  font-size: 0.62rem;
  color: #9ca3af;
}

.break-banner {
  position: absolute;
  left: 0;
  background: #f3f4f6;
  border-top: 1px solid #d1d5db;
  border-bottom: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  z-index: 2;
  pointer-events: none;
}

.empty {
  text-align: center;
  color: #9ca3af;
  padding: 3rem;
}
</style>
