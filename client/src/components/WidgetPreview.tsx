import { CloseIcon, SendIcon } from "./ui/icons";
import { readableOn, tint } from "../lib/color";

/**
 * Hình dáng thật của widget khi chạy trên website khách hàng.
 * Đây cũng chính là bản thiết kế để viết widget.js sau này: khung chat 360×460,
 * bo 16px, thanh tiêu đề mang màu công ty, bong bóng mở ở góc phải dưới.
 */
export function WidgetPreview({
  title,
  greeting,
  color,
}: {
  title: string;
  greeting: string;
  color: string;
}) {
  const onColor = readableOn(color);

  return (
    <div className="flex flex-col items-end gap-4">
      {/* Khung chat */}
      <div className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
        {/* Thanh tiêu đề */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ backgroundColor: color, color: onColor }}
        >
          <div className="min-w-0">
            <div className="truncate text-[14px] leading-tight font-semibold">
              {title || "Chat with us"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] opacity-80">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ backgroundColor: onColor }}
              />
              Typically replies instantly
            </div>
          </div>
          <CloseIcon className="size-4 shrink-0 opacity-80" />
        </div>

        {/* Khung tin nhắn */}
        <div className="space-y-3 bg-[#FAFAFA] px-4 py-5" style={{ minHeight: 236 }}>
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              {greeting || "Hi! How can I help you today?"}
            </div>
          </div>

          <div className="flex justify-end">
            <div
              className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] leading-relaxed"
              style={{ backgroundColor: color, color: onColor }}
            >
              What's your return policy?
            </div>
          </div>

          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              We accept returns within 30 days of delivery.
              <div className="mt-2 border-t border-[#EDEDED] pt-2">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[11px]"
                  style={{ backgroundColor: tint(color, 0.88), color: color }}
                >
                  Source: 2025 Return Policy
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ô nhập */}
        <div className="flex items-center gap-2 border-t border-[#EDEDED] bg-white px-3 py-2.5">
          <div className="flex-1 text-[13px] text-[#9A9A9A]">Type your question…</div>
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: color, color: onColor }}
          >
            <SendIcon className="size-4" />
          </div>
        </div>
      </div>

      {/* Bong bóng mở widget */}
      <div
        className="flex size-14 items-center justify-center rounded-full shadow-pop"
        style={{ backgroundColor: color, color: onColor }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
          <path
            d="M20 14.5a2 2 0 0 1-2 2H9l-4.5 4V6.5a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 10.5h6M9 13.5h3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
