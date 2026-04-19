<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSessionsStore } from '../stores/sessions'
import { useSharingStore } from '../stores/sharing'
import { useDarkMode } from '../composables/useDarkMode'
import SessionCard from '../components/SessionCard.vue'
import ShareModal from '../components/ShareModal.vue'
import PlanModal from '../components/PlanModal.vue'
import TimelineView from './TimelineView.vue'

const auth = useAuthStore()
const store = useSessionsStore()
const sharing = useSharingStore()
const router = useRouter()
const showShareModal = ref(false)
const showPlanModal = ref(false)
const { dark, toggle: toggleDark } = useDarkMode()

const search = ref('')
const selectedDay = ref('')
const selectedTrack = ref('')
const onlyBookmarked = ref(false)
const viewMode = ref('cards')

const DAYS = [
  { value: 'wednesday', label: 'Mercredi 22' },
  { value: 'thursday',  label: 'Jeudi 23' },
  { value: 'friday',    label: 'Vendredi 24' },
]

onMounted(async () => {
  await Promise.all([store.fetchSessions(), store.fetchBookmarks(), sharing.fetchTeams()])
  await sharing.fetchFriendBookmarks()
  nowTimer = setInterval(() => { now.value = new Date() }, 60_000)
})
onUnmounted(() => clearInterval(nowTimer))

const now = ref(new Date())
let nowTimer

const showNowPanel = ref(false)

const currentSessions = computed(() => {
  const t = now.value
  return store.sessions.filter(s =>
    !s.is_break && new Date(s.start_time) <= t && new Date(s.end_time) >= t
  )
})

const nextSessions = computed(() => {
  const t = now.value
  const upcoming = store.sessions
    .filter(s => !s.is_break && new Date(s.start_time) > t)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  if (!upcoming.length) return []
  const nextTime = upcoming[0].start_time
  return upcoming.filter(s => s.start_time === nextTime)
})

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

const onlyFriendBookmarked = ref(false)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return store.sessions.filter(s => {
    if (selectedDay.value && s.day !== selectedDay.value) return false
    if (selectedTrack.value && s.track !== selectedTrack.value) return false
    if (onlyBookmarked.value && !store.bookmarkedIds.has(s.id)) return false
    if (onlyFriendBookmarked.value && !sharing.allFriendBookmarkedIds.has(s.id)) return false
    if (q && !s.title.toLowerCase().includes(q) && !s.speakers.join(' ').toLowerCase().includes(q)) return false
    return true
  })
})

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <header>
      <h1>Devoxx Helper</h1>
      <div class="user-info">
        <img v-if="auth.user?.user_metadata?.avatar_url" :src="auth.user.user_metadata.avatar_url" alt="avatar" />
        <span>{{ auth.user?.user_metadata?.full_name }}</span>
        <RouterLink to="/import" class="import-link">⬇ Importer</RouterLink>
        <button class="plan-btn" @click="showPlanModal = true">🗺 Plan</button>
        <button class="share-btn" @click="showShareModal = true">👥 Partager</button>
        <button class="theme-btn" @click="toggleDark" :title="dark ? 'Mode clair' : 'Mode sombre'">{{ dark ? '☀' : '☾' }}</button>
        <button @click="handleSignOut">Déconnexion</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="view-toggle">
        <button :class="['view-btn', { active: viewMode === 'cards' }]" @click="viewMode = 'cards'">☰ Liste</button>
        <button :class="['view-btn', { active: viewMode === 'timeline' }]" @click="viewMode = 'timeline'">▦ Timeline</button>
      </div>
      <button :class="['now-btn', { active: showNowPanel }]" @click="showNowPanel = !showNowPanel">
        <span class="now-dot" />
        En ce moment
      </button>
    </div>

    <div v-if="showNowPanel" class="now-panel">
      <div v-if="currentSessions.length" class="now-section">
        <p class="now-label">🔴 En cours</p>
        <div class="now-list">
          <div
            v-for="s in currentSessions" :key="s.id"
            :class="['now-card',
              store.bookmarkedIds.has(s.id) && 'now-card--mine',
              !store.bookmarkedIds.has(s.id) && sharing.getFriendsForSession(s.id).length && 'now-card--team'
            ]"
          >
            <div class="now-card-time">{{ fmtTime(s.start_time) }} – {{ fmtTime(s.end_time) }}</div>
            <div class="now-card-title">{{ s.title }}</div>
            <div class="now-card-meta">
              <span v-if="s.room">📍 {{ s.room }}</span>
              <span v-if="s.speakers.length">· {{ s.speakers.join(', ') }}</span>
            </div>
            <div class="now-card-badges">
              <span v-if="store.bookmarkedIds.has(s.id)" class="now-badge now-badge--mine">♥ Mon agenda</span>
              <template v-if="sharing.getFriendsForSession(s.id).length">
                <span
                  v-for="(f, i) in sharing.getFriendsForSession(s.id).slice(0, 3)" :key="i"
                  class="now-badge now-badge--friend"
                  :title="f?.full_name || f?.email"
                >{{ (f?.full_name || f?.email || '?').split(' ')[0] }}</span>
                <span v-if="sharing.getFriendsForSession(s.id).length > 3" class="now-badge now-badge--friend">
                  +{{ sharing.getFriendsForSession(s.id).length - 3 }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-if="nextSessions.length" class="now-section">
        <p class="now-label">⏭ Prochainement · {{ fmtTime(nextSessions[0].start_time) }}</p>
        <div class="now-list">
          <div
            v-for="s in nextSessions" :key="s.id"
            :class="['now-card',
              store.bookmarkedIds.has(s.id) && 'now-card--mine',
              !store.bookmarkedIds.has(s.id) && sharing.getFriendsForSession(s.id).length && 'now-card--team'
            ]"
          >
            <div class="now-card-title">{{ s.title }}</div>
            <div class="now-card-meta">
              <span v-if="s.room">📍 {{ s.room }}</span>
              <span v-if="s.speakers.length">· {{ s.speakers.join(', ') }}</span>
            </div>
            <div class="now-card-badges">
              <span v-if="store.bookmarkedIds.has(s.id)" class="now-badge now-badge--mine">♥ Mon agenda</span>
              <template v-if="sharing.getFriendsForSession(s.id).length">
                <span
                  v-for="(f, i) in sharing.getFriendsForSession(s.id).slice(0, 3)" :key="i"
                  class="now-badge now-badge--friend"
                  :title="f?.full_name || f?.email"
                >{{ (f?.full_name || f?.email || '?').split(' ')[0] }}</span>
                <span v-if="sharing.getFriendsForSession(s.id).length > 3" class="now-badge now-badge--friend">
                  +{{ sharing.getFriendsForSession(s.id).length - 3 }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <p v-if="!currentSessions.length && !nextSessions.length" class="now-empty">
        Aucune session à venir.
      </p>
    </div>

    <TimelineView v-if="viewMode === 'timeline'" />

    <template v-else>
      <div class="filters">
        <input v-model="search" placeholder="Rechercher un talk ou speaker..." class="search" />
        <div class="filter-row">
          <button
            v-for="d in DAYS" :key="d.value"
            :class="['filter-btn', { active: selectedDay === d.value }]"
            @click="selectedDay = selectedDay === d.value ? '' : d.value"
          >{{ d.label }}</button>

          <select v-model="selectedTrack">
            <option value="">Tous les tracks</option>
            <option v-for="t in store.tracks" :key="t" :value="t">{{ t }}</option>
          </select>

          <button
            :class="['filter-btn', { active: onlyBookmarked }]"
            @click="onlyBookmarked = !onlyBookmarked"
          >★ Mes bookmarks ({{ store.bookmarkedIds.size }})</button>

          <button
            v-if="sharing.teams.length"
            :class="['filter-btn', 'friend-filter', { active: onlyFriendBookmarked }]"
            @click="onlyFriendBookmarked = !onlyFriendBookmarked"
          >👥 Favoris amis ({{ sharing.allFriendBookmarkedIds.size }})</button>
        </div>
      </div>

      <div v-if="store.loading" class="empty">Chargement...</div>
      <div v-else-if="!filtered.length" class="empty">Aucun talk trouvé.</div>
      <div v-else class="grid">
        <SessionCard v-for="s in filtered" :key="s.id" :session="s" :friends="sharing.getFriendsForSession(s.id)" />
      </div>
    </template>
  </div>

  <ShareModal v-if="showShareModal" @close="showShareModal = false" />
  <PlanModal v-if="showPlanModal" @close="showPlanModal = false" />
</template>

<style scoped>
.layout { padding: 1rem; }

header, .toolbar, .filters, .grid, .empty {
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
}

.user-info img { width: 30px; height: 30px; border-radius: 50%; }

.user-info button {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  font-size: 0.85rem;
}
.user-info button:hover { background: var(--surface-subtle); }

.theme-btn { font-size: 1rem !important; padding: 0.2rem 0.5rem !important; }

.import-link {
  padding: 0.3rem 0.7rem;
  border: 1px solid #f97316;
  border-radius: 6px;
  color: #f97316;
  text-decoration: none;
  font-size: 0.85rem;
}
.import-link:hover { background: var(--surface-subtle); }

.plan-btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid #6366f1;
  border-radius: 6px;
  color: #6366f1;
  background: var(--surface);
  cursor: pointer;
  font-size: 0.85rem;
}
.plan-btn:hover { background: var(--surface-subtle); }

.share-btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  color: #3b82f6;
  background: var(--surface);
  cursor: pointer;
  font-size: 0.85rem;
}
.share-btn:hover { background: var(--surface-subtle); }

.filter-btn.friend-filter { border-color: #3b82f6; color: #3b82f6; }
.filter-btn.friend-filter.active { background: #3b82f6; border-color: #3b82f6; color: white; }

.toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }

.view-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  padding: 0.4rem 1rem;
  border: none;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  font-size: 0.85rem;
}
.view-btn.active { background: #f97316; color: white; }

.now-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  font-size: 0.85rem;
}
.now-btn:hover { background: var(--surface-subtle); }
.now-btn.active { border-color: #ef4444; color: #ef4444; }
.now-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.now-panel {
  max-width: 1100px;
  margin: 0 auto 1.25rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.now-section { display: flex; flex-direction: column; gap: 0.5rem; }
.now-label { margin: 0; font-size: 0.78rem; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
.now-list { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.now-card {
  flex: 1 1 260px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  background: var(--surface-subtle);
  display: flex; flex-direction: column; gap: 0.2rem;
}
.now-card-time { font-size: 0.72rem; color: var(--text-4); font-variant-numeric: tabular-nums; }
.now-card-title { font-size: 0.88rem; font-weight: 600; color: var(--text-1); line-height: 1.3; }
.now-card-meta { font-size: 0.75rem; color: var(--text-3); }
.now-card-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }
.now-badge {
  font-size: 0.68rem; padding: 0.15rem 0.45rem;
  border-radius: 999px; font-weight: 600;
}
.now-badge--mine { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
.now-badge--friend { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.now-card--mine {
  border-color: #f97316;
  background: color-mix(in srgb, var(--surface-subtle) 85%, #f97316 15%);
}
.now-card--team {
  border-color: #3b82f6;
  background: color-mix(in srgb, var(--surface-subtle) 85%, #3b82f6 15%);
}
.now-empty { margin: 0; font-size: 0.85rem; color: var(--text-4); text-align: center; }

.filters { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.5rem; }

.search {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
  background: var(--surface);
  color: var(--text-1);
}
.search:focus { outline: none; border-color: #3b82f6; }

.filter-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

.filter-btn {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  font-size: 0.85rem;
}
.filter-btn.active { background: #f97316; border-color: #f97316; color: white; }

select {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.85rem;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
}

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

@media (max-width: 640px) {
  header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .user-info {
    flex-wrap: wrap;
    justify-content: flex-end;
    width: 100%;
  }
}

.empty { text-align: center; color: var(--text-4); padding: 3rem; }
</style>
