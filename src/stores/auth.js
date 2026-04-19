import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  let _resolve
  const ready = new Promise(r => { _resolve = r })

  function init() {
    supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user ?? null
      if (loading.value) {
        loading.value = false
        _resolve()
      }
      if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    })
    return ready
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, loading, ready, init, signInWithGoogle, signOut }
})
