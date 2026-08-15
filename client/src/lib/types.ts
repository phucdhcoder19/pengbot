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

export interface Message {
  id: string;
  role: MsgRole;
  content: string;
  citations: Citation[];
  confidence: number | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  visitorId: string | null;
  messageCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationDetail = Conversation & { messages: Message[] };

export interface Usage {
  totalMessages: number;
  totalDocuments: number;
  totalChunks: number;
  daily: { date: string; aiMessages: number }[];
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
