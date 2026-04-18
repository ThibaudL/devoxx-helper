<script setup>
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
</script>

<template>
  <RouterView v-if="!auth.loading" />
</template>
