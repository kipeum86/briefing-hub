function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function diffMinutes(value: Date | string, now: Date): number {
  const date = toDate(value);
  const diffMs = now.getTime() - date.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / 60_000);
}

export function toRelativeShort(value: Date | string, now: Date = new Date()): string {
  const minutes = diffMinutes(value, now);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function toRelativeLong(value: Date | string, now: Date = new Date()): string {
  const short = toRelativeShort(value, now);
  return short === "now" ? "just now" : `${short} ago`;
}

