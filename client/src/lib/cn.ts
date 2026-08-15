/** Ghép className, bỏ qua giá trị rỗng. Đủ dùng, không cần thêm thư viện. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
