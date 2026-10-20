/** Start of calendar day in Asia/Jakarta as a UTC Date. */
export function jakartaDayStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return new Date(`${parts}T00:00:00+07:00`);
}

export function jakartaMonthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
  const [year, month] = parts.split('-');
  return new Date(`${year}-${month}-01T00:00:00+07:00`);
}
