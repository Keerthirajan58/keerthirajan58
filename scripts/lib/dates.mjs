// Calendar dates as they read in the owner's time zone (profile.timeZone, an IANA name such
// as "America/Los_Angeles"), so a run late on a San Francisco evening is dated that evening,
// not the next day in UTC. Without a zone, UTC. An unknown zone name throws.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The year, month (0–11) and day of `date` in `timeZone`. */
function parts(date, timeZone = "UTC") {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", year: "numeric", month: "numeric", day: "numeric" });
  const p = Object.fromEntries(f.formatToParts(date).map(({ type, value }) => [type, value]));
  return { year: +p.year, month: +p.month - 1, day: +p.day };
}

/** "Oct 2026", or "" without a date. */
export function monthYear(date, timeZone) {
  if (!date) return "";
  const p = parts(date, timeZone);
  return `${MONTHS[p.month]} ${p.year}`;
}

/** "Nov 6, 2026", or "" without a date. */
export function dayDate(date, timeZone) {
  if (!date) return "";
  const p = parts(date, timeZone);
  return `${MONTHS[p.month]} ${p.day}, ${p.year}`;
}
