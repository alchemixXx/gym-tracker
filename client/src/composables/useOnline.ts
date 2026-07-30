import { ref, onMounted, onUnmounted } from 'vue';

const isOnline = ref(navigator.onLine);

function update() {
  isOnline.value = navigator.onLine;
}

// Global listeners (only added once)
let listenersAdded = false;
function ensureListeners() {
  if (listenersAdded) return;
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  listenersAdded = true;
}

/**
 * Reactive online/offline state.
 * Shared across all components — single source of truth.
 */
export function useOnline() {
  ensureListeners();
  return { isOnline };
}
