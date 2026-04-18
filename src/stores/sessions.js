import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref([])
  const bookmarkedIds = ref(new Set())
  const loading = ref(false)

  const auth = useAuthStore()

  async function fetchSessions() {
    loading.value = true
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('start_time')
    sessions.value = data ?? []
    loading.value = false
  }

  async function fetchBookmarks() {
    if (!auth.user) return
    const { data } = await supabase
      .from('agenda_items')
      .select('session_id')
      .eq('user_id', auth.user.id)
    bookmarkedIds.value = new Set((data ?? []).map(r => r.session_id))
  }

  async function toggleBookmark(sessionId) {
    if (!auth.user) return
    if (bookmarkedIds.value.has(sessionId)) {
      bookmarkedIds.value.delete(sessionId)
      await supabase
        .from('agenda_items')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('session_id', sessionId)
    } else {
      bookmarkedIds.value.add(sessionId)
      await supabase
        .from('agenda_items')
        .insert({ user_id: auth.user.id, session_id: sessionId })
    }
    bookmarkedIds.value = new Set(bookmarkedIds.value)
  }

  const tracks = computed(() => [...new Set(sessions.value.map(s => s.track).filter(Boolean))].sort())

  return { sessions, bookmarkedIds, loading, tracks, fetchSessions, fetchBookmarks, toggleBookmark }
})
