/** Định dạng hiển thị. Toàn bộ dùng tiếng Việt, giờ theo máy người dùng. */

const NUMBER = new Intl.NumberFormat("en-US");

export const formatNumber = (n: number) => NUMBER.format(n);

/** Dung lượng file: dưới 1MB hiện KB, còn lại hiện MB. */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "5 min ago", "3 days ago" — cách khách hàng thật đọc thời gian. */
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  const days = Math.round(hours / 24);
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.round(days / 7), "week");
  if (days < 365) return plural(Math.round(days / 30), "month");
  return plural(Math.round(days / 365), "year");
}

/** Nhãn ngày ngắn cho trục biểu đồ: "15/8". */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Ngày đầy đủ cho tooltip biểu đồ: "Thứ Sáu, 15/8". */
export function chartTooltipDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${names[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}
