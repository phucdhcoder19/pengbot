import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Màn hình rỗng luôn nói việc TIẾP THEO cần làm, không dừng ở
 * "chưa có dữ liệu" — đó là lúc người dùng cần được dẫn đường nhất.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {icon ? (
        <div className="mb-5 flex size-11 items-center justify-center rounded-full border border-line text-faint">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[19px] font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
