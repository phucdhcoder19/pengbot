import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { AlertIcon } from "./icons";

/** Thông báo lỗi ở cấp biểu mẫu hoặc cấp trang (lỗi từng ô dùng Input.error). */
export function Alert({
  children,
  tone = "danger",
  action,
  className,
}: {
  children: ReactNode;
  tone?: "danger" | "warn";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-[13px] leading-relaxed",
        tone === "danger"
          ? "border-danger-line bg-danger-soft text-danger"
          : "border-warn-line bg-warn-soft text-warn",
        className,
      )}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-text">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
