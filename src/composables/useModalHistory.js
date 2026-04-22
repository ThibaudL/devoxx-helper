import { watch, onUnmounted } from 'vue'

export function useModalHistory(showModalRef) {
  const handlePopState = (event) => {
    // If the state doesn't have our flag, it means we navigated back past the modal push
    if (showModalRef.value && (!event.state || !event.state.modalOpen)) {
      showModalRef.value = false
    }
  }

  watch(showModalRef, (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      // Modal is opening
      window.history.pushState({ modalOpen: true }, '')
      window.addEventListener('popstate', handlePopState)
    } else if (!isOpen && wasOpen) {
      // Modal is closing manually (close button, overlay click)
      window.removeEventListener('popstate', handlePopState)
      // Only go back if we are the one who pushed the state
      if (window.history.state && window.history.state.modalOpen) {
        window.history.back()
      }
    }
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState)
  })
}
