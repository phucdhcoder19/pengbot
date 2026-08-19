import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";

/// Ngưỡng đổi màu thanh đo. Dưới 80% không tô gì — cảnh báo lúc còn xa
/// khiến người ta quen mắt rồi bỏ qua đúng lúc cần chú ý.
const WARN_AT = 0.8;

export type Meter = { used: number; limit: number };

function ratioOf({ used, limit }: Meter): number {
  if (limit <= 0) return 1; // trần 0 = đã hết, tránh chia cho 0
  return Math.min(1, used / limit);
}

/**
 * Ô số liệu: nhãn nhỏ, số lớn.
 * Số dùng chữ số tỉ lệ (không tabular) vì đứng một mình, không xếp cột.
 *
 * `meter` biến ô thành ô hạn mức: thêm thanh tiến trình dưới con số, đổi sang
 * màu cảnh báo từ 80% và màu nguy hiểm khi đã chạm trần.
 */
export function StatTile({
  label,
  value,
  note,
  meter,
}: {
  label: string;
  value: number;
  note?: ReactNode;
  meter?: Meter;
}) {
  const ratio = meter ? ratioOf(meter) : 0;
  const full = ratio >= 1;
  const warn = !full && ratio >= WARN_AT;

  return (
    <div className="border-t border-line pt-4">
      <div className="text-[13px] text-faint">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-[32px] leading-none font-semibold",
          full && "text-danger",
          warn && "text-warn",
        )}
      >
        {formatNumber(value)}
      </div>

      {meter ? (
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-valuenow={meter.used}
          aria-valuemin={0}
          aria-valuemax={meter.limit}
          aria-label={label}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              full ? "bg-danger" : warn ? "bg-warn" : "bg-accent-text",
            )}
            // Chiều rộng là dữ liệu chạy lúc render, không thể là class Tailwind
            style={{ width: `${Math.max(ratio * 100, meter.used > 0 ? 2 : 0)}%` }}
          />
        </div>
      ) : null}

      {note ? <div className="mt-2 text-[12px] text-faint">{note}</div> : null}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="border-t border-line pt-4">
      <div className="h-3.5 w-24 animate-pulse rounded bg-sunken" />
      <div className="mt-2.5 h-7 w-16 animate-pulse rounded bg-sunken" />
    </div>
  );
}
