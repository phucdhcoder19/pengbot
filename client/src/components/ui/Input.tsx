import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Lỗi hiển thị ngay dưới ô, không dùng alert() hay toast cho lỗi nhập liệu. */
  error?: string | null;
  suffix?: ReactNode;
}

export const inputBase =
  "w-full rounded-md border bg-surface px-3 text-text placeholder:text-faint " +
  "transition-colors duration-150 ease-out outline-none " +
  "focus:border-accent focus:ring-2 focus:ring-accent/15 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export function Input({
  label,
  hint,
  error,
  suffix,
  className,
  id,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[13px] font-medium text-soft"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            inputBase,
            "h-10 text-sm",
            error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line",
            suffix ? "pr-10" : "",
            className,
          )}
          {...props}
        />
        {suffix ? (
          <span className="absolute inset-y-0 right-2 flex items-center text-faint">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-[13px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
