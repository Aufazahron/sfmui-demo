const JAKARTA = 'Asia/Jakarta';

export function formatJakartaDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function formatJakartaTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function formatJakartaDateTime(iso: string) {
  const date = formatJakartaDate(iso);
  const time = formatJakartaTime(iso);
  return { date, time, csv: `${date} ${time}` };
}

function jakartaDayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

export function formatStatusSince(status: string, sinceIso: string, now = Date.now()) {
  const since = new Date(sinceIso);
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(since);

  const todayKey = jakartaDayKey(new Date(now));
  const yesterdayKey = jakartaDayKey(new Date(now - 24 * 60 * 60 * 1000));
  const sinceKey = jakartaDayKey(since);

  let when: string;
  if (sinceKey === todayKey) when = `today, ${time}`;
  else if (sinceKey === yesterdayKey) when = `yesterday, ${time}`;
  else {
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: JAKARTA,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(since);
    when = `${date}, ${time}`;
  }

  const elapsedMs = Math.max(0, now - since.getTime());
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let duration: string;
  if (totalMinutes < 1) duration = 'For less than a minute';
  else if (days > 0) duration = `For ${plural(days, 'day')}${hours > 0 ? ` ${plural(hours, 'hour')}` : ''}`;
  else if (hours > 0) duration = `For ${plural(hours, 'hour')}${minutes > 0 ? ` ${plural(minutes, 'minute')}` : ''}`;
  else duration = `For ${plural(minutes, 'minute')}`;

  return {
    sinceLine: `${label} since ${when}`,
    durationLine: duration,
  };
}
