<script setup>
import { computed, ref } from 'vue'
import { useSessionsStore } from '../stores/sessions'
import { LEVEL_STYLE } from '../utils/sessionTags'
import SessionModal from './SessionModal.vue'

const props = defineProps({
  session: { type: Object, required: true },
  friends: { type: Array, default: () => [] },
})

const store = useSessionsStore()
const isBookmarked = computed(() => store.bookmarkedIds.has(props.session.id))
const showModal = ref(false)

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
      <span class="room">{{ session.room }}</span>
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
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface);
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
}

.card:hover { box-shadow: var(--shadow-md); }
.card.bookmarked { border-color: #f97316; background: color-mix(in srgb, #f97316 8%, var(--surface)); }

.card-header { display: flex; gap: 0.4rem; flex-wrap: wrap; }

.tag {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-subtle);
  color: var(--text-3);
}
.tag.format { background: #dbeafe; color: #1d4ed8; }
.tag.day    { background: #f3e8ff; color: #6b21a8; margin-left: auto; }

h3 { font-size: 0.95rem; font-weight: 600; margin: 0; line-height: 1.3; color: var(--text-1); }

.speakers { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.speaker { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--text-3); }
.speaker img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
  gap: 0.4rem;
}

.friend-avatars { display: flex; align-items: center; margin-left: auto; margin-right: 0.3rem; }

.friend-avatar {
  width: 20px; height: 20px; border-radius: 50%;
  background: #dbeafe; color: #1d4ed8;
  border: 1.5px solid var(--surface);
  margin-left: -4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.55rem; font-weight: 700;
  overflow: hidden; flex-shrink: 0;
}
.friend-avatar:first-child { margin-left: 0; }
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-overflow { font-size: 0.65rem; color: var(--text-4); margin-left: 2px; }

.card-meta {
  display: flex; flex-direction: column; gap: 0.3rem;
  margin-top: auto; padding-top: 0.25rem;
}

.track-name { font-size: 0.72rem; color: var(--text-3); }

.card-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.level-badge {
  font-size: 0.62rem; font-weight: 700;
  padding: 2px 7px; border-radius: 4px;
  text-transform: uppercase; letter-spacing: 0.03em;
  white-space: nowrap;
}

.lang-badge {
  font-size: 0.62rem; font-weight: 700;
  padding: 2px 7px; border-radius: 4px;
  background: #e0f2fe; color: #0369a1;
  text-transform: uppercase;
}

.room { font-size: 0.75rem; color: var(--text-4); }

.bookmark-btn {
  font-size: 0.8rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid #f97316;
  border-radius: 6px;
  background: var(--surface);
  color: #f97316;
  cursor: pointer;
  transition: background 0.15s;
}
.card.bookmarked .bookmark-btn { background: #f97316; color: white; }
</style>
