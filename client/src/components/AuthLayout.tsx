import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Khung hai cột cho /login và /register.
 * Cột phải là vùng thương hiệu: chỉ chữ và hình khối, không ảnh stock —
 * một sơ đồ mảnh kể đúng việc sản phẩm làm: tài liệu vào, câu trả lời ra.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Cột form */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 rounded-md text-[15px] font-medium"
        >
          <BrandMark />
          <span className="font-display text-[19px]">Pengbot</span>
        </Link>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 text-[32px] leading-tight">{title}</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-faint">{description}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-8 border-t border-line pt-6 text-[13px] text-faint">
            {footer}
          </div>
        </div>
      </div>

      {/* Cột thương hiệu */}
      <div className="relative hidden overflow-hidden bg-[#0B2E27] lg:flex lg:flex-col lg:justify-between">
        {/* Chuyển sắc rất nhẹ, không phải gradient trang trí */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 0%, rgba(124,191,168,0.16) 0%, rgba(11,46,39,0) 60%)",
          }}
        />

        <div className="relative px-16 pt-20">
          <p className="max-w-md font-display text-[40px] leading-[1.1] font-medium text-[#EAF3EF]">
            Your documents,
            <br />
            answering for you.
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#9FC4B7]">
            A chatbot that learns exactly what your company wrote — and answers only within it. No making things up.
          </p>
        </div>

        <div className="relative px-16">
          <PipelineDiagram />
        </div>

        {/* Ba bước là một trình tự thật, nên mới đánh số */}
        <ol className="relative grid grid-cols-3 gap-px border-t border-[#1B463C] bg-[#1B463C] text-[#9FC4B7]">
          {[
            ["01", "Upload your documents"],
            ["02", "Paste one line of script"],
            ["03", "Answer customers 24/7"],
          ].map(([step, label]) => (
            <li key={step} className="bg-[#0B2E27] px-6 py-7">
              <div className="font-mono text-[11px] tracking-[0.14em] text-[#5F8C7E]">
                {step}
              </div>
              <div className="mt-1.5 text-[13px] text-[#CFE2DA]">{label}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 items-center justify-center rounded-md bg-accent"
    >
      <svg viewBox="0 0 24 24" className="size-4 text-on-accent" fill="none">
        <path
          d="M6 5h7.2c2.6 0 4.4 1.7 4.4 4.1s-1.8 4.2-4.4 4.2H9.1V18H6V5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

/** Tài liệu → tri thức → câu trả lời. Vẽ bằng nét mảnh, không tô đặc. */
function PipelineDiagram() {
  return (
    <svg
      viewBox="0 0 420 200"
      className="w-full max-w-[420px]"
      role="img"
      aria-label="Diagram: documents processed into customer answers"
    >
      <g stroke="#3E7365" strokeWidth="1" fill="none">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(4, ${8 + i * 62})`}>
            <rect width="92" height="48" rx="4" />
            <path d="M14 17h48M14 27h64M14 37h36" stroke="#2F5A4E" />
          </g>
        ))}
      </g>

      {/* Đường hội tụ về nút tri thức */}
      <g stroke="#3E7365" strokeWidth="1" fill="none" opacity="0.9">
        <path d="M96 32 C 150 32, 160 92, 196 100" />
        <path d="M96 94 C 150 94, 160 98, 196 100" />
        <path d="M96 156 C 150 156, 160 108, 196 100" />
      </g>

      <circle cx="206" cy="100" r="10" fill="#0B2E27" stroke="#7CBFA8" strokeWidth="1.25" />
      <circle cx="206" cy="100" r="3" fill="#7CBFA8" />

      <path
        d="M216 100 H 268"
        stroke="#3E7365"
        strokeWidth="1"
        strokeDasharray="2 4"
        fill="none"
      />

      {/* Bong bóng trả lời */}
      <g transform="translate(272, 62)">
        <path
          d="M0 8a8 8 0 0 1 8-8h124a8 8 0 0 1 8 8v50a8 8 0 0 1-8 8H30l-16 14V66H8a8 8 0 0 1-8-8V8Z"
          fill="#124036"
          stroke="#7CBFA8"
          strokeWidth="1.25"
        />
        <path d="M18 24h96M18 38h72" stroke="#7CBFA8" strokeWidth="1" opacity="0.55" />
      </g>
    </svg>
  );
}
