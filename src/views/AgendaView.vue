<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSessionsStore } from '../stores/sessions'
import { useSharingStore } from '../stores/sharing'
import SessionCard from '../components/SessionCard.vue'
import ShareModal from '../components/ShareModal.vue'
import TimelineView from './TimelineView.vue'

const auth = useAuthStore()
const store = useSessionsStore()
const sharing = useSharingStore()
const router = useRouter()
const showShareModal = ref(false)

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
  await Promise.all([store.fetchSessions(), store.fetchBookmarks(), sharing.fetchShares()])
  await sharing.fetchFriendBookmarks()
})

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
        <button class="share-btn" @click="showShareModal = true">👥 Partager</button>
        <button @click="handleSignOut">Déconnexion</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="view-toggle">
        <button :class="['view-btn', { active: viewMode === 'cards' }]" @click="viewMode = 'cards'">☰ Liste</button>
        <button :class="['view-btn', { active: viewMode === 'timeline' }]" @click="viewMode = 'timeline'">▦ Timeline</button>
      </div>
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
            v-if="sharing.sharedByMe.length"
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
</template>

<style scoped>
.layout {
  padding: 1rem;
}

header,
.toolbar,
.filters,
.grid,
.empty {
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
  margin-bottom: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
}

.user-info img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.user-info button {
  padding: 0.3rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.import-link {
  padding: 0.3rem 0.7rem;
  border: 1px solid #f97316;
  border-radius: 6px;
  color: #f97316;
  text-decoration: none;
  font-size: 0.85rem;
}

.import-link:hover { background: #fff7ed; }

.share-btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  color: #3b82f6;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}
.share-btn:hover { background: #eff6ff; }

.filter-btn.friend-filter { border-color: #3b82f6; color: #1d4ed8; }
.filter-btn.friend-filter.active { background: #3b82f6; border-color: #3b82f6; color: white; }

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.view-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  padding: 0.4rem 1rem;
  border: none;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.view-btn.active {
  background: #f97316;
  color: white;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.search {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.filter-btn {
  padding: 0.35rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 999px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.filter-btn.active {
  background: #f97316;
  border-color: #f97316;
  color: white;
}

select {
  padding: 0.35rem 0.7rem;
  border: 1px solid #ddd;
  border-radius: 999px;
  font-size: 0.85rem;
  background: white;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.empty {
  text-align: center;
  color: #999;
  padding: 3rem;
}
</style>
