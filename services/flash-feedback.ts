import { useSyncExternalStore } from "react";

type FlashFeedback = {
  id: number;
  message: string;
  type: "success" | "error";
} | null;

let flashFeedbackState: FlashFeedback = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setFlashFeedback(next: FlashFeedback) {
  flashFeedbackState = next;
  emit();
}

export function clearFlashFeedback() {
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }

  setFlashFeedback(null);
}

export function showFlashFeedback(
  message: string,
  type: "success" | "error" = "success",
  durationMs = 2200,
) {
  clearFlashFeedback();
  setFlashFeedback({
    id: Date.now(),
    message,
    type,
  });

  flashTimer = setTimeout(() => {
    flashTimer = null;
    setFlashFeedback(null);
  }, durationMs);
}

export function useFlashFeedback() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => flashFeedbackState,
    () => flashFeedbackState,
  );
}
