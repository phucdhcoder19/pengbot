import type { ReactNode } from "react";
import { formatNumber } from "../lib/format";

/**
 * Ô số liệu: nhãn nhỏ, số lớn.
 * Số dùng chữ số tỉ lệ (không tabular) vì đứng một mình, không xếp cột.
 */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: ReactNode;
}) {
  return (
    <div className="border-t border-line pt-4">
      <div className="text-[13px] text-faint">{label}</div>
      <div className="mt-1.5 text-[32px] leading-none font-semibold">
        {formatNumber(value)}
      </div>
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
