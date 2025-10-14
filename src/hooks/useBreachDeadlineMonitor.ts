// src/hooks/useBreachDeadlineMonitor.ts
// Monitors breach deadlines and sends notifications

import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { getHoursUntilDeadline } from '../services/breachNotification';
import { notifyBreachDeadlineWarning, notifyBreachDeadlinePassed } from '../services/gdprNotifications';

interface BreachIncident {
  id: string;
  incident_id: string;
  detected_at: string;
  breach_type: string;
  severity: string;
  ico_notified_at: string | null;
  affected_users: string[];
}

export const useBreachDeadlineMonitor = () => {
  const notifiedWarnings = useRef<Set<string>>(new Set());
  const notifiedPassed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkDeadlines = async () => {
      try {
        // Fetch all unresolved breaches that haven't been notified to ICO
        const { data: breaches, error } = await supabase
          .from('data_breach_logs')
          .select('*')
          .is('ico_notified_at', null)
          .order('detected_at', { ascending: true });

        if (error) {
          console.error('Error fetching breaches:', error);
          return;
        }

        if (!breaches || breaches.length === 0) {
          return;
        }

        for (const breach of breaches as BreachIncident[]) {
          const hoursRemaining = getHoursUntilDeadline(breach.detected_at);

          // Check if deadline has passed
          if (hoursRemaining === 0 && !notifiedPassed.current.has(breach.incident_id)) {
            const hoursOverdue = Math.abs((new Date().getTime() - new Date(breach.detected_at).getTime()) / (60 * 60 * 1000) - 72);

            try {
              await notifyBreachDeadlinePassed({
                incident_id: breach.incident_id,
                breach_type: breach.breach_type,
                severity: breach.severity,
                hours_overdue: hoursOverdue,
              });

              notifiedPassed.current.add(breach.incident_id);
              console.log(`Sent deadline passed notification for breach ${breach.incident_id}`);
            } catch (notifError) {
              console.error(`Failed to send deadline passed notification for ${breach.incident_id}:`, notifError);
            }
          }
          // Check if less than 24 hours remaining
          else if (hoursRemaining < 24 && hoursRemaining > 0 && !notifiedWarnings.current.has(breach.incident_id)) {
            try {
              await notifyBreachDeadlineWarning({
                incident_id: breach.incident_id,
                breach_type: breach.breach_type,
                severity: breach.severity,
                hours_remaining: hoursRemaining,
                affected_users_count: breach.affected_users?.length || 0,
              });

              notifiedWarnings.current.add(breach.incident_id);
              console.log(`Sent deadline warning notification for breach ${breach.incident_id}`);
            } catch (notifError) {
              console.error(`Failed to send deadline warning for ${breach.incident_id}:`, notifError);
            }
          }
        }
      } catch (error) {
        console.error('Error in breach deadline monitoring:', error);
      }
    };

    // Check immediately on mount
    checkDeadlines();

    // Then check every 30 minutes
    const interval = setInterval(checkDeadlines, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
};
