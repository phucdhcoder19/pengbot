import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent border border-transparent hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "bg-surface text-text border border-line hover:bg-hover hover:border-line-strong disabled:hover:bg-surface",
  ghost:
    "bg-transparent text-soft border border-transparent hover:bg-hover hover:text-text",
  danger:
    "bg-danger text-inverse border border-transparent hover:bg-danger-hover disabled:hover:bg-danger",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap",
        "transition-colors duration-150 ease-out",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size={size === "sm" ? 13 : 15} />
          <span className="sr-only">Working</span>
        </>
      ) : null}
      {children}
    </button>
  );
}
