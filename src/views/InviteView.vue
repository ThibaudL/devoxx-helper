<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSharingStore } from '../stores/sharing'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()
const sharing = useSharingStore()
const auth = useAuthStore()

const token = route.params.token
const teamName = ref('')
const loading = ref(true)
const joining = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const info = await sharing.getInviteInfo(token)
    if (!info) { error.value = 'Lien d\'invitation invalide.'; return }
    if (!info.valid) { error.value = 'Ce lien d\'invitation a expiré.'; return }
    teamName.value = info.team_name
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function join() {
  joining.value = true
  error.value = ''
  try {
    await sharing.joinTeamByToken(token)
    router.push('/')
  } catch (e) {
    error.value = e.message
    joining.value = false
  }
}

function loginAndReturn() {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  })
}
</script>

<template>
  <div class="invite-page">
    <div class="card">
      <div class="logo">Devoxx Helper</div>

      <template v-if="loading">
        <p class="hint">Chargement…</p>
      </template>

      <template v-else-if="error">
        <p class="err">{{ error }}</p>
        <a href="/" class="btn secondary">Retour à l'accueil</a>
      </template>

      <template v-else>
        <p class="label">Vous avez été invité à rejoindre</p>
        <h2 class="team-name">{{ teamName }}</h2>

        <template v-if="auth.user">
          <button class="btn primary" :disabled="joining" @click="join">
            {{ joining ? 'Rejoindre…' : 'Rejoindre l\'équipe' }}
          </button>
        </template>
        <template v-else>
          <p class="hint">Connectez-vous pour rejoindre cette équipe.</p>
          <button class="btn primary" @click="loginAndReturn">Se connecter avec Google</button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.invite-page {
  min-height: 100dvh;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg);
  padding: 1rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 2rem 2.5rem;
  width: min(420px, 100%);
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.logo { font-weight: 800; font-size: 1.1rem; color: var(--text-3); letter-spacing: -0.02em; }

.label { font-size: 0.85rem; color: var(--text-3); margin: 0; }
.team-name { font-size: 1.5rem; font-weight: 800; color: var(--text-1); margin: 0; }
.hint { font-size: 0.85rem; color: var(--text-3); margin: 0; }
.err { font-size: 0.9rem; color: #ef4444; margin: 0; }

.btn {
  padding: 0.55rem 1.5rem;
  border: none; border-radius: 8px;
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
  text-decoration: none;
  display: inline-block;
}
.btn:disabled { opacity: 0.6; cursor: default; }
.btn.primary { background: #3b82f6; color: white; }
.btn.primary:hover:not(:disabled) { background: #2563eb; }
.btn.secondary { background: var(--surface-subtle); color: var(--text-2); border: 1px solid var(--border); }
.btn.secondary:hover { background: var(--border); }
</style>
