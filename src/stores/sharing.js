import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useSharingStore = defineStore('sharing', () => {
  const auth = useAuthStore()

  // Outgoing: people I've shared my favorites with [{ id, shared_with_id, profile }]
  const sharedWith = ref([])
  // Incoming: people who shared their favorites with me [{ id, owner_id, profile }]
  const sharedByMe = ref([])

  // Map<userId, Set<sessionId>> — bookmarked sessions from each friend
  const friendBookmarks = ref(new Map())
  // Map<userId, { email, full_name, avatar_url }>
  const friendProfiles = ref(new Map())

  async function fetchShares() {
    if (!auth.user) return

    const [{ data: outgoing }, { data: incoming }] = await Promise.all([
      supabase.from('friend_shares').select('id, shared_with_id').eq('owner_id', auth.user.id),
      supabase.from('friend_shares').select('id, owner_id').eq('shared_with_id', auth.user.id),
    ])

    const outIds = (outgoing ?? []).map(s => s.shared_with_id)
    const inIds  = (incoming ?? []).map(s => s.owner_id)
    const allIds = [...new Set([...outIds, ...inIds])]

    let profiles = []
    if (allIds.length) {
      const { data } = await supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', allIds)
      profiles = data ?? []
    }
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))

    sharedWith.value = (outgoing ?? []).map(s => ({ ...s, profile: profileMap[s.shared_with_id] }))
    sharedByMe.value = (incoming ?? []).map(s => ({ ...s, profile: profileMap[s.owner_id] }))

    const pmap = new Map()
    for (const p of profiles) pmap.set(p.id, p)
    friendProfiles.value = pmap
  }

  async function fetchFriendBookmarks() {
    if (!auth.user) return
    // RLS friend read policy lets us see friends' agenda_items
    const { data } = await supabase
      .from('agenda_items')
      .select('user_id, session_id')
      .neq('user_id', auth.user.id)

    const map = new Map()
    for (const item of data ?? []) {
      if (!map.has(item.user_id)) map.set(item.user_id, new Set())
      map.get(item.user_id).add(item.session_id)
    }
    friendBookmarks.value = map
  }

  async function shareWith(email) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) throw new Error('Email requis')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .ilike('email', trimmed)
      .single()

    if (error || !profile) throw new Error('Aucun compte trouvé pour cet email')
    if (profile.id === auth.user.id) throw new Error('Vous ne pouvez pas vous partager à vous-même')

    const { error: insertError } = await supabase
      .from('friend_shares')
      .insert({ owner_id: auth.user.id, shared_with_id: profile.id })

    if (insertError) {
      if (insertError.code === '23505') throw new Error('Déjà partagé avec cet utilisateur')
      throw insertError
    }

    await fetchShares()
  }

  async function removeShare(shareId) {
    await supabase.from('friend_shares').delete().eq('id', shareId)
    sharedWith.value = sharedWith.value.filter(s => s.id !== shareId)
  }

  function getFriendsForSession(sessionId) {
    const result = []
    for (const [userId, sessionIds] of friendBookmarks.value) {
      if (sessionIds.has(sessionId)) {
        result.push(friendProfiles.value.get(userId) ?? { email: '?' })
      }
    }
    return result
  }

  // All session IDs bookmarked by at least one friend
  const allFriendBookmarkedIds = computed(() => {
    const ids = new Set()
    for (const sessionIds of friendBookmarks.value.values()) {
      for (const id of sessionIds) ids.add(id)
    }
    return ids
  })

  return {
    sharedWith,
    sharedByMe,
    friendBookmarks,
    friendProfiles,
    allFriendBookmarkedIds,
    fetchShares,
    fetchFriendBookmarks,
    shareWith,
    removeShare,
    getFriendsForSession,
  }
})
