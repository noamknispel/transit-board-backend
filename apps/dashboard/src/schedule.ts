import type { WidgetSchedule } from './types';

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const browserTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
})();

/** "Mon–Fri 07:00–09:00", "Every day 18:00–02:00", "Sat all day" */
export function describeSchedule(schedule: WidgetSchedule): string {
  const days = [...(schedule.days ?? [])].sort();
  let dayText = 'Every day';
  if (days.length > 0 && days.length < 7) {
    const consecutive = days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
    dayText = consecutive && days.length > 2
      ? `${DAY_NAMES[days[0]!]}–${DAY_NAMES[days[days.length - 1]!]}`
      : days.map((d) => DAY_NAMES[d]).join(', ');
  }
  const time = schedule.start === schedule.end ? 'all day' : `${schedule.start}–${schedule.end}`;
  return `${dayText} ${time}`;
}

/** ISO instant -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
