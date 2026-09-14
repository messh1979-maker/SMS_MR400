export type ToastItem = { text: string; error?: boolean };

type Listener = (toast: ToastItem | null) => void;

let current: ToastItem | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(current));
}

export function showToast(text: string, error = false) {
  current = { text, error };
  emit();
  window.setTimeout(() => {
    current = null;
    emit();
  }, 3200);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}