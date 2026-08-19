/**
 * ═══════════════════ HỢP ĐỒNG API ═══════════════════
 *
 * Mọi thứ giao diện cần từ server đều đi qua đúng file này. Không component
 * nào được import mock-data.ts trực tiếp — giữ được quy tắc đó thì lúc nối
 * backend thật, chỉ file này thay đổi.
 *
 * ĐÃ NỐI BACKEND THẬT. Đặt VITE_USE_MOCK=true trong .env để quay lại dữ liệu
 * giả (tiện khi backend chưa chạy hoặc muốn dựng giao diện offline).
 *
 * Không trang nào phải sửa khi chuyển đổi — đó là mục đích của lớp này.
 */

import axios, { AxiosError } from "axios";
import type {
  AuthResult,
  Conversation,
  ConversationDetail,
  Document,
  Paginated,
  Session,
  SourceType,
  Tenant,
  TenantPatch,
  Usage,
} from "./types";
import * as mock from "./mock-data";

/** Mặc định gọi backend thật. Đặt VITE_USE_MOCK=true để chạy offline. */
const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "pengbot.token";

// ───────────────────────────── Hạ tầng ─────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const http = axios.create({ baseURL: BASE_URL, timeout: 30_000 });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Đưa lỗi mạng/HTTP về một kiểu duy nhất, đã có câu sẵn để hiển thị. */
http.interceptors.response.use(undefined, (error: AxiosError<{ message?: string | string[] }>) => {
  if (!error.response) {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }
  const { status, data } = error.response;

  // Token hết hạn hoặc bị thu hồi → dọn ngay, đừng để lần gọi sau lại 401.
  // KHÔNG redirect ở đây: RequireAuth lo việc đó, làm cả hai là đá nhau.
  if (status === 401) clearToken();

  // class-validator trả về message dạng MẢNG khi có nhiều lỗi cùng lúc.
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;

  const fallback =
    status === 401
      ? "Your session has expired. Please sign in again."
      : status >= 500
        ? "The server ran into a problem. Try again in a few minutes."
        : "Invalid request.";
  throw new ApiError(message ?? fallback, status);
});

/** Độ trễ giả 300–800ms để nhìn thấy đúng các trạng thái đang tải. */
const delay = () =>
  new Promise<void>((r) => setTimeout(r, 300 + Math.round(Math.random() * 500)));

const copy = <T>(value: T): T => structuredClone(value);

function requireSession() {
  if (!getToken()) throw new ApiError("Your session has expired.", 401);
}

// ───────────────────────────── Xác thực ─────────────────────────────

export async function login(email: string, password: string): Promise<AuthResult> {
  if (!USE_MOCK) {
    const { data } = await http.post<AuthResult>("/auth/login", { email, password });
    return data;
  }
  await delay();
  if (!email.includes("@")) throw new ApiError("Invalid email address.");
  if (password.length < 8)
    throw new ApiError("Incorrect email or password.", 401);
  return { accessToken: `mock.${Date.now()}`, user: copy(mock.user), tenant: copy(mock.tenant) };
}

export async function register(
  companyName: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!USE_MOCK) {
    const { data } = await http.post<AuthResult>("/auth/register", {
      companyName,
      email,
      password,
    });
    return data;
  }
  await delay();
  if (password.length < 8) throw new ApiError("Password must be at least 8 characters.");
  mock.patchTenant({
    name: companyName,
    slug: companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  });
  return {
    accessToken: `mock.${Date.now()}`,
    user: { ...copy(mock.user), email },
    tenant: copy(mock.tenant),
  };
}

export async function getMe(): Promise<Session> {
  if (!USE_MOCK) {
    // Backend đặt route là /api/me, KHÔNG phải /api/auth/me
    const { data } = await http.get<Session>("/me");
    return data;
  }
  await delay();
  requireSession();
  return { user: copy(mock.user), tenant: copy(mock.tenant) };
}

// ───────────────────────────── Tài liệu ─────────────────────────────

export async function listDocuments(): Promise<Document[]> {
  if (!USE_MOCK) {
    const { data } = await http.get<Document[]>("/documents");
    return data;
  }
  await delay();
  requireSession();
  return copy(mock.documents);
}

const EXT_TO_TYPE: Record<string, SourceType> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  md: "MD",
};

export async function uploadDocument(file: File): Promise<Document> {
  if (!USE_MOCK) {
    const body = new FormData();
    body.append("file", file);
    const { data } = await http.post<Document>("/documents", body);
    return data;
  }
  await delay();
  requireSession();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const sourceType = EXT_TO_TYPE[ext];
  if (!sourceType) throw new ApiError("Unsupported file format.");

  // Tiêu đề tạm suy từ tên tệp; backend thật sẽ lấy tiêu đề trong nội dung.
  const guessedTitle = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

  const doc: Document = {
    id: `doc_${Math.random().toString(36).slice(2, 10)}`,
    title: guessedTitle,
    sourceType,
    fileName: file.name,
    fileSize: file.size,
    status: "PENDING",
    error: null,
    chunkCount: 0,
    createdAt: new Date().toISOString(),
  };
  mock.addDocument(doc);
  mock.scheduleIngest(doc.id);
  return copy(doc);
}

export async function deleteDocument(id: string): Promise<void> {
  if (!USE_MOCK) {
    await http.delete(`/documents/${id}`);
    return;
  }
  await delay();
  requireSession();
  mock.removeDocument(id);
}

// ───────────────────────────── Hội thoại ─────────────────────────────

const PAGE_SIZE = 20;

export async function listConversations(page = 1): Promise<Paginated<Conversation>> {
  if (!USE_MOCK) {
    const { data } = await http.get<Paginated<Conversation>>("/conversations", {
      params: { page },
    });
    return data;
  }
  await delay();
  requireSession();
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: copy(mock.conversations.slice(start, start + PAGE_SIZE)),
    total: mock.conversations.length,
  };
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  if (!USE_MOCK) {
    const { data } = await http.get<ConversationDetail>(`/conversations/${id}`);
    return {
      ...data,
      // Message.citations là cột Json? — tin nhắn của KHÁCH không có nguồn nên
      // backend trả null. Chuẩn hoá về mảng rỗng để component cứ .map() thoải mái.
      messages: data.messages.map((m) => ({ ...m, citations: m.citations ?? [] })),
    };
  }
  await delay();
  requireSession();
  const conversation = mock.conversations.find((c) => c.id === id);
  const messages = mock.messagesByConversation.get(id);
  if (!conversation || !messages) throw new ApiError("Conversation not found.", 404);
  return { ...copy(conversation), messages: copy(messages) };
}

// ───────────────────────────── Thống kê ─────────────────────────────

export async function getUsage(days = 30): Promise<Usage> {
  if (!USE_MOCK) {
    const { data } = await http.get<Usage>("/usage", { params: { days } });
    return {
      ...data,
      // Postgres date_trunc trả kiểu date, JSON hoá thành "2026-08-15T00:00:00.000Z".
      // format.ts lại ghép `${iso}T00:00:00` nên cần đúng dạng YYYY-MM-DD,
      // không cắt là ra Invalid Date và biểu đồ trống trơn.
      daily: data.daily.map((d) => ({ ...d, date: String(d.date).slice(0, 10) })),
    };
  }
  await delay();
  requireSession();
  const daily = mock.buildDaily(days);
  const now = new Date();
  // Chỉ lấy phần thuộc tháng dương lịch này, giống cách backend đếm.
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const usedThisMonth = daily
    .filter((d) => d.date.startsWith(monthKey))
    .reduce((sum, d) => sum + d.aiMessages, 0);
  const limit = 100; // gói FREE trong plan-limits.ts

  return {
    totalMessages: daily.reduce((sum, d) => sum + d.aiMessages, 0),
    totalDocuments: mock.documents.length,
    totalChunks: mock.documents.reduce((sum, d) => sum + d.chunkCount, 0),
    daily,
    quota: {
      plan: "FREE",
      used: usedThisMonth,
      limit,
      remaining: Math.max(0, limit - usedThisMonth),
      resetAt: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      ).toISOString(),
    },
  };
}

// ───────────────────────────── Cài đặt công ty ─────────────────────────────

export async function updateTenant(patch: TenantPatch): Promise<Tenant> {
  if (!USE_MOCK) {
    const { data } = await http.patch<Tenant>("/tenant", patch);
    return data;
  }
  await delay();
  requireSession();
  mock.patchTenant(patch);
  return copy(mock.tenant);
}
