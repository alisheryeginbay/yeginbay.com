// Dates as the site writes them, in the offset posts are dated in
// (SITE.utcOffset) rather than the build machine's time zone.
import { SITE } from "../site.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The date with its UTC fields reading as local time.
const local = (d: Date) => new Date(d.getTime() + SITE.utcOffset * 60_000);
const pad = (n: number) => String(n).padStart(2, "0");

function offset(sep: string): string {
  const sign = SITE.utcOffset < 0 ? "-" : "+";
  const m = Math.abs(SITE.utcOffset);
  return `${sign}${pad(Math.floor(m / 60))}${sep}${pad(m % 60)}`;
}

// 2026-10-14
export function isoDate(d: Date): string {
  const l = local(d);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
}

// Oct 14, 2026
export function longDate(d: Date): string {
  const l = local(d);
  return `${MONTHS[l.getUTCMonth()]} ${l.getUTCDate()}, ${l.getUTCFullYear()}`;
}

const time = (l: Date) => `${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())}`;

// 2026-10-14T02:04:28+05:00, for the sitemap.
export function isoDateTime(d: Date): string {
  return `${isoDate(d)}T${time(local(d))}${offset(":")}`;
}

// Wed, 14 Oct 2026 02:04:28 +0500, for feeds.
export function rfc822(d: Date): string {
  const l = local(d);
  return `${DAYS[l.getUTCDay()]}, ${pad(l.getUTCDate())} ${MONTHS[l.getUTCMonth()]} ${l.getUTCFullYear()} ${time(l)} ${offset("")}`;
}
