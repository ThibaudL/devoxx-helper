<script setup>
import { ref } from 'vue'
import { useSharingStore } from '../stores/sharing'
import { useSessionsStore } from '../stores/sessions'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits(['close'])
const sharing = useSharingStore()
const sessions = useSessionsStore()
const auth = useAuthStore()

function bookmarkCount(userId) {
  if (userId === auth.user?.id) return sessions.bookmarkedIds.size
  return sharing.friendBookmarks.get(userId)?.size ?? 0
}

const newTeamName = ref('')
const creatingTeam = ref(false)
const createError = ref('')

const inviteEmail = ref({})   // { [teamId]: string }
const inviteError = ref({})   // { [teamId]: string }
const inviteOk    = ref({})   // { [teamId]: string }
const inviting    = ref({})   // { [teamId]: bool }

const linkCopied  = ref({})   // { [teamId]: bool }
const linkError   = ref({})   // { [teamId]: string }

async function copyInviteLink(teamId) {
  linkCopied.value = { ...linkCopied.value, [teamId]: false }
  linkError.value  = { ...linkError.value,  [teamId]: '' }
  try {
    const url = await sharing.generateInviteLink(teamId)
    await navigator.clipboard.writeText(url)
    linkCopied.value = { ...linkCopied.value, [teamId]: true }
    setTimeout(() => { linkCopied.value = { ...linkCopied.value, [teamId]: false } }, 2500)
  } catch (e) {
    linkError.value = { ...linkError.value, [teamId]: e.message }
  }
}

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
            <span class="bookmark-count" :title="`${bookmarkCount(m.user_id)} favori(s)`">
              ★ {{ bookmarkCount(m.user_id) }}
            </span>
          </li>
        </ul>

        <!-- Copy invite link -->
        <div class="link-row">
          <button class="link-btn" @click="copyInviteLink(team.id)">
            {{ linkCopied[team.id] ? 'Lien copié !' : 'Copier le lien d\'invitation' }}
          </button>
          <p v-if="linkError[team.id]" class="msg error">{{ linkError[team.id] }}</p>
        </div>

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
  background: var(--surface);
  border-radius: 12px;
  padding: 1.5rem;
  width: min(480px, 95vw);
  max-height: 85vh;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 1.25rem;
  box-shadow: var(--shadow-lg);
}

.modal-header { display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.1rem; color: var(--text-1); }
.close-btn { border: none; background: none; font-size: 1rem; cursor: pointer; color: var(--text-3); padding: 4px; }
.close-btn:hover { color: var(--text-1); }

.team-block {
  display: flex; flex-direction: column; gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.team-title-row { display: flex; justify-content: space-between; align-items: center; }
.team-name { font-weight: 700; font-size: 0.95rem; color: var(--text-1); }
.leave-btn {
  font-size: 0.75rem; color: #ef4444;
  border: 1px solid #fca5a5; border-radius: 6px;
  background: var(--surface); cursor: pointer; padding: 2px 8px;
}
.leave-btn:hover { background: var(--surface-subtle); }

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

.person-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }

.bookmark-count {
  margin-left: auto;
  font-size: 0.75rem; font-weight: 700;
  color: #f59e0b;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.person-name { font-size: 0.82rem; font-weight: 600; color: var(--text-1); }
.person-email { font-size: 0.7rem; color: var(--text-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.link-row { display: flex; flex-direction: column; gap: 0.25rem; }
.link-btn {
  align-self: flex-start;
  padding: 0.35rem 0.8rem;
  background: var(--surface-subtle); color: var(--text-2);
  border: 1px solid var(--border); border-radius: 7px;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
}
.link-btn:hover { background: var(--border); }

.invite-row { display: flex; gap: 0.4rem; margin-top: 0.25rem; }
.email-input {
  flex: 1; padding: 0.4rem 0.6rem;
  border: 1px solid var(--border); border-radius: 7px; font-size: 0.85rem;
  background: var(--surface); color: var(--text-1);
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
.create-section { padding-top: 0.75rem; border-top: 1px solid var(--border-faint); }
.section-label { font-size: 0.75rem; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; margin: 0; }

.add-row { display: flex; gap: 0.5rem; }
.add-btn {
  padding: 0.4rem 0.9rem;
  background: #3b82f6; color: white;
  border: none; border-radius: 7px;
  font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.add-btn:disabled { background: #93c5fd; cursor: default; }

.empty-state { font-size: 0.85rem; color: var(--text-4); text-align: center; padding: 0.5rem 0; margin: 0; }

@media (max-width: 480px) {
  .overlay { padding: 0; }
  .modal { width: 100%; height: 100%; max-height: 100vh; border-radius: 0; padding: 1.25rem; gap: 1rem; }
  .modal-header h2 { font-size: 1rem; }
  .invite-row { flex-direction: column; }
  .invite-btn { width: 100%; }
}
</style>
