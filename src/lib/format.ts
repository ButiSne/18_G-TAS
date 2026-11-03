// Times are shown in South African time, whatever the server's time zone (Vercel runs UTC).
const SA_TIME = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** e.g. "Wed 5 Nov, 14:30" */
export const formatSATime = (date: Date | string) => SA_TIME.format(new Date(date));
