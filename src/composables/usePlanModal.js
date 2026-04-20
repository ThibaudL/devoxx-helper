import { ref } from 'vue'

const show = ref(false)
const room = ref(null)

export function usePlanModal() {
  function openPlan(roomName = null) {
    room.value = roomName ?? null
    show.value = true
  }
  function closePlan() {
    show.value = false
    room.value = null
  }
  return { showPlanModal: show, planRoom: room, openPlan, closePlan }
}
