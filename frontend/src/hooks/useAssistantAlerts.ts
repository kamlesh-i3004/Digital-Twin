import { useEffect } from 'react';
import { toast } from 'sonner';
import type { AssistantDigest } from '@/types';

const SESSION_KEY = 'assistant_alerts_shown';

/**
 * Fires proactive toast alerts once per browser session based on the
 * daily digest data. Uses sessionStorage to avoid re-firing on re-renders.
 */
export function useAssistantAlerts(digest: AssistantDigest | null) {
  useEffect(() => {
    if (!digest) return;

    // Only fire once per session (cleared when tab closes)
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const alerts: Array<{ delay: number; fn: () => void }> = [];

    if (digest.overdue_count > 0) {
      alerts.push({
        delay: 600,
        fn: () =>
          toast.error(
            `⚠️ You have ${digest.overdue_count} overdue task${digest.overdue_count > 1 ? 's' : ''}! Take action now.`,
            { duration: 7000 }
          ),
      });
    }

    if (digest.due_today_count > 0) {
      alerts.push({
        delay: 1400,
        fn: () =>
          toast.warning(
            `📅 ${digest.due_today_count} task${digest.due_today_count > 1 ? 's are' : ' is'} due today`,
            { duration: 5500 }
          ),
      });
    }

    if (digest.due_tomorrow_count > 0) {
      alerts.push({
        delay: 2200,
        fn: () =>
          toast.info(
            `🔔 ${digest.due_tomorrow_count} task${digest.due_tomorrow_count > 1 ? 's' : ''} due tomorrow — plan ahead`,
            { duration: 4500 }
          ),
      });
    }

    // All caught up — only show if no other alerts
    if (alerts.length === 0) {
      alerts.push({
        delay: 600,
        fn: () =>
          toast.success("🎉 You're all caught up! No urgent tasks. Keep it up!", {
            duration: 4000,
          }),
      });
    }

    // Schedule all alerts; mark session as shown only after the first fires
    let marked = false;
    const timers = alerts.map(({ delay, fn }) =>
      setTimeout(() => {
        fn();
        if (!marked) {
          marked = true;
          sessionStorage.setItem(SESSION_KEY, 'true');
        }
      }, delay)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [digest]);
}

/**
 * Call this to reset the session flag (e.g. after logout)
 * so alerts fire again on next login.
 */
export function clearAssistantAlertsSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
