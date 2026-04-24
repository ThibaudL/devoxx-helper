import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

const DAYS = ['wednesday', 'thursday', 'friday']

function toSession(slot, day) {
  const isPause = slot.sessionType?.pause === true

  if (isPause) {
    return {
      id: `break-${slot.id}`,
      title: slot.sessionType?.name ?? 'Break',
      description: null,
      speakers: [],
      speaker_images: [],
      room: slot.room?.name ?? null,
      room_weight: slot.room?.weight ?? null,
      start_time: slot.fromDate,
      end_time: slot.toDate,
      track: null,
      format: slot.sessionType?.name ?? null,
      language: null,
      audience_level: null,
      day,
      is_break: true,
    }
  }

  if (!slot.proposal) {
    if (slot.sessionType?.name === 'Keynote') {
      return {
        id: `keynote-slot-${slot.id}`,
        title: 'À déterminer',
        description: null,
        speakers: [],
        speaker_images: [],
        room: slot.room?.name ?? null,
        room_weight: slot.room?.weight ?? null,
        start_time: slot.fromDate,
        end_time: slot.toDate,
        track: null,
        format: 'Keynote',
        format_color: slot.sessionType?.cssColor ?? null,
        language: null,
        audience_level: null,
        day,
        is_break: false,
      }
    }
    return null
  }

  const proposalSpeakers = slot.proposal.speakers ?? []
  return {
    id: String(slot.proposal.id),
    title: slot.proposal.title,
    description: slot.proposal.description ?? null,
    speakers: proposalSpeakers.map(s => s.fullName),
    speaker_images: proposalSpeakers.map(s => s.imageUrl ?? ''),
    speaker_data: proposalSpeakers,
    keywords: (slot.proposal.keywords ?? []).map(k => k.name),
    room: slot.room?.name ?? null,
    room_weight: slot.room?.weight ?? null,
    start_time: slot.fromDate,
    end_time: slot.toDate,
    track: slot.proposal.track?.name ?? null,
    format: slot.sessionType?.name ?? null,
    format_color: slot.sessionType?.cssColor ?? null,
    language: slot.proposal.language?.alpha2?.toUpperCase() ?? null,
    audience_level: slot.proposal.audienceLevel ?? null,
    total_favourites: slot.totalFavourites ?? 0,
    day,
    is_break: false,
  }
}

// Keynote simulcasts: one slot has the proposal, other rooms have empty keynote
// slots at the same time. Copy the real data onto placeholders and give them all
// the same group_key so the UI can render them as one wide overlapping card.
function linkKeynoteSimulcasts(sessions) {
  const byTimeDay = new Map()
  for (const s of sessions) {
    if (s.format === 'Keynote' && !s.is_break && s.title !== 'À déterminer') {
      byTimeDay.set(`${s.day}|${s.start_time}`, s)
    }
  }
  for (const s of sessions) {
    if (s.format !== 'Keynote' || s.is_break) continue
    const real = byTimeDay.get(`${s.day}|${s.start_time}`)
    if (!real) continue
    s.group_key = real.id
    if (s.title === 'À déterminer') {
      s.title = real.title
      s.description = real.description
      s.speakers = real.speakers
      s.speaker_images = real.speaker_images
      s.speaker_data = real.speaker_data
      s.keywords = real.keywords
      s.track = real.track
      s.language = real.language
      s.audience_level = real.audience_level
      s.total_favourites = real.total_favourites
      s.format_color = real.format_color
      s.simulcast = true
    }
  }
}

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref([])
  const bookmarkedIds = ref(new Set())
  const notes = ref(new Map()) // sessionId → note text
  const loading = ref(false)

  const auth = useAuthStore()

  async function fetchSessions() {
    loading.value = true
    const results = await Promise.all(
      DAYS.map(day =>
        fetch(`/api/schedule/${day}`)
          .then(r => r.json())
          .then(slots => slots.map(s => toSession(s, day)).filter(Boolean))
      )
    )
    const all = results.flat()
    linkKeynoteSimulcasts(all)
    sessions.value = all
    loading.value = false
  }

  async function fetchBookmarks() {
    if (!auth.user) return
    const { data } = await supabase
      .from('agenda_items')
      .select('session_id, note')
      .eq('user_id', auth.user.id)
    bookmarkedIds.value = new Set((data ?? []).map(r => r.session_id))
    notes.value = new Map((data ?? []).filter(r => r.note).map(r => [r.session_id, r.note]))
  }

  async function saveNote(sessionId, text) {
    if (!auth.user) return
    const trimmed = text.trim()
    if (trimmed) {
      notes.value = new Map(notes.value).set(sessionId, trimmed)
    } else {
      const m = new Map(notes.value)
      m.delete(sessionId)
      notes.value = m
    }
    await supabase
      .from('agenda_items')
      .update({ note: trimmed || null })
      .eq('user_id', auth.user.id)
      .eq('session_id', sessionId)
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

  return { sessions, bookmarkedIds, notes, loading, tracks, fetchSessions, fetchBookmarks, toggleBookmark, saveNote }
})
