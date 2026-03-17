import { format, parseISO, addMinutes, isWithinInterval } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

export const formatDate = (date: Date | number, formatString: string = 'PPP', language: string = 'he'): string => {
  return format(date, formatString, { locale: language === 'he' ? he : enUS });
};

export const formatTime = (date: Date | number, language: string = 'he'): string => {
  return format(date, 'HH:mm', { locale: language === 'he' ? he : enUS });
};

export const formatDateTime = (date: Date | number, language: string = 'he'): string => {
  return format(date, 'PPP HH:mm', { locale: language === 'he' ? he : enUS });
};

export const parseTimeRange = (rangeString: string | null): { start: string; end: string } | null => {
  if (!rangeString) return null;
  
  const [start, end] = rangeString.split('-');
  
  return { start, end };
};

export const parseWorkingHours = (workingDays: (string | null)[]): { [key: number]: { start: string; end: string } | null } => {
  const result: { [key: number]: { start: string; end: string } | null } = {};
  
  workingDays.forEach((day, index) => {
    result[index] = parseTimeRange(day);
  });
  
  return result;
};

export const minutesToMilliseconds = (minutes: number): number => {
  return minutes * 60 * 1000;
};

export const formatDuration = (durationMS: string, language: string = 'he'): string => {
  const minutes = parseInt(durationMS) / 60000;
  
  if (minutes < 60) {
    return language === 'he' ? `${minutes} דקות` : `${minutes} minutes`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return language === 'he' ? `${hours} שעות` : `${hours} hours`;
  }
  
  return language === 'he' 
    ? `${hours} שעות ו-${remainingMinutes} דקות`
    : `${hours} hours and ${remainingMinutes} minutes`;
};

export const getTimeSlots = (
  startTime: string,
  endTime: string,
  date: Date,
  durationMS: number,
  bookedSlots: { start: number; end: number }[]
): { start: Date; end: Date }[] => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const start = new Date(date);
  start.setHours(startHour, startMinute, 0, 0);
  
  const end = new Date(date);
  end.setHours(endHour, endMinute, 0, 0);
  
  const slots: { start: Date; end: Date }[] = [];
  const slotDurationMinutes = durationMS / 60000;
  
  let slotStart = start;
  
  while (addMinutes(slotStart, slotDurationMinutes).getTime() <= end.getTime()) {
    const slotEnd = addMinutes(slotStart, slotDurationMinutes);
    
    // Check if this slot overlaps with any booked slot
    const isOverlapping = bookedSlots.some(
      bookedSlot => {
        return isWithinInterval(slotStart.getTime(), {
          start: bookedSlot.start,
          end: bookedSlot.end,
        }) || isWithinInterval(slotEnd.getTime() - 1, {
          start: bookedSlot.start,
          end: bookedSlot.end,
        }) || (
          slotStart.getTime() <= bookedSlot.start &&
          slotEnd.getTime() >= bookedSlot.end
        );
      }
    );
    
    if (!isOverlapping) {
      slots.push({ start: slotStart, end: slotEnd });
    }
    
    slotStart = addMinutes(slotStart, slotDurationMinutes);
  }
  
  return slots;
};