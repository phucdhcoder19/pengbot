import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { CheckIcon, CopyIcon } from "./ui/icons";
import { buildSnippet } from "../lib/widget";

type Status = "idle" | "copied" | "manual";

/** Đoạn mã nhúng + nút Copy. Đây là việc đầu tiên một công ty mới phải làm. */
export function EmbedSnippet({
  publicKey,
  className,
}: {
  publicKey: string;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const codeRef = useRef<HTMLElement>(null);
  const snippet = buildSnippet(publicKey);

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 4_000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setStatus("copied");
    } catch {
      // Trình duyệt chặn clipboard (trang không chạy HTTPS, hoặc cửa sổ chưa
      // được focus): bôi đen sẵn đoạn mã và nói rõ người dùng cần bấm gì.
      const node = codeRef.current;
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setStatus("manual");
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <code
          ref={codeRef}
          className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line bg-sunken px-4 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre text-soft"
        >
          {snippet}
        </code>
        <Button
          variant={status === "copied" ? "secondary" : "primary"}
          onClick={copy}
          className="shrink-0"
        >
          {status === "copied" ? (
            <>
              <CheckIcon className="size-4" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-4" />
              Copy
            </>
          )}
        </Button>
      </div>

      <p aria-live="polite" className="sr-only">
        {status === "copied" ? "Embed snippet copied." : ""}
      </p>

      {status === "manual" ? (
        <p className="mt-2 text-[13px] text-warn">
          Your browser blocked automatic copying. The snippet is selected — press Ctrl+C (or ⌘+C) to copy it.
        </p>
      ) : null}
    </div>
  );
}
