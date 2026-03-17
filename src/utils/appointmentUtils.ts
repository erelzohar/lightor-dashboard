import { Appointment } from '../types';

/**
 * Determines the display status of an appointment based on its current status,
 * timestamp, and duration.
 */
export const getDisplayStatus = (appt: Appointment): string => {
    // If already closed in DB (completed or cancelled), just show that
    if (appt.status !== 'scheduled') return appt.status;

    const now = Date.now();
    const start = Number(appt.timestamp);
    const duration = Number(appt.type?.durationMS || 0);
    const endWithBuffer = start + duration + (15 * 60 * 1000); // 15 minutes buffer

    // LOGIC:
    // 1. If we are past the end + buffer -> Show as "completed" 
    // 2. If we are between start and end -> Show as "ongoing"
    // 3. Otherwise -> "scheduled"

    if (now > endWithBuffer) return 'completed';
    if (now >= start && now <= endWithBuffer) return 'ongoing';

    return 'scheduled';
};
