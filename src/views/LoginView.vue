<script setup>
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="login">
    <h1>Devoxx Helper</h1>
    <p>Share your agenda with your team</p>
    <button @click="auth.signInWithGoogle()">Sign in with Google</button>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
}

button:hover {
  background: #f5f5f5;
}
</style>
