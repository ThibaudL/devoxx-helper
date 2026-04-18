import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const CFP_BASE = 'https://devoxxfr2026.cfp.dev/api/public'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DAYS = ['wednesday', 'thursday', 'friday']

async function fetchDay(day) {
  const res = await fetch(`${CFP_BASE}/schedules/${day}`)
  return res.json()
}

function toSession(slot, day) {
  const isPause = slot.sessionType?.pause === true

  // breaks: no proposal, use slot id as key
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

  // keynote simulcast rooms without a proposal
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
        language: null,
        audience_level: null,
        day,
        is_break: false,
      }
    }
    return null
  }

  return {
    id: String(slot.proposal.id),
    title: slot.proposal.title,
    description: slot.proposal.description ?? null,
    speakers: slot.speakers.map(s => s.fullName),
    speaker_images: slot.speakers.map(s => s.imageUrl ?? ''),
    room: slot.room?.name ?? null,
    room_weight: slot.room?.weight ?? null,
    start_time: slot.fromDate,
    end_time: slot.toDate,
    track: slot.track?.name ?? null,
    format: slot.sessionType?.name ?? null,
    language: slot.langName ?? null,
    audience_level: slot.audienceLevel ?? null,
    day,
    is_break: false,
  }
}

async function main() {
  const sessions = []

  for (const day of DAYS) {
    console.log(`Fetching ${day}...`)
    const slots = await fetchDay(day)
    for (const slot of slots) {
      const session = toSession(slot, day)
      if (session) sessions.push(session)
    }
  }

  console.log(`Upserting ${sessions.length} sessions...`)
  const { error } = await supabase.from('sessions').upsert(sessions, { onConflict: 'id' })
  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }
  console.log('Done.')
}

main()
