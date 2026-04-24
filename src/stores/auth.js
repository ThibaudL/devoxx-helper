import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const planningNote = ref('')
  let _resolve
  const ready = new Promise(r => { _resolve = r })

  function init() {
    supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user ?? null
      if (loading.value) {
        loading.value = false
        _resolve()
      }
      if (event === 'SIGNED_IN') {
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname)
        }
        fetchPlanningNote()
      }
      if (event === 'SIGNED_OUT') planningNote.value = ''
    })
    return ready
  }

  async function fetchPlanningNote() {
    if (!user.value) return
    const { data } = await supabase
      .from('profiles')
      .select('planning_note')
      .eq('id', user.value.id)
      .single()
    planningNote.value = data?.planning_note ?? ''
  }

  async function savePlanningNote(text) {
    if (!user.value) return
    planningNote.value = text
    await supabase
      .from('profiles')
      .update({ planning_note: text || null })
      .eq('id', user.value.id)
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

  return { user, loading, ready, planningNote, init, signInWithGoogle, signOut, fetchPlanningNote, savePlanningNote }
})
