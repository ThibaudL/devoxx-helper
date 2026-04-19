<script setup>
import { ref } from 'vue'
import { useSharingStore } from '../stores/sharing'

const emit = defineEmits(['close'])
const sharing = useSharingStore()

const emailInput = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const submitting = ref(false)

async function submit() {
  errorMsg.value = ''
  successMsg.value = ''
  submitting.value = true
  try {
    await sharing.shareWith(emailInput.value)
    successMsg.value = 'Favoris partagés !'
    emailInput.value = ''
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    submitting.value = false
  }
}

function initials(profile) {
  if (profile?.full_name) return profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (profile?.email?.[0] ?? '?').toUpperCase()
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Partager mes favoris</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <!-- Add friend -->
      <div class="section">
        <p class="section-label">Partager avec un ami par email</p>
        <form class="add-row" @submit.prevent="submit">
          <input
            v-model="emailInput"
            type="email"
            placeholder="ami@example.com"
            class="email-input"
            :disabled="submitting"
          />
          <button type="submit" class="add-btn" :disabled="submitting || !emailInput.trim()">
            {{ submitting ? '…' : 'Partager' }}
          </button>
        </form>
        <p v-if="errorMsg" class="msg error">{{ errorMsg }}</p>
        <p v-if="successMsg" class="msg success">{{ successMsg }}</p>
      </div>

      <!-- Outgoing shares -->
      <div class="section" v-if="sharing.sharedWith.length">
        <p class="section-label">Vous partagez avec</p>
        <ul class="person-list">
          <li v-for="s in sharing.sharedWith" :key="s.id" class="person-row">
            <div class="avatar" :title="s.profile?.email">
              <img v-if="s.profile?.avatar_url" :src="s.profile.avatar_url" :alt="s.profile.full_name" />
              <span v-else>{{ initials(s.profile) }}</span>
            </div>
            <div class="person-info">
              <span class="person-name">{{ s.profile?.full_name || s.profile?.email }}</span>
              <span class="person-email">{{ s.profile?.email }}</span>
            </div>
            <button class="remove-btn" @click="sharing.removeShare(s.id)" title="Révoquer le partage">✕</button>
          </li>
        </ul>
      </div>

      <!-- Incoming shares -->
      <div class="section" v-if="sharing.sharedByMe.length">
        <p class="section-label">Favoris partagés avec vous par</p>
        <ul class="person-list">
          <li v-for="s in sharing.sharedByMe" :key="s.id" class="person-row incoming">
            <div class="avatar" :title="s.profile?.email">
              <img v-if="s.profile?.avatar_url" :src="s.profile.avatar_url" :alt="s.profile.full_name" />
              <span v-else>{{ initials(s.profile) }}</span>
            </div>
            <div class="person-info">
              <span class="person-name">{{ s.profile?.full_name || s.profile?.email }}</span>
              <span class="person-email">{{ s.profile?.email }}</span>
            </div>
          </li>
        </ul>
      </div>

      <p v-if="!sharing.sharedWith.length && !sharing.sharedByMe.length" class="empty-state">
        Aucun partage actif. Entrez l'email d'un ami pour commencer.
      </p>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: min(480px, 95vw);
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 { margin: 0; font-size: 1.1rem; }

.close-btn {
  border: none; background: none; font-size: 1rem;
  cursor: pointer; color: #6b7280; padding: 4px;
}
.close-btn:hover { color: #111; }

.section { display: flex; flex-direction: column; gap: 0.6rem; }

.section-label {
  font-size: 0.78rem; font-weight: 600;
  color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em;
  margin: 0;
}

.add-row { display: flex; gap: 0.5rem; }

.email-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
}
.email-input:focus { outline: none; border-color: #3b82f6; }

.add-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6; color: white;
  border: none; border-radius: 8px;
  font-size: 0.85rem; font-weight: 600;
  cursor: pointer; white-space: nowrap;
}
.add-btn:disabled { background: #93c5fd; cursor: default; }

.msg { font-size: 0.82rem; margin: 0; }
.msg.error   { color: #ef4444; }
.msg.success { color: #16a34a; }

.person-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }

.person-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.person-row.incoming { background: #f0fdf4; border-color: #bbf7d0; }

.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #dbeafe; color: #1d4ed8;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700;
  flex-shrink: 0; overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }

.person-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.person-name { font-size: 0.85rem; font-weight: 600; truncate: ellipsis; }
.person-email { font-size: 0.72rem; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.remove-btn {
  border: none; background: none;
  color: #9ca3af; cursor: pointer; font-size: 0.8rem; padding: 4px;
}
.remove-btn:hover { color: #ef4444; }

.empty-state { font-size: 0.85rem; color: #9ca3af; text-align: center; padding: 1rem 0; margin: 0; }
</style>
