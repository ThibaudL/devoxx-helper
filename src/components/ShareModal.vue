<script setup>
import { ref } from 'vue'
import { useSharingStore } from '../stores/sharing'

const emit = defineEmits(['close'])
const sharing = useSharingStore()

const newTeamName = ref('')
const creatingTeam = ref(false)
const createError = ref('')

const inviteEmail = ref({})   // { [teamId]: string }
const inviteError = ref({})   // { [teamId]: string }
const inviteOk    = ref({})   // { [teamId]: string }
const inviting    = ref({})   // { [teamId]: bool }

async function submitCreateTeam() {
  createError.value = ''
  creatingTeam.value = true
  try {
    await sharing.createTeam(newTeamName.value)
    newTeamName.value = ''
  } catch (e) {
    createError.value = e.message
  } finally {
    creatingTeam.value = false
  }
}

async function submitInvite(teamId) {
  inviteError.value = { ...inviteError.value, [teamId]: '' }
  inviteOk.value    = { ...inviteOk.value,    [teamId]: '' }
  inviting.value    = { ...inviting.value,    [teamId]: true }
  try {
    await sharing.inviteToTeam(teamId, inviteEmail.value[teamId] ?? '')
    inviteOk.value    = { ...inviteOk.value,    [teamId]: 'Invitation envoyée !' }
    inviteEmail.value = { ...inviteEmail.value, [teamId]: '' }
  } catch (e) {
    inviteError.value = { ...inviteError.value, [teamId]: e.message }
  } finally {
    inviting.value = { ...inviting.value, [teamId]: false }
  }
}

function initials(p) {
  if (p?.full_name) return p.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (p?.email?.[0] ?? '?').toUpperCase()
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Équipes</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <!-- Teams list -->
      <div v-for="team in sharing.teams" :key="team.id" class="team-block">
        <div class="team-title-row">
          <span class="team-name">{{ team.name }}</span>
          <button class="leave-btn" @click="sharing.leaveTeam(team.id)">Quitter</button>
        </div>

        <!-- Members -->
        <ul class="person-list">
          <li v-for="m in team.members" :key="m.id" class="person-row">
            <div class="avatar" :title="m.profile?.email">
              <img v-if="m.profile?.avatar_url" :src="m.profile.avatar_url" :alt="m.profile?.full_name" />
              <span v-else>{{ initials(m.profile) }}</span>
            </div>
            <div class="person-info">
              <span class="person-name">{{ m.profile?.full_name || m.profile?.email }}</span>
              <span class="person-email">{{ m.profile?.email }}</span>
            </div>
          </li>
        </ul>

        <!-- Invite to this team -->
        <form class="invite-row" @submit.prevent="submitInvite(team.id)">
          <input
            :value="inviteEmail[team.id] ?? ''"
            @input="inviteEmail = { ...inviteEmail, [team.id]: $event.target.value }"
            type="email"
            placeholder="Inviter par email…"
            class="email-input"
            :disabled="inviting[team.id]"
          />
          <button
            type="submit"
            class="invite-btn"
            :disabled="inviting[team.id] || !(inviteEmail[team.id] ?? '').trim()"
          >{{ inviting[team.id] ? '…' : 'Inviter' }}</button>
        </form>
        <p v-if="inviteError[team.id]" class="msg error">{{ inviteError[team.id] }}</p>
        <p v-if="inviteOk[team.id]"    class="msg success">{{ inviteOk[team.id] }}</p>
      </div>

      <p v-if="!sharing.teams.length" class="empty-state">
        Vous n'êtes dans aucune équipe. Créez-en une ci-dessous.
      </p>

      <!-- Create team -->
      <div class="section create-section">
        <p class="section-label">Créer une équipe</p>
        <form class="add-row" @submit.prevent="submitCreateTeam">
          <input
            v-model="newTeamName"
            type="text"
            placeholder="Nom de l'équipe…"
            class="email-input"
            :disabled="creatingTeam"
          />
          <button type="submit" class="add-btn" :disabled="creatingTeam || !newTeamName.trim()">
            {{ creatingTeam ? '…' : 'Créer' }}
          </button>
        </form>
        <p v-if="createError" class="msg error">{{ createError }}</p>
      </div>
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
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.close-btn { border: none; background: none; font-size: 1rem; cursor: pointer; color: #6b7280; padding: 4px; }
.close-btn:hover { color: #111; }

.team-block {
  display: flex; flex-direction: column; gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.team-title-row {
  display: flex; justify-content: space-between; align-items: center;
}
.team-name { font-weight: 700; font-size: 0.95rem; }
.leave-btn {
  font-size: 0.75rem; color: #ef4444;
  border: 1px solid #fca5a5; border-radius: 6px;
  background: white; cursor: pointer; padding: 2px 8px;
}
.leave-btn:hover { background: #fef2f2; }

.person-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.person-row { display: flex; align-items: center; gap: 0.6rem; }

.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #dbeafe; color: #1d4ed8;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700;
  flex-shrink: 0; overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }

.person-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.person-name { font-size: 0.82rem; font-weight: 600; }
.person-email { font-size: 0.7rem; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.invite-row { display: flex; gap: 0.4rem; margin-top: 0.25rem; }
.email-input {
  flex: 1; padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db; border-radius: 7px; font-size: 0.85rem;
}
.email-input:focus { outline: none; border-color: #3b82f6; }

.invite-btn {
  padding: 0.4rem 0.8rem;
  background: #3b82f6; color: white;
  border: none; border-radius: 7px;
  font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.invite-btn:disabled { background: #93c5fd; cursor: default; }

.msg { font-size: 0.78rem; margin: 0; }
.msg.error   { color: #ef4444; }
.msg.success { color: #16a34a; }

.section { display: flex; flex-direction: column; gap: 0.6rem; }
.create-section {
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
}
.section-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; }

.add-row { display: flex; gap: 0.5rem; }
.add-btn {
  padding: 0.4rem 0.9rem;
  background: #3b82f6; color: white;
  border: none; border-radius: 7px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.add-btn:disabled { background: #93c5fd; cursor: default; }

.empty-state { font-size: 0.85rem; color: #9ca3af; text-align: center; padding: 0.5rem 0; margin: 0; }
</style>
