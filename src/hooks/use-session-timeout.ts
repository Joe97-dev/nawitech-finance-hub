import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
const WARNING_BEFORE_MS = 60_000; // Show warning 1 minute before logout

const STORAGE_KEY = "session_timeout_minutes";

export function getSessionTimeoutMinutes(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 480; // default 8 hours
}

export function setSessionTimeoutMinutes(minutes: number) {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warningShownRef.current = false;
  }, []);

  const handleLogout = useCallback(() => {
    toast.info("You have been logged out due to inactivity.");
    logout();
  }, [logout]);

  const resetTimer = useCallback(() => {
    clearTimers();
    if (!isAuthenticated) return;

    const timeoutMs = getSessionTimeoutMinutes() * 60 * 1000;

    // Show warning before logout
    const warningMs = Math.max(timeoutMs - WARNING_BEFORE_MS, 0);
    warningRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast.warning("You will be logged out in 1 minute due to inactivity.", {
          duration: 10_000,
        });
      }
    }, warningMs);

    // Actual logout
    timeoutRef.current = setTimeout(handleLogout, timeoutMs);
  }, [isAuthenticated, clearTimers, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    // Throttle activity resets to avoid excessive timer resets
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledReset = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        resetTimer();
      }, 5000); // Only reset timer every 5 seconds max
    };

    resetTimer(); // Initial timer set

    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, throttledReset, { passive: true })
    );

    return () => {
      clearTimers();
      if (throttleTimer) clearTimeout(throttleTimer);
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, throttledReset)
      );
    };
  }, [isAuthenticated, resetTimer, clearTimers]);
}
