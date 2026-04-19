import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useSharingStore = defineStore('sharing', () => {
  const auth = useAuthStore()

  // [{ id, name, created_by, members: [{ id, user_id, profile }] }]
  const teams = ref([])

  // Map<userId, Set<sessionId>>
  const friendBookmarks = ref(new Map())
  // Map<userId, { id, email, full_name, avatar_url }>
  const friendProfiles = ref(new Map())

  async function fetchTeams() {
    if (!auth.user) return

    const { data: myMemberships } = await supabase
      .from('team_members')
      .select('team_id')

    if (!myMemberships?.length) { teams.value = []; return }

    const teamIds = myMemberships.map(r => r.team_id)

    const [{ data: teamRows }, { data: memberRows }] = await Promise.all([
      supabase.from('teams').select('id, name, created_by').in('id', teamIds),
      supabase.from('team_members').select('id, team_id, user_id').in('team_id', teamIds),
    ])

    const allUserIds = [...new Set((memberRows ?? []).map(m => m.user_id))]
    const profileMap = new Map()
    if (allUserIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', allUserIds)
      for (const p of profiles ?? []) profileMap.set(p.id, p)
    }

    teams.value = (teamRows ?? []).map(t => ({
      ...t,
      members: (memberRows ?? [])
        .filter(m => m.team_id === t.id)
        .map(m => ({ ...m, profile: profileMap.get(m.user_id) })),
    }))

    const fp = new Map()
    for (const [uid, p] of profileMap) {
      if (uid !== auth.user.id) fp.set(uid, p)
    }
    friendProfiles.value = fp
  }

  async function fetchFriendBookmarks() {
    if (!auth.user) return
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

  async function createTeam(name) {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Nom requis')
    const { data, error } = await supabase.rpc('create_team', { team_name: trimmed })
    if (error) throw error
    await fetchTeams()
    return data
  }

  async function inviteToTeam(teamId, email) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) throw new Error('Email requis')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', trimmed)
      .single()

    if (error || !profile) throw new Error('Aucun compte trouvé pour cet email')
    if (profile.id === auth.user.id) throw new Error('Vous êtes déjà dans cette équipe')

    const { error: insertError } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: profile.id, invited_by: auth.user.id })

    if (insertError) {
      if (insertError.code === '23505') throw new Error('Cet utilisateur est déjà dans l\'équipe')
      throw insertError
    }

    await fetchTeams()
  }

  async function leaveTeam(teamId) {
    await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', auth.user.id)
    await fetchTeams()
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

  const allFriendBookmarkedIds = computed(() => {
    const ids = new Set()
    for (const sessionIds of friendBookmarks.value.values()) {
      for (const id of sessionIds) ids.add(id)
    }
    return ids
  })

  return {
    teams,
    friendBookmarks,
    friendProfiles,
    allFriendBookmarkedIds,
    fetchTeams,
    fetchFriendBookmarks,
    createTeam,
    inviteToTeam,
    leaveTeam,
    getFriendsForSession,
  }
})
