<script setup>
import { computed, ref } from 'vue'
import { useSessionsStore } from '../stores/sessions'
import { useModalHistory } from '../composables/useModalHistory'
import { LEVEL_STYLE } from '../utils/sessionTags'
import RoomTag from './RoomTag.vue'
import SessionModal from './SessionModal.vue'

const props = defineProps({
  session: { type: Object, required: true },
  friends: { type: Array, default: () => [] },
})

const store = useSessionsStore()
const isBookmarked = computed(() => store.bookmarkedIds.has(props.session.id))
const showModal = ref(false)

useModalHistory(showModal)

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

const DAY_LABELS = { wednesday: 'Mer.', thursday: 'Jeu.', friday: 'Ven.' }

function initials(p) {
  if (p?.full_name) return p.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (p?.email?.[0] ?? '?').toUpperCase()
}
</script>

<template>
  <div class="card" :class="{ bookmarked: isBookmarked }" @click="showModal = true">
    <div class="card-header">
      <span class="tag format">{{ session.format }}</span>
      <span class="tag day">{{ DAY_LABELS[session.day] }} {{ formatTime(session.start_time) }}</span>
    </div>

    <h3>{{ session.title }}</h3>

    <div class="speakers">
      <span v-for="(name, i) in session.speakers" :key="i" class="speaker">
        <img v-if="session.speaker_images[i]" :src="session.speaker_images[i]" :alt="name" />
        {{ name }}
      </span>
    </div>

    <div class="card-meta">
      <span v-if="session.track" class="track-name">{{ session.track }}</span>
      <div class="card-badges">
        <span
          v-if="session.audience_level"
          class="level-badge"
          :style="{ background: (LEVEL_STYLE[session.audience_level] ?? {}).bg, color: (LEVEL_STYLE[session.audience_level] ?? {}).color }"
        >{{ session.audience_level }}</span>
        <span v-if="session.language" class="lang-badge">{{ session.language }}</span>
      </div>
    </div>

    <div class="card-footer">
      <template v-if="session._rooms?.length">
        <RoomTag v-for="r in session._rooms" :key="r" :room="r" />
      </template>
      <RoomTag v-else-if="session.room" :room="session.room" />
      <div v-if="friends.length" class="friend-avatars">
        <div
          v-for="(f, i) in friends.slice(0, 3)" :key="i"
          class="friend-avatar"
          :title="f?.full_name || f?.email"
        >
          <img v-if="f?.avatar_url" :src="f.avatar_url" :alt="f?.full_name" />
          <span v-else>{{ initials(f) }}</span>
        </div>
        <span v-if="friends.length > 3" class="friend-overflow">+{{ friends.length - 3 }}</span>
      </div>
      <button class="bookmark-btn" @click.stop="store.toggleBookmark(session.id)">
        {{ isBookmarked ? '★ Bookmarked' : '☆ Bookmark' }}
      </button>
    </div>
  </div>

  <SessionModal :session="showModal ? session : null" :friends="friends" @close="showModal = false" />
</template>

<style scoped>
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--surface);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--text-4);
}

.card.bookmarked {
  border-color: #f97316;
  background: linear-gradient(to bottom right, color-mix(in srgb, #f97316 5%, var(--surface)), var(--surface));
}

.card.bookmarked::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: #f97316;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
}

.tag.format {
  background: var(--surface-subtle);
  color: var(--text-3);
  border: 1px solid var(--border);
}

.tag.day {
  color: var(--accent);
  font-weight: 700;
}

h3 {
  font-size: 1.0625rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.4;
  color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.speakers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.speaker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-2);
}

.speaker img {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.track-name {
  font-size: 0.8125rem;
  color: var(--text-3);
  font-weight: 500;
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.level-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.lang-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: var(--surface-subtle);
  color: var(--text-3);
  border: 1px solid var(--border);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-faint);
}


.friend-avatars {
  display: flex;
  align-items: center;
  margin-left: auto;
  margin-right: 0.5rem;
}

.friend-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--surface-subtle);
  color: var(--accent);
  border: 2px solid var(--surface);
  margin-left: -0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.friend-avatar:first-child {
  margin-left: 0;
}

.friend-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.friend-overflow {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-4);
  margin-left: 0.25rem;
}

.bookmark-btn {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.bookmark-btn:hover {
  background: var(--surface-subtle);
  border-color: #f97316;
  color: #f97316;
}

.card.bookmarked .bookmark-btn {
  background: #f97316;
  border-color: #f97316;
  color: white;
}
</style>
