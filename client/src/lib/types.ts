/**
 * Kiểu dữ liệu dùng chung — khớp với prisma/schema.prisma của backend.
 * Khi backend đổi schema, sửa ở đây trước, TypeScript sẽ chỉ ra chỗ cần sửa tiếp.
 */

export type DocStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type SourceType = "PDF" | "DOCX" | "TXT" | "MD" | "URL";
export type Plan = "FREE" | "PRO" | "ENTERPRISE";
export type UserRole = "OWNER" | "MEMBER";
export type MsgRole = "USER" | "ASSISTANT";

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  publicKey: string;
  plan: Plan;
  allowedDomains: string[];
  widgetTitle: string;
  widgetColor: string;
  widgetGreeting: string;
}

export interface Document {
  id: string;
  title: string;
  sourceType: SourceType;
  fileName: string | null;
  fileSize: number | null;
  status: DocStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  title: string;
}

/// Khách bấm 👍/👎 trên câu trả lời. null = chưa ai đánh giá.
export type Feedback = "UP" | "DOWN" | null;

export interface Message {
  id: string;
  role: MsgRole;
  content: string;
  citations: Citation[];
  confidence: number | null;
  feedback: Feedback;
  createdAt: string;
}

export interface Conversation {
  id: string;
  visitorId: string | null;
  messageCount: number;
  /// Số câu trả lời bị khách bấm 👎 trong hội thoại này.
  dislikedCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationDetail = Conversation & { messages: Message[] };

/**
 * Hạn mức tháng của gói hiện tại.
 *
 * ⚠️ `used` KHÁC `Usage.totalMessages`: cái này đếm theo tháng dương lịch
 * (UTC) và là đúng con số backend dùng để chặn widget, còn totalMessages là
 * tổng trong `days` ngày trượt.
 */
export interface Quota {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface Usage {
  totalMessages: number;
  totalDocuments: number;
  totalChunks: number;
  daily: { date: string; aiMessages: number }[];
  quota: Quota;
}

export interface AuthResult {
  accessToken: string;
  user: User;
  tenant: Tenant;
}

export interface Session {
  user: User;
  tenant: Tenant;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

/** Phần Tenant mà chủ công ty được phép tự sửa trong /settings. */
export type TenantPatch = Partial<
  Pick<
    Tenant,
    "name" | "widgetTitle" | "widgetColor" | "widgetGreeting" | "allowedDomains"
  >
>;
