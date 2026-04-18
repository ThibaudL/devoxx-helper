<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="agenda">
    <header>
      <h1>Devoxx Helper</h1>
      <div class="user-info">
        <img v-if="auth.user?.user_metadata?.avatar_url" :src="auth.user.user_metadata.avatar_url" alt="avatar" />
        <span>{{ auth.user?.user_metadata?.full_name }}</span>
        <button @click="handleSignOut">Sign out</button>
      </div>
    </header>
    <main>
      <p>Agenda coming soon...</p>
    </main>
  </div>
</template>

<style scoped>
.agenda {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-info img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

button {
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
}
</style>
