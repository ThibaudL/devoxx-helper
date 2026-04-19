<script setup>
import { computed } from 'vue'
import { useSessionsStore } from '../stores/sessions'

const props = defineProps({
  session: { type: Object, default: null },
  friends: { type: Array, default: () => [] },
})
const emit = defineEmits(['close'])

function initials(p) {
  if (p?.full_name) return p.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (p?.email?.[0] ?? '?').toUpperCase()
}

const store = useSessionsStore()
const isBookmarked = computed(() => props.session && store.bookmarkedIds.has(props.session.id))

const DAY_LABELS = { wednesday: 'Mercredi 22 avril', thursday: 'Jeudi 23 avril', friday: 'Vendredi 24 avril' }

function formatRange(start, end) {
  const fmt = iso => new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  })
  return `${fmt(start)} – ${fmt(end)}`
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="session" class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog">
        <button class="close-btn" @click="emit('close')">✕</button>

        <!-- header -->
        <div class="modal-header">
          <div class="badges">
            <span v-if="session.format" class="badge format">{{ session.format }}</span>
            <span v-if="session.track" class="badge track">{{ session.track }}</span>
            <span v-if="session.audience_level" class="badge level">{{ session.audience_level }}</span>
            <span v-if="session.language" class="badge lang">{{ session.language }}</span>
          </div>
          <h2>{{ session.title }}</h2>
          <div class="meta">
            <span>📅 {{ DAY_LABELS[session.day] }}</span>
            <span>🕐 {{ formatRange(session.start_time, session.end_time) }}</span>
            <span v-if="session.room">📍 {{ session.room }}</span>
          </div>
        </div>

        <!-- speakers -->
        <div v-if="session.speakers?.length" class="speakers">
          <div v-for="(name, i) in session.speakers" :key="i" class="speaker">
            <img
              v-if="session.speaker_images?.[i]"
              :src="session.speaker_images[i]"
              :alt="name"
              class="speaker-avatar"
            />
            <span class="speaker-name">{{ name }}</span>
          </div>
        </div>

        <!-- description -->
        <div
          v-if="session.description"
          class="description"
          v-html="session.description"
        />

        <!-- team members who bookmarked this -->
        <div v-if="friends.length" class="friends-section">
          <p class="friends-label">Dans l'agenda de</p>
          <div class="friends-list">
            <div v-for="(f, i) in friends" :key="i" class="friend-chip">
              <div class="friend-avatar">
                <img v-if="f?.avatar_url" :src="f.avatar_url" :alt="f?.full_name" />
                <span v-else>{{ initials(f) }}</span>
              </div>
              <span class="friend-name">{{ f?.full_name || f?.email }}</span>
            </div>
          </div>
        </div>

        <!-- footer -->
        <div class="modal-footer">
          <button
            class="bookmark-btn"
            :class="{ active: isBookmarked }"
            @click="store.toggleBookmark(session.id)"
          >
            {{ isBookmarked ? '★ Dans mon agenda' : '☆ Ajouter à mon agenda' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: 12px;
  width: 100%; max-width: 640px; max-height: 90vh;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 1.25rem;
  padding: 1.75rem;
  position: relative;
  box-shadow: var(--shadow-lg);
}

.close-btn {
  position: absolute; top: 1rem; right: 1rem;
  border: none;
  background: var(--surface-subtle);
  border-radius: 50%;
  width: 28px; height: 28px;
  cursor: pointer; font-size: 0.8rem;
  color: var(--text-3);
  display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { background: var(--border); }

.modal-header { display: flex; flex-direction: column; gap: 0.6rem; }
.badges { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.badge { font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
.badge.format { background: #dbeafe; color: #1d4ed8; }
.badge.track  { background: #d1fae5; color: #065f46; }
.badge.level  { background: #fef9c3; color: #92400e; }
.badge.lang   { background: var(--surface-subtle); color: var(--text-2); }

h2 { font-size: 1.2rem; font-weight: 700; color: var(--text-1); line-height: 1.3; margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.82rem; color: var(--text-3); }

.speakers {
  display: flex; flex-wrap: wrap; gap: 0.75rem;
  border-top: 1px solid var(--border-faint); padding-top: 1rem;
}
.speaker { display: flex; align-items: center; gap: 0.5rem; }
.speaker-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.speaker-name { font-size: 0.88rem; font-weight: 600; color: var(--text-1); }

.description {
  font-size: 0.88rem; line-height: 1.6; color: var(--text-2);
  border-top: 1px solid var(--border-faint); padding-top: 1rem;
}
.description :deep(ul) { padding-left: 1.2rem; margin: 0.5rem 0; }
.description :deep(li) { margin-bottom: 0.25rem; }
.description :deep(strong) { color: var(--text-1); }

.friends-section { border-top: 1px solid var(--border-faint); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.friends-label { font-size: 0.72rem; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; margin: 0; }
.friends-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.friend-chip { display: flex; align-items: center; gap: 0.4rem; background: var(--surface-subtle); border-radius: 999px; padding: 3px 10px 3px 3px; }
.friend-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: #dbeafe; color: #1d4ed8;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; font-weight: 700; overflow: hidden; flex-shrink: 0;
}
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-name { font-size: 0.78rem; font-weight: 500; color: var(--text-2); white-space: nowrap; }

.modal-footer { border-top: 1px solid var(--border-faint); padding-top: 1rem; }

.bookmark-btn {
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  border: 2px solid #f97316;
  background: var(--surface);
  color: #f97316;
  font-size: 0.9rem; font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.bookmark-btn.active { background: #f97316; color: white; }
</style>
