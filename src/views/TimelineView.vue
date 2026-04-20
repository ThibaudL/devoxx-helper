<script setup>
import {computed, onUnmounted, ref} from 'vue'
import {useSessionsStore} from '../stores/sessions'
import {useSharingStore} from '../stores/sharing'
import {LEVEL_STYLE} from '../utils/sessionTags'
import {getRoomColor} from '../utils/roomColors'
import RoomTag from '../components/RoomTag.vue'
import SessionModal from '../components/SessionModal.vue'

const store = useSessionsStore()
const sharing = useSharingStore()

const PX_PER_MIN = 8
const LUNCH_PX_PER_MIN = 14
const CARD_WIDTH = 260

const DAYS = [
  {value: 'wednesday', label: 'Mercredi', short: 'Wed'},
  {value: 'thursday', label: 'Jeudi', short: 'Thu'},
  {value: 'friday', label: 'Vendredi', short: 'Fri'},
]
const activeDay = ref('wednesday')
const activeDayIdx = computed(() => DAYS.findIndex(d => d.value === activeDay.value))

const onlyBookmarked = ref(false)
const onlyFriendBookmarked = ref(false)

function prevDay() {
  if (activeDayIdx.value > 0) activeDay.value = DAYS[activeDayIdx.value - 1].value
}

function nextDay() {
  if (activeDayIdx.value < DAYS.length - 1) activeDay.value = DAYS[activeDayIdx.value + 1].value
}

const selectedSession = ref(null)

// drag-scroll
const scrollEl = ref(null)
let isDragging = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0

function onMouseDown(e) {
  // Only start dragging if it's the left mouse button
  if (e.button !== 0) return;
  isDragging = true;
  startX = e.pageX - scrollEl.value.offsetLeft;
  startY = e.pageY - scrollEl.value.offsetTop;
  scrollLeft = scrollEl.value.scrollLeft
  scrollTop = scrollEl.value.scrollTop
  scrollEl.value.style.cursor = 'grabbing';
  scrollEl.value.style.userSelect = 'none'
  
  // Prevent default to avoid text selection/dragging images
  // but we must be careful not to break clicks on buttons/cards
  // Clicks are usually handled on mouseUp if the distance is small
}

function onMouseMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  const x = e.pageX - scrollEl.value.offsetLeft;
  const y = e.pageY - scrollEl.value.offsetTop;
  const walkX = x - startX;
  const walkY = y - startY;
  scrollEl.value.scrollLeft = scrollLeft - walkX;
  scrollEl.value.scrollTop = scrollTop - walkY;
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

  const rooms = [...new Map(sessions.filter(s => !s.is_break).map(s => [s.room, s.room_weight])).entries()]
      .sort((a, b) => (a[1] ?? 99) - (b[1] ?? 99))
      .map(([name]) => name)

  // Compressed time scale: gaps with no real sessions get a fixed small height
  const EMPTY_GAP_PX = 32
  const allMins = [...new Set(sessions.flatMap(s => [toMin(s.start_time), toMin(s.end_time)]))]
      .sort((a, b) => a - b)
  const dayStartMin = allMins[0]
  const dayEndMin = allMins[allMins.length - 1]

  const pixelMap = new Map()
  pixelMap.set(dayStartMin, 0)
  let cumulative = 0
  for (let i = 1; i < allMins.length; i++) {
    const prev = allMins[i - 1], curr = allMins[i]
    const activeSessions = sessions.filter(s => !s.is_break && toMin(s.start_time) <= prev && toMin(s.end_time) >= curr)
    const active = activeSessions.length > 0
    const onlyLunch = active && activeSessions.every(s => s.format === 'Lunch Talk')
    const rate = onlyLunch ? LUNCH_PX_PER_MIN : PX_PER_MIN
    cumulative += active ? (curr - prev) * rate : EMPTY_GAP_PX
    pixelMap.set(curr, cumulative)
  }
  const totalHeight = cumulative

  function minToPixel(min) {
    if (min <= dayStartMin) return 0
    if (min >= dayEndMin) return totalHeight
    if (pixelMap.has(min)) return pixelMap.get(min)
    let prev = dayStartMin, next = dayEndMin
    for (const m of allMins) { if (m <= min) prev = m; else { next = m; break } }
    const ratio = (min - prev) / (next - prev)
    return pixelMap.get(prev) + ratio * (pixelMap.get(next) - pixelMap.get(prev))
  }

  const timeMarks = []
  for (let h = Math.floor(dayStartMin / 60); h <= Math.ceil(dayEndMin / 60); h++) {
    const min = h * 60
    if (min < dayStartMin || min > dayEndMin) continue
    timeMarks.push({ label: `${String(h).padStart(2, '0')}:00`, top: minToPixel(min) })
  }

  const slotTops = [...new Set(sessions.filter(s => !s.is_break).map(s => toMin(s.start_time)))]
      .sort((a, b) => a - b).map(m => pixelMap.get(m)).filter(t => t !== undefined)

  const withPos = sessions.map(s => {
    const startMin = toMin(s.start_time), endMin = toMin(s.end_time)
    const top = pixelMap.get(startMin) ?? 0
    const bottom = pixelMap.get(endMin) ?? top
    const rawHeight = bottom - top - 4
    return {
      ...s,
      top,
      height: s.is_break ? Math.max(bottom - top, 22) : rawHeight,
      col: rooms.indexOf(s.room),
      bookmarked: store.bookmarkedIds.has(s.id),
      friendBookmarked: sharing.allFriendBookmarkedIds.has(s.id),
      startMin, endMin,
    }
  })

  // Merge simulcasts: sessions sharing a group_key collapse into one card that
  // spans the columns of all the rooms it runs in.
  const groups = new Map()
  let cards = []
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
        g.bookmarked = s.bookmarked
        g.friendBookmarked = s.friendBookmarked
      }
    }
  }

  if (onlyBookmarked.value) {
    cards = cards.filter(c => c.bookmarked)
  }
  if (onlyFriendBookmarked.value) {
    cards = cards.filter(c => c.friendBookmarked || c.bookmarked)
  }

  const bookmarkedList = cards.filter(s => s.bookmarked)
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

  return {rooms, timeMarks, slotTops, totalHeight, cards, conflictIds, breakBanners, dayStartMin, dayEndMin, minToPixel}
})

const totalWidth = computed(() => dayData.value ? dayData.value.rooms.length * CARD_WIDTH : 0)

const nowTop = computed(() => {
  if (!dayData.value) return null
  const {dayStartMin, dayEndMin, minToPixel} = dayData.value
  if (nowMin.value < dayStartMin || nowMin.value > dayEndMin) return null
  return minToPixel(nowMin.value)
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

      <div class="filter-controls">
        <button
          :class="['filter-btn', { active: onlyBookmarked }]"
          @click="onlyBookmarked = !onlyBookmarked"
          title="Mes bookmarks"
        >★</button>
        <button
          v-if="sharing.teams.length"
          :class="['filter-btn', 'friend-filter', { active: onlyFriendBookmarked }]"
          @click="onlyFriendBookmarked = !onlyFriendBookmarked"
          title="Favoris amis"
        >👥</button>
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
          <div
            v-for="room in dayData.rooms" :key="room" class="room-header"
            :style="{ width: CARD_WIDTH + 'px', color: getRoomColor(room).color, borderBottomColor: getRoomColor(room).border }"
          >
            <span class="room-dot" :style="{ background: getRoomColor(room).dot }" />
            {{ room }}
          </div>
        </div>

        <!-- body -->
        <div class="body-row">
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

              <!-- track -->
              <div class="card-tags">
                <span v-if="s.track" class="track-tag">{{ s.track }}</span>
              </div>

              <!-- keywords -->
              <div v-if="s.keywords?.length" class="card-keywords">
                <span v-for="kw in s.keywords.slice(0, 4)" :key="kw" class="kw-tag">{{ kw }}</span>
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
                <RoomTag v-if="s.span <= 1 && s.room" :room="s.room" />
                <span v-else-if="s.span > 1" class="room-tag">📍 {{ s.span }} salles</span>
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
.timeline-root { display: flex; flex-direction: column; height: 100%; background: var(--surface-raised); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); }

.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky; top: 0; z-index: 30;
}

.day-tabs { display: flex; gap: 0.5rem; }

.day-tab {
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.875rem; font-weight: 600;
  cursor: pointer; color: var(--text-2);
  transition: all 0.2s;
}
.day-tab:hover { border-color: var(--text-4); background: var(--surface-subtle); }
.day-tab.active { background: var(--accent); border-color: var(--accent); color: white; }

.filter-controls { display: flex; gap: 0.5rem; }

.filter-btn {
  width: 2.25rem; height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface); color: var(--text-2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  font-size: 1.1rem;
}
.filter-btn:hover { border-color: var(--text-4); background: var(--surface-subtle); }
.filter-btn.active { background: #f97316; border-color: #f97316; color: white; }
.filter-btn.friend-filter.active { background: #8b5cf6; border-color: #8b5cf6; }

.nav-controls { display: flex; align-items: center; gap: 1rem; }

.nav-arrows { display: flex; gap: 0.5rem; }

.arrow-btn {
  width: 2.25rem; height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface); color: var(--text-2);
  font-size: 1.25rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.arrow-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.arrow-btn:disabled { opacity: 0.4; cursor: default; }

.scroll-outer { flex: 1; overflow-x: auto; overflow-y: auto; cursor: grab; background: var(--surface-raised); }
.grid-root { min-width: max-content; }

.header-row {
  display: flex;
  position: sticky; top: 0; z-index: 20;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.time-gutter-header { flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface-subtle); }
.room-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.room-header {
  flex-shrink: 0; padding: 0.75rem 0.5rem;
  font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  border-right: 1px solid var(--border-faint); border-bottom: 2px solid;
  box-sizing: border-box;
  text-transform: uppercase; letter-spacing: 0.05em;
}

.body-row { display: flex; }
.time-gutter { position: relative; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface-subtle); }
.time-label {
  position: absolute; right: 0.75rem;
  font-size: 0.75rem; font-weight: 600; color: var(--text-4);
  transform: translateY(-50%); white-space: nowrap;
}

.session-area { position: relative; }
.slot-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--border-faint); pointer-events: none; }
.col-line  { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--border-faint); pointer-events: none; }

.break-banner {
  position: absolute; left: 0;
  background: var(--surface-subtle);
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: var(--text-4);
  text-transform: uppercase; letter-spacing: 0.1em;
  pointer-events: none; z-index: 1;
}

.session-card {
  position: absolute;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 0.25rem;
  overflow: hidden; box-sizing: border-box;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
  z-index: 3;
}
.session-card:hover { 
  box-shadow: var(--shadow-md); 
  z-index: 10; 
  border-color: var(--text-4); 
}
.session-card:active {
  cursor: grabbing;
}
.session-card.wide  { z-index: 4; }
.session-card.bookmarked {
  background: linear-gradient(to bottom right, color-mix(in srgb, #f97316 10%, var(--surface)), var(--surface));
  border-color: #f97316;
}
.session-card.conflict   { border-color: #ef4444; border-width: 2px; }

.accent-bar {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--format-color, #e2e8f0);
}

.card-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.card-time { font-size: 0.6875rem; font-weight: 600; color: var(--text-3); white-space: nowrap; }

.format-badge {
  font-size: 0.625rem; font-weight: 700;
  padding: 0.125rem 0.375rem; border-radius: 4px;
  color: rgba(0,0,0,0.7); white-space: nowrap;
  background: var(--format-color-subtle, #f1f5f9);
}

.card-title {
  font-size: 0.8125rem; font-weight: 700;
  line-height: 1.3; margin: 0;
  overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  color: var(--text-1);
}

.card-speakers { font-size: 0.75rem; font-weight: 500; color: var(--text-3); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.card-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: auto; }

.track-tag {
  font-size: 0.625rem; font-weight: 600; color: var(--text-3);
  background: var(--surface-subtle);
  padding: 0.125rem 0.375rem; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;
}

.card-keywords { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.kw-tag { font-size: 0.6rem; font-weight: 500; padding: 0.1rem 0.35rem; border-radius: 4px; white-space: nowrap; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }

.card-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.level-tag { font-size: 0.625rem; font-weight: 700; padding: 0.125rem 0.375rem; border-radius: 4px; white-space: nowrap; text-transform: uppercase; }
.lang-tag  { font-size: 0.625rem; font-weight: 700; padding: 0.125rem 0.375rem; border-radius: 4px; white-space: nowrap; background: #e0f2fe; color: #0369a1; text-transform: uppercase; }

.card-footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px solid var(--border-faint); }

.heart-btn {
  display: flex; align-items: center; gap: 0.25rem;
  border: none; background: none; cursor: pointer;
  font-size: 0.8125rem; color: var(--text-4); padding: 0;
  transition: color 0.2s;
}
.heart-btn:hover { color: #f97316; }
.session-card.bookmarked .heart-btn { color: #f97316; }
.fav-count { font-size: 0.75rem; font-weight: 600; }

.friend-avatars { display: flex; align-items: center; margin-left: 0.125rem; }
.friend-avatar {
  width: 1.125rem; height: 1.125rem; border-radius: 50%;
  background: var(--surface-subtle); color: var(--accent);
  border: 1.5px solid var(--surface);
  margin-left: -0.375rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.5rem; font-weight: 700;
  overflow: hidden; flex-shrink: 0;
}
.friend-avatar:first-child { margin-left: 0; }
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-overflow { font-size: 0.625rem; font-weight: 600; color: var(--text-4); margin-left: 0.125rem; }

.room-tag {
  font-size: 0.6875rem; font-weight: 600; white-space: nowrap; margin-left: auto;
  color: var(--text-4);
}

.conflict-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: #ef4444; flex-shrink: 0; box-shadow: 0 0 0 2px var(--surface); }

.empty { text-align: center; color: var(--text-4); padding: 4rem 2rem; }

.now-line { position: absolute; left: 0; right: 0; height: 2px; background: #ef4444; pointer-events: none; z-index: 15; }
.now-dot  { position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 2px white; }
</style>
