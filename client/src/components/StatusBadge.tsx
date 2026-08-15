import { Badge } from "./ui/Badge";
import type { DocStatus } from "../lib/types";

/** Bốn trạng thái, bốn dấu hiệu khác nhau — không chỉ khác chữ. */
const STATUS: Record<
  DocStatus,
  { label: string; tone: "neutral" | "accent" | "warn" | "danger" | "muted"; pulse?: boolean }
> = {
  PENDING: { label: "Pending", tone: "muted" },
  PROCESSING: { label: "Processing", tone: "warn", pulse: true },
  READY: { label: "Ready", tone: "accent" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const { label, tone, pulse } = STATUS[status];
  return (
    <Badge tone={tone} dot pulse={pulse}>
      {label}
    </Badge>
  );
}
