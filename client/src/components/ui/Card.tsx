import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * `tone` chứ không phải truyền class nền qua className: hai utility nền cùng
 * loại thì thứ tự trong file CSS quyết định, không phải thứ tự trong chuỗi —
 * nên override kiểu đó im lặng không ăn.
 */
type Tone = "plain" | "accent";

const TONES: Record<Tone, string> = {
  plain: "border-line bg-surface",
  accent: "border-accent-line bg-accent-soft",
};

export function Card({
  children,
  className,
  tone = "plain",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-lg border shadow-card", TONES[tone], className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-6 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[17px] leading-tight font-medium">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] text-faint">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
