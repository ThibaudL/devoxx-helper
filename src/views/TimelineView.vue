<script setup>
import {computed, onUnmounted, ref} from 'vue'
import {useSessionsStore} from '../stores/sessions'
import {useSharingStore} from '../stores/sharing'
import {LEVEL_STYLE} from '../utils/sessionTags'
import SessionModal from '../components/SessionModal.vue'

const store = useSessionsStore()
const sharing = useSharingStore()

const PX_PER_MIN = 5
const CARD_WIDTH = 230
const TIME_WIDTH = 56

const DAYS = [
  {value: 'wednesday', label: 'Wed, Apr 22', short: 'Wed'},
  {value: 'thursday', label: 'Thu, Apr 23', short: 'Thu'},
  {value: 'friday', label: 'Fri, Apr 24', short: 'Fri'},
]
const activeDay = ref('wednesday')
const activeDayIdx = computed(() => DAYS.findIndex(d => d.value === activeDay.value))

function prevDay() {
  if (activeDayIdx.value > 0) activeDay.value = DAYS[activeDayIdx.value - 1].value
}

function nextDay() {
  if (activeDayIdx.value < DAYS.length - 1) activeDay.value = DAYS[activeDayIdx.value + 1].value
}

const selectedSession = ref(null)

// drag-scroll
const scrollEl = ref(null)
let isDragging = false, startX = 0, scrollLeft = 0

function onMouseDown(e) {
  isDragging = true;
  startX = e.pageX - scrollEl.value.offsetLeft;
  scrollLeft = scrollEl.value.scrollLeft
  scrollEl.value.style.cursor = 'grabbing';
  scrollEl.value.style.userSelect = 'none'
}

function onMouseMove(e) {
  if (!isDragging) return;
  e.preventDefault()
  scrollEl.value.scrollLeft = scrollLeft - (e.pageX - scrollEl.value.offsetLeft - startX)
}

function onMouseUp() {
  isDragging = false;
  if (scrollEl.value) {
    scrollEl.value.style.cursor = 'grab';
    scrollEl.value.style.userSelect = ''
  }
}

function toMin(iso) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
    hour12: false
  }).formatToParts(new Date(iso))
  return parseInt(parts.find(p => p.type === 'hour').value) * 60 + parseInt(parts.find(p => p.type === 'minute').value)
}

const nowMin = ref(toMin(new Date().toISOString()))
const nowTimer = setInterval(() => {
  nowMin.value = toMin(new Date().toISOString())
}, 60_000)
onUnmounted(() => clearInterval(nowTimer))

function fmt(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'})
}


const dayData = computed(() => {
  const sessions = store.sessions.filter(s => s.day === activeDay.value && s.room)
  if (!sessions.length) return null

  const rooms = [...new Map(sessions.map(s => [s.room, s.room_weight])).entries()]
      .sort((a, b) => (a[1] ?? 99) - (b[1] ?? 99))
      .map(([name]) => name)

  const allMins = sessions.flatMap(s => [toMin(s.start_time), toMin(s.end_time)])
  const dayStartMin = Math.min(...allMins)
  const dayEndMin = Math.max(...allMins)
  const totalHeight = (dayEndMin - dayStartMin) * PX_PER_MIN

  const timeMarks = []
  for (let h = Math.floor(dayStartMin / 60); h <= Math.ceil(dayEndMin / 60); h++) {
    const min = h * 60
    if (min < dayStartMin || min > dayEndMin) continue
    timeMarks.push({
      label: `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      top: (min - dayStartMin) * PX_PER_MIN
    })
  }

  const slotTops = [...new Set(sessions.map(s => toMin(s.start_time)))]
      .sort((a, b) => a - b).map(m => (m - dayStartMin) * PX_PER_MIN)

  const withPos = sessions.map(s => {
    const startMin = toMin(s.start_time), endMin = toMin(s.end_time)
    const rawHeight = (endMin - startMin) * PX_PER_MIN - 4
    return {
      ...s,
      top: (startMin - dayStartMin) * PX_PER_MIN,
      height: s.is_break ? Math.max(rawHeight, 22) : rawHeight,
      col: rooms.indexOf(s.room),
      bookmarked: store.bookmarkedIds.has(s.id),
      startMin, endMin,
    }
  })

  // Merge simulcasts: sessions sharing a group_key collapse into one card that
  // spans the columns of all the rooms it runs in.
  const groups = new Map()
  const cards = []
  for (const s of withPos) {
    if (s.is_break) continue
    if (!s.group_key) {
      cards.push({...s, span: 1});
      continue
    }
    const g = groups.get(s.group_key)
    if (!g) {
      const card = {...s, span: 1, minCol: s.col, maxCol: s.col}
      groups.set(s.group_key, card)
      cards.push(card)
    } else {
      g.minCol = Math.min(g.minCol, s.col)
      g.maxCol = Math.max(g.maxCol, s.col)
      g.col = g.minCol
      g.span = g.maxCol - g.minCol + 1
      // prefer a real id over a placeholder so bookmarks still work
      if (!g.simulcast && s.simulcast) { /* keep g */
      } else if (g.simulcast && !s.simulcast) {
        g.id = s.id;
        g.simulcast = false
      }
    }
  }

  const bookmarkedList = cards.filter(s => store.bookmarkedIds.has(s.id))
  const conflictIds = new Set()
  for (let i = 0; i < bookmarkedList.length; i++)
    for (let j = i + 1; j < bookmarkedList.length; j++) {
      const a = bookmarkedList[i], b = bookmarkedList[j]
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        conflictIds.add(a.id);
        conflictIds.add(b.id)
      }
    }

  const breakBanners = []
  const seenBreaks = new Map()
  for (const s of withPos) {
    if (!s.is_break) continue
    if (!seenBreaks.has(s.start_time)) {
      seenBreaks.set(s.start_time, s);
      breakBanners.push(s)
    }
  }

  return {rooms, timeMarks, slotTops, totalHeight, cards, conflictIds, breakBanners, dayStartMin, dayEndMin}
})

const totalWidth = computed(() => dayData.value ? TIME_WIDTH + dayData.value.rooms.length * CARD_WIDTH : 0)

const nowTop = computed(() => {
  if (!dayData.value) return null
  const {dayStartMin, dayEndMin} = dayData.value
  if (nowMin.value < dayStartMin || nowMin.value > dayEndMin) return null
  return (nowMin.value - dayStartMin) * PX_PER_MIN
})

function onAvatarError(event, profile) {
  if (profile?.gravatar_url && event.target.src !== profile.gravatar_url) {
    event.target.src = profile.gravatar_url
  } else {
    event.target.style.display = 'none'
  }
}
</script>

<template>
  <div class="timeline-root">
    <!-- nav bar -->
    <div class="nav-bar">
      <div class="day-tabs">
        <button
            v-for="d in DAYS" :key="d.value"
            :class="['day-tab', { active: activeDay === d.value }]"
            @click="activeDay = d.value"
        >{{ d.label }}
        </button>
      </div>
      <div class="nav-arrows">
        <button class="arrow-btn" :disabled="activeDayIdx === 0" @click="prevDay">‹</button>
        <button class="arrow-btn" :disabled="activeDayIdx === DAYS.length - 1" @click="nextDay">›</button>
      </div>
    </div>

    <div v-if="store.loading" class="empty">Chargement…</div>
    <div v-else-if="!dayData" class="empty">Aucune session.</div>

    <div
        v-else
        ref="scrollEl"
        class="scroll-outer"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
    >
      <div class="grid-root" :style="{ width: totalWidth + 'px' }">

        <!-- sticky header -->
        <div class="header-row" :style="{ width: totalWidth + 'px' }">
          <div class="time-gutter-header" :style="{ width: TIME_WIDTH + 'px' }"/>
          <div v-for="room in dayData.rooms" :key="room" class="room-header" :style="{ width: CARD_WIDTH + 'px' }">
            {{ room }}
          </div>
        </div>

        <!-- body -->
        <div class="body-row">
          <!-- time labels -->
          <div class="time-gutter" :style="{ width: TIME_WIDTH + 'px', height: dayData.totalHeight + 'px' }">
            <div v-for="m in dayData.timeMarks" :key="m.label" class="time-label" :style="{ top: m.top + 'px' }">
              {{ m.label }}
            </div>
          </div>

          <!-- session area -->
          <div class="session-area"
               :style="{ width: (dayData.rooms.length * CARD_WIDTH) + 'px', height: dayData.totalHeight + 'px' }">
            <div v-for="(top, i) in dayData.slotTops" :key="i" class="slot-line" :style="{ top: top + 'px' }"/>
            <div v-for="(_, i) in dayData.rooms" :key="i" class="col-line" :style="{ left: (i * CARD_WIDTH) + 'px' }"/>

            <!-- break banners -->
            <div
                v-for="b in dayData.breakBanners" :key="'break-' + b.start_time"
                class="break-banner"
                :style="{ top: b.top + 'px', height: b.height + 'px', width: (dayData.rooms.length * CARD_WIDTH) + 'px' }"
            >
              {{ b.title }} · {{ fmt(b.start_time) }} – {{ fmt(b.end_time) }}
            </div>

            <!-- current time indicator -->
            <div v-if="nowTop !== null" class="now-line" :style="{ top: nowTop + 'px' }">
              <div class="now-dot"/>
            </div>

            <!-- session cards -->
            <div
                v-for="s in dayData.cards" :key="s.id"
                class="session-card"
                :class="{ bookmarked: store.bookmarkedIds.has(s.id), conflict: dayData.conflictIds.has(s.id), wide: s.span > 1 }"
                :style="{
                top:    s.top + 'px',
                height: s.height + 'px',
                left:   (s.col * CARD_WIDTH + 4) + 'px',
                width:  (s.span * CARD_WIDTH - 8) + 'px',
                '--format-color': s.format_color ?? '#e5e7eb',
              }"
                @click="selectedSession = s"
            >
              <!-- left accent bar -->
              <div class="accent-bar"/>

              <!-- time + format -->
              <div class="card-top">
                <span class="card-time">{{ fmt(s.start_time) }} - {{ fmt(s.end_time) }}</span>
                <span v-if="s.format" class="format-badge" :style="{ background: s.format_color ?? '#e5e7eb' }">
                  {{ s.format }}
                </span>
              </div>

              <!-- title -->
              <p class="card-title">{{ s.title }}</p>

              <!-- speakers -->
              <p v-if="s.speakers.length" class="card-speakers">{{ s.speakers.join(', ') }}</p>

              <!-- track, level, language -->
              <div class="card-tags">
                <span v-if="s.track" class="track-tag">{{ s.track }}</span>
              </div>
              <div class="card-badges">
                <span
                    v-if="s.audience_level"
                    class="level-tag"
                    :style="{
                      background: (LEVEL_STYLE[s.audience_level] ?? {}).bg,
                      color:      (LEVEL_STYLE[s.audience_level] ?? {}).color,
                    }"
                >{{ s.audience_level }}</span>
                <span v-if="s.language" class="lang-tag">{{ s.language }}</span>
              </div>

              <!-- footer: bookmark + friends + room -->
              <div class="card-footer">
                <button class="heart-btn" @click.stop="store.toggleBookmark(s.id)">
                  <span>{{ store.bookmarkedIds.has(s.id) ? '♥' : '♡' }}</span>
                  <span v-if="s.total_favourites" class="fav-count">{{ s.total_favourites }}</span>
                </button>
                <div v-if="sharing.getFriendsForSession(s.id).length" class="friend-avatars">
                  <div
                    v-for="(f, i) in sharing.getFriendsForSession(s.id).slice(0, 3)" :key="i"
                    class="friend-avatar"
                    :title="f?.full_name || f?.email"
                  >
                    <img
                      v-if="f?.avatar_url || f?.gravatar_url"
                      :src="f.avatar_url || f.gravatar_url"
                      :alt="f?.full_name"
                      @error="onAvatarError($event, f)"
                    />
                    <span v-else>{{ (f?.full_name || f?.email || '?')[0].toUpperCase() }}</span>
                  </div>
                  <span v-if="sharing.getFriendsForSession(s.id).length > 3" class="friend-overflow">+{{ sharing.getFriendsForSession(s.id).length - 3 }}</span>
                </div>
                <span class="room-tag">📍 {{ s.span > 1 ? `${s.span} salles` : s.room }}</span>
                <span v-if="dayData.conflictIds.has(s.id)" class="conflict-dot" title="Conflit dans ton agenda"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <SessionModal :session="selectedSession" :friends="selectedSession ? sharing.getFriendsForSession(selectedSession.id) : []" @close="selectedSession = null"/>
  </div>
</template>

<style scoped>
.timeline-root { display: flex; flex-direction: column; height: 100%; }

.nav-bar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky; top: 0; z-index: 30;
}

.day-tabs { display: flex; gap: 0.4rem; }

.day-tab {
  padding: 0.4rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.85rem; font-weight: 500;
  cursor: pointer; color: var(--text-2);
}
.day-tab.active { background: #3b82f6; border-color: #3b82f6; color: white; }

.nav-arrows { display: flex; gap: 0.25rem; margin-left: 0.25rem; }

.arrow-btn {
  width: 32px; height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #3b82f6; color: white;
  font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.arrow-btn:disabled { background: var(--surface-subtle); color: var(--text-4); cursor: default; }

.scroll-outer { flex: 1; overflow-x: auto; overflow-y: auto; cursor: grab; }
.grid-root { min-width: max-content; }

.header-row {
  display: flex;
  position: sticky; top: 0; z-index: 20;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
}
.time-gutter-header { flex-shrink: 0; border-right: 1px solid var(--border); }
.room-header {
  flex-shrink: 0; padding: 0.5rem;
  font-size: 0.72rem; font-weight: 700; color: var(--text-3);
  text-align: center; border-right: 1px solid var(--border-faint);
  box-sizing: border-box;
}

.body-row { display: flex; }
.time-gutter { position: relative; flex-shrink: 0; border-right: 1px solid var(--border); }
.time-label {
  position: absolute; right: 6px;
  font-size: 0.68rem; color: var(--text-4);
  transform: translateY(-50%); white-space: nowrap;
}

.session-area { position: relative; }
.slot-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--border-faint); pointer-events: none; }
.col-line  { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--border-faint); pointer-events: none; }

.break-banner {
  position: absolute; left: 0;
  background: var(--surface-raised);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 600; color: var(--text-4);
  text-transform: uppercase; letter-spacing: 0.05em;
  pointer-events: none; z-index: 1;
}

.session-card {
  position: absolute;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 6px 8px 6px 12px;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 3px;
  overflow: hidden; box-sizing: border-box;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s;
  z-index: 3;
}
.session-card:hover { box-shadow: var(--shadow-md); z-index: 6; }
.session-card.wide  { z-index: 4; box-shadow: var(--shadow-sm); }
.session-card.bookmarked { background: color-mix(in srgb, #3b82f6 10%, var(--surface)); border-color: #93c5fd; }
.session-card.conflict   { border-color: #f87171; border-width: 2px; }

.accent-bar {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; border-radius: 8px 0 0 8px;
  background: var(--format-color, var(--border));
}

.card-top { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.card-time { font-size: 0.65rem; color: var(--text-3); white-space: nowrap; }

.format-badge {
  font-size: 0.6rem; font-weight: 700;
  padding: 1px 6px; border-radius: 4px;
  color: rgba(0,0,0,0.65); white-space: nowrap;
}

.card-title {
  font-size: 0.82rem; font-weight: 700;
  line-height: 1.25; margin: 0;
  overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  color: var(--text-1);
}

.card-speakers { font-size: 0.7rem; color: var(--text-3); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.card-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: auto; }

.track-tag {
  font-size: 0.58rem; color: var(--text-2);
  background: var(--surface-subtle);
  padding: 1px 5px; border-radius: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;
}

.card-badges { display: flex; flex-wrap: wrap; gap: 3px; }
.level-tag { font-size: 0.58rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; white-space: nowrap; text-transform: uppercase; }
.lang-tag  { font-size: 0.58rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; white-space: nowrap; background: #e0f2fe; color: #0369a1; text-transform: uppercase; }

.card-footer { display: flex; align-items: center; gap: 6px; margin-top: 2px; }

.heart-btn {
  display: flex; align-items: center; gap: 3px;
  border: none; background: none; cursor: pointer;
  font-size: 0.78rem; color: var(--text-4); padding: 0;
}
.session-card.bookmarked .heart-btn { color: #f97316; }
.fav-count { font-size: 0.68rem; }

.friend-avatars { display: flex; align-items: center; margin-left: 2px; }
.friend-avatar {
  width: 16px; height: 16px; border-radius: 50%;
  background: #dbeafe; color: #1d4ed8;
  border: 1.5px solid var(--surface);
  margin-left: -4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.45rem; font-weight: 700;
  overflow: hidden; flex-shrink: 0;
}
.friend-avatar:first-child { margin-left: 0; }
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-overflow { font-size: 0.55rem; color: var(--text-4); margin-left: 2px; }

.room-tag { font-size: 0.65rem; color: var(--text-4); margin-left: auto; white-space: nowrap; }

.conflict-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }

.empty { text-align: center; color: var(--text-4); padding: 3rem; }

.now-line { position: absolute; left: 0; right: 0; height: 2px; background: #ef4444; pointer-events: none; z-index: 5; }
.now-dot  { position: absolute; left: -5px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; }
</style>
