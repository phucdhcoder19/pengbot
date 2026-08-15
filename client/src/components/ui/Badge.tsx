import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "warn" | "danger" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-sunken text-soft",
  accent: "border-accent-line bg-accent-soft text-accent-text",
  warn: "border-warn-line bg-warn-soft text-warn",
  danger: "border-danger-line bg-danger-soft text-danger",
  muted: "border-line bg-transparent text-faint",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-faint",
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-line-strong",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[12px] leading-5 font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5">
          {pulse ? (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-70",
                DOTS[tone],
              )}
            />
          ) : null}
          <span className={cn("relative inline-flex size-1.5 rounded-full", DOTS[tone])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}
