/**
 * Current milk shift, by the clock of the device:
 *   Evening  16:00 - 01:59   (from 4 PM in the afternoon until 2 AM at night)
 *   Morning  02:00 - 15:59   (the morning shift starts at 2 AM and runs until 4 PM)
 */
export type ShiftName = 'Morning' | 'Evening';

export const MORNING_STARTS_AT = 2;
export const EVENING_STARTS_AT = 16;

export function currentShift(now: Date = new Date()): ShiftName {
  const h = now.getHours();
  return h >= MORNING_STARTS_AT && h < EVENING_STARTS_AT ? 'Morning' : 'Evening';
}

/** Text shown for a shift's time window (badge tooltip). */
export const SHIFT_WINDOW: Record<ShiftName, string> = {
  Morning: '2:00 AM – 4:00 PM',
  Evening: '4:00 PM – 2:00 AM',
};
