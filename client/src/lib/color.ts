/** Tiện ích màu cho phần xem trước widget. */

export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

function channel(value: number) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string) {
  if (!isHexColor(hex)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Chữ trắng hay chữ đậm trên nền màu công ty chọn — để luôn đọc được. */
export const readableOn = (hex: string) => (luminance(hex) > 0.42 ? "#101514" : "#FFFFFF");

/** Pha màu công ty với trắng, dùng cho nền nhạt trong widget. */
export function tint(hex: string, amount: number) {
  if (!isHexColor(hex)) return "#FFFFFF";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
