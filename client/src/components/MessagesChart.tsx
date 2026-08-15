import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { chartTooltipDate, formatNumber, shortDate } from "../lib/format";

interface Point {
  date: string;
  aiMessages: number;
}

/* Hình học cố định — trục X có chỗ riêng, không bị cắt. */
const PAD = { top: 18, right: 10, bottom: 26, left: 40 };
const MAX_BAR = 14; // cột mảnh, phần thừa của ô là khoảng thở
const BAR_GAP = 6; // 2px trong số này là khe nền giữa hai cột liền nhau
const RADIUS = 4; // bo đầu cột, chân cột vuông trên đường 0

/** Cột bo tròn phía trên, vuông ở chân — dựng bằng path để chân bám trục 0. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`;
}

/** Làm tròn trần lên số đẹp để nhãn trục Y không lẻ. */
function niceCeil(value: number) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}

export function MessagesChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, band - BAR_GAP));

  const peak = data.reduce(
    (best, point, i) => (point.aiMessages > data[best].aiMessages ? i : best),
    0,
  );
  const top = niceCeil(Math.max(1, data[peak]?.aiMessages ?? 1));
  const ticks = [0, top / 2, top];

  const xOf = (i: number) => PAD.left + i * band + (band - barW) / 2;
  const yOf = (value: number) => PAD.top + plotH - (value / top) * plotH;

  const onMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left - PAD.left;
      const index = Math.floor(x / band);
      setActive(index >= 0 && index < data.length ? index : null);
    },
    [band, data.length],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setActive((current) => {
        const start = current ?? data.length - 1;
        const next = event.key === "ArrowLeft" ? start - 1 : start + 1;
        return Math.max(0, Math.min(data.length - 1, next));
      });
    },
    [data.length],
  );

  // Dữ liệu ngắn lại (đổi khoảng thời gian) thì bỏ ô đang trỏ — tính khi
  // render thay vì đặt lại bằng effect, tránh một vòng render thừa.
  const hovered = active != null && active < data.length ? active : null;
  const point = hovered != null ? data[hovered] : null;
  const tooltipLeft = hovered != null ? xOf(hovered) + barW / 2 : 0;

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`AI messages per day over the last ${data.length} days`}
          tabIndex={0}
          onMouseMove={onMove}
          onMouseLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block rounded-sm outline-offset-4"
        >
          {/* Lưới: nét liền, mảnh, lùi về sau */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={yOf(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="tabular fill-faint text-[11px]"
              >
                {formatNumber(tick)}
              </text>
            </g>
          ))}

          {/* Nền ô đang trỏ — vùng bắt chuột rộng hơn cột nhiều */}
          {hovered != null ? (
            <rect
              x={PAD.left + hovered * band}
              y={PAD.top - 6}
              width={band}
              height={plotH + 6}
              fill="var(--surface-hover)"
              rx={3}
            />
          ) : null}

          {/* Cột */}
          {data.map((d, i) => {
            const h = (d.aiMessages / top) * plotH;
            return (
              <path
                key={d.date}
                d={barPath(xOf(i), yOf(d.aiMessages), barW, h)}
                fill="var(--accent)"
                opacity={hovered == null || hovered === i ? 1 : 0.55}
                className="transition-opacity duration-150"
              />
            );
          })}

          {/* Nhãn trực tiếp: chỉ ngày cao nhất */}
          {data.length ? (
            <text
              x={xOf(peak) + barW / 2}
              y={yOf(data[peak].aiMessages) - 7}
              textAnchor="middle"
              className="tabular fill-soft text-[11px] font-medium"
            >
              {formatNumber(data[peak].aiMessages)}
            </text>
          ) : null}

          {/* Trục ngày: thưa để không chồng chữ */}
          {data.map((d, i) =>
            i % 5 === 0 || i === data.length - 1 ? (
              <text
                key={`x-${d.date}`}
                x={xOf(i) + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className="tabular fill-faint text-[11px]"
              >
                {shortDate(d.date)}
              </text>
            ) : null,
          )}
        </svg>

        {point ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 shadow-pop"
            style={{
              left: Math.min(Math.max(tooltipLeft, 70), width - 70),
              top: PAD.top - 4,
            }}
          >
            <div className="text-[12px] whitespace-nowrap text-faint">
              {chartTooltipDate(point.date)}
            </div>
            <div className="tabular text-sm font-medium whitespace-nowrap">
              {formatNumber(point.aiMessages)} messages
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[12px] text-faint">
          Use ← → to step through the days.
        </p>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="rounded-sm text-[12px] text-soft underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-sunken">
              <tr className="text-faint">
                <th scope="col" className="px-4 py-2 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  AI messages
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className={cn("border-t border-line")}>
                  <td className="px-4 py-1.5 text-soft">{chartTooltipDate(d.date)}</td>
                  <td className="px-4 py-1.5 text-right">{formatNumber(d.aiMessages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
