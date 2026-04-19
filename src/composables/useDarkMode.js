import { ref, watchEffect } from 'vue'

const dark = ref(document.documentElement.classList.contains('dark'))

watchEffect(() => {
  document.documentElement.classList.toggle('dark', dark.value)
  localStorage.setItem('devoxx-theme', dark.value ? 'dark' : 'light')
})

export function useDarkMode() {
  function toggle() { dark.value = !dark.value }
  return { dark, toggle }
}
