/**
 * KHO DỮ LIỆU GIẢ — chỉ api.ts được phép import file này.
 *
 * Đây là một kho có trạng thái (mutable store), không phải hằng số: upload
 * một tài liệu là thật sự thêm vào mảng, xoá là thật sự bỏ đi, đổi cài đặt
 * là thật sự ghi đè. Nhờ vậy giao diện cư xử đúng như khi đã nối backend.
 *
 * Khi nối API thật: xoá file này và đặt USE_MOCK = false trong api.ts.
 */

import type { Conversation, Document, Message, Tenant, User } from "./types";

/** Mốc thời gian cố định lúc nạp trang, để "5 min ago" không nhảy lung tung. */
const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(NOW - ms).toISOString();

/** Random có hạt giống — số liệu dao động tự nhiên nhưng không đổi mỗi lần F5. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ───────────────────────────── Công ty & người dùng ─────────────────────────────

export const user: User = {
  id: "usr_01",
  email: "chi.nguyen@acme.vn",
  role: "OWNER",
};

export const tenant: Tenant = {
  id: "tnt_01",
  name: "ACME Inc.",
  slug: "acme",
  publicKey: "pk_demo123abc456def789",
  plan: "FREE",
  allowedDomains: ["acme.vn", "shop.acme.vn"],
  widgetTitle: "ACME Customer Support",
  widgetColor: "#166F5C",
  widgetGreeting: "Hi! How can I help you today?",
};

// ───────────────────────────── Tài liệu ─────────────────────────────

export const documents: Document[] = [
  {
    id: "doc_01",
    title: "2025 Return & Refund Policy",
    sourceType: "PDF",
    fileName: "return-policy-2025.pdf",
    fileSize: 1_248_576,
    status: "READY",
    error: null,
    chunkCount: 42,
    createdAt: ago(26 * DAY),
  },
  {
    id: "doc_02",
    title: "Product Warranty Terms",
    sourceType: "DOCX",
    fileName: "warranty-terms.docx",
    fileSize: 486_400,
    status: "READY",
    error: null,
    chunkCount: 28,
    createdAt: ago(19 * DAY),
  },
  {
    id: "doc_03",
    title: "Customer FAQ",
    sourceType: "MD",
    fileName: "customer-faq.md",
    fileSize: 38_912,
    status: "READY",
    error: null,
    chunkCount: 63,
    createdAt: ago(12 * DAY),
  },
  {
    id: "doc_04",
    title: "Q3 Product Catalogue",
    sourceType: "PDF",
    fileName: "q3-catalogue-scan.pdf",
    fileSize: 8_912_896,
    status: "FAILED",
    error: "PDF contains no text — likely a scanned image, needs OCR",
    chunkCount: 0,
    createdAt: ago(5 * DAY),
  },
  {
    id: "doc_05",
    title: "Payment & Invoicing Guide",
    sourceType: "PDF",
    fileName: "payment-guide.pdf",
    fileSize: 2_097_152,
    status: "PROCESSING",
    error: null,
    chunkCount: 0,
    createdAt: ago(4 * MINUTE),
  },
  {
    id: "doc_06",
    title: "August Price List",
    sourceType: "TXT",
    fileName: "august-price-list.txt",
    fileSize: 12_288,
    status: "PENDING",
    error: null,
    chunkCount: 0,
    createdAt: ago(20_000),
  },
];

/**
 * Mô phỏng hàng đợi xử lý của backend: PENDING → PROCESSING → READY.
 * Nhờ đó thấy được hiệu ứng poll trên /documents mà không cần server.
 */
export function scheduleIngest(id: string, toProcessing = 4_000, toReady = 9_000) {
  const find = () => documents.find((d) => d.id === id);
  setTimeout(() => {
    const doc = find();
    if (doc && doc.status === "PENDING") doc.status = "PROCESSING";
  }, toProcessing);
  setTimeout(() => {
    const doc = find();
    if (doc && doc.status === "PROCESSING") {
      doc.status = "READY";
      const kb = Math.max(1, Math.round((doc.fileSize ?? 40_000) / 1024));
      doc.chunkCount = Math.max(3, Math.round(kb / 24) + 5);
    }
  }, toReady);
}

// Hai tài liệu chưa xong ở trên tự chạy tiếp ngay khi mở dashboard.
scheduleIngest("doc_06", 5_000, 11_000);
scheduleIngest("doc_05", 0, 7_000);

export function addDocument(doc: Document) {
  documents.unshift(doc);
}

export function removeDocument(id: string) {
  const i = documents.findIndex((d) => d.id === id);
  if (i >= 0) documents.splice(i, 1);
}

export function patchTenant(patch: Partial<Tenant>) {
  Object.assign(tenant, patch);
}

// ───────────────────────────── Hội thoại ─────────────────────────────

type RawTurn = {
  q: string;
  a: string;
  confidence: number | null;
  cite?: [string, string][];
};

type RawConversation = {
  id: string;
  visitorId: string;
  minutesAgo: number;
  turns: RawTurn[];
};

const CITE = {
  returns: ["doc_01", "2025 Return & Refund Policy"] as [string, string],
  warranty: ["doc_02", "Product Warranty Terms"] as [string, string],
  faq: ["doc_03", "Customer FAQ"] as [string, string],
};

const RAW: RawConversation[] = [
  {
    id: "cnv_01",
    visitorId: "v_8f2a",
    minutesAgo: 6,
    turns: [
      {
        q: "I bought a shirt yesterday but the size is a bit tight — can I exchange it?",
        a: "Of course. ACME accepts size exchanges within 30 days of delivery, as long as the item is unworn with tags attached. Bring the item and your receipt to any store, or ship it to our warehouse at the address in your order confirmation email.",
        confidence: 0.91,
        cite: [CITE.returns],
      },
      {
        q: "Who pays the return shipping?",
        a: "If you're exchanging because the size doesn't fit, you cover the return shipping. If the exchange is due to our mistake (wrong item, wrong color, stitching defects), ACME covers shipping both ways.",
        confidence: 0.86,
        cite: [CITE.returns],
      },
    ],
  },
  {
    id: "cnv_02",
    visitorId: "v_31c7",
    minutesAgo: 47,
    turns: [
      {
        q: "How long is the warranty on the water purifier?",
        a: "ACME water purifiers come with a 24-month warranty on the unit and 12 months on the filter assembly, counted from the invoice date. The warranty covers manufacturing defects.",
        confidence: 0.88,
        cite: [CITE.warranty],
      },
      {
        q: "I lost my warranty card — what now?",
        a: "You're still covered if we can look up the serial number on the unit or you can provide the purchase invoice. If you have neither, our technicians will assess it based on the production date printed on the unit.",
        confidence: 0.58,
        cite: [CITE.warranty],
      },
      {
        q: "Does the warranty include scheduled filter replacements?",
        a: "Sorry, I don't have information about that.",
        confidence: 0.31,
      },
    ],
  },
  {
    id: "cnv_03",
    visitorId: "v_a04d",
    minutesAgo: 3 * 60 + 20,
    turns: [
      {
        q: "When will my order reach Da Nang?",
        a: "Orders to central Da Nang usually take 1–2 business days; outer districts take 2–4. You can track your order with the tracking code in your confirmation email for an exact estimate.",
        confidence: 0.83,
        cite: [CITE.faq],
      },
      {
        q: "Do you deliver on weekends?",
        a: "Our carrier delivers on Saturdays. Sundays and public holidays are off — your order will arrive the next business day.",
        confidence: 0.72,
        cite: [CITE.faq],
      },
      {
        q: "I'd like to change my delivery address.",
        a: "You can change the address any time before the order is handed to the carrier, by replying to your confirmation email or calling our hotline. Once it has left the warehouse, you'll need to contact the carrier directly.",
        confidence: 0.64,
        cite: [CITE.faq],
      },
    ],
  },
  {
    id: "cnv_04",
    visitorId: "v_77b1",
    minutesAgo: 9 * 60,
    turns: [
      {
        q: "I forgot my account password — how do I reset it?",
        a: 'Click "Forgot password" on the sign-in screen and enter your registered email. We\'ll send you a reset link that stays valid for 30 minutes.',
        confidence: 0.94,
        cite: [CITE.faq],
      },
      {
        q: "I didn't get the email.",
        a: "Please check your Spam or Promotions folder. If it hasn't arrived after 10 minutes, you may have registered with a different email — in that case, contact our hotline to verify your identity.",
        confidence: 0.79,
        cite: [CITE.faq],
      },
    ],
  },
  {
    id: "cnv_05",
    visitorId: "v_c9e5",
    minutesAgo: 26 * 60,
    turns: [
      {
        q: "How long do refunds take to reach my account?",
        a: "Once ACME receives and inspects the returned item, refunds are issued within 5–7 business days. For credit cards, the posting time depends on your bank and can take another 3–5 days.",
        confidence: 0.89,
        cite: [CITE.returns],
      },
      {
        q: "Can you refund to my MoMo wallet instead?",
        a: "By default, refunds go back to your original payment method. If you'd prefer an e-wallet, mention it in your refund request and our accounting team will handle it.",
        confidence: 0.47,
        cite: [CITE.returns],
      },
    ],
  },
  {
    id: "cnv_06",
    visitorId: "v_2d8f",
    minutesAgo: 2 * 24 * 60 + 180,
    turns: [
      {
        q: "The product broke after 3 months. I want a refund, not a repair.",
        a: "Within the first 30 days, ACME offers replacement or refund. After 30 days, technical faults are handled under warranty — meaning repair or part replacement rather than a refund.",
        confidence: 0.81,
        cite: [CITE.returns, CITE.warranty],
      },
      {
        q: "What if it breaks again after two repairs?",
        a: "If the same fault recurs after two repairs, the product is considered for a full replacement. The final decision is made by our technical team after inspection.",
        confidence: 0.55,
        cite: [CITE.warranty],
      },
      {
        q: "Who do I contact to file a complaint?",
        a: "Send your complaint to hotro@acme.vn with your order number and photos of the product. Our customer care team responds within 1 business day.",
        confidence: 0.76,
        cite: [CITE.faq],
      },
      {
        q: "Thank you.",
        a: "You're very welcome! Have a great day.",
        confidence: 0.95,
      },
    ],
  },
  {
    id: "cnv_07",
    visitorId: "v_5e10",
    minutesAgo: 4 * 24 * 60,
    turns: [
      {
        q: "Can you issue a VAT invoice?",
        a: "Yes. Provide your company name, tax code, and address when placing the order, or send them within 7 days of purchase. Past that window, we can no longer issue an invoice for that order.",
        confidence: 0.87,
        cite: [CITE.faq],
      },
      {
        q: "Where do I send the invoice details?",
        a: "Send them to hoadon@acme.vn along with your order number.",
        confidence: 0.68,
        cite: [CITE.faq],
      },
    ],
  },
  {
    id: "cnv_08",
    visitorId: "v_b6a3",
    minutesAgo: 6 * 24 * 60 + 300,
    turns: [
      {
        q: "Do you sell wholesale? I'd like to order 200 units.",
        a: "Sorry, I don't have information about that.",
        confidence: 0.28,
      },
      {
        q: "Then give me the sales department's phone number.",
        a: "Please call our hotline at 1900 6868 (8am–8pm daily) and the operator will transfer you to the sales team.",
        confidence: 0.52,
        cite: [CITE.faq],
      },
    ],
  },
];

export const conversations: Conversation[] = [];
export const messagesByConversation = new Map<string, Message[]>();

for (const raw of RAW) {
  const start = NOW - raw.minutesAgo * MINUTE;
  const list: Message[] = [];

  raw.turns.forEach((turn, i) => {
    const at = start + i * 90_000;
    list.push({
      id: `${raw.id}_m${i * 2}`,
      role: "USER",
      content: turn.q,
      citations: [],
      confidence: null,
      feedback: null, // chỉ chấm được câu của bot
      createdAt: new Date(at).toISOString(),
    });
    list.push({
      id: `${raw.id}_m${i * 2 + 1}`,
      role: "ASSISTANT",
      content: turn.a,
      citations: (turn.cite ?? []).map(([documentId, title], k) => ({
        chunkId: `chk_${raw.id}_${i}_${k}`,
        documentId,
        title,
      })),
      confidence: turn.confidence,
      // Câu bot tự nhận là không chắc thì cho 👎, còn lại để trống —
      // dựng sẵn vài mẫu để xem được bộ lọc "câu bị chê" khi chạy mock.
      feedback:
        turn.confidence != null && turn.confidence < 0.6 ? "DOWN" : null,
      createdAt: new Date(at + 4_000).toISOString(),
    });
  });

  messagesByConversation.set(raw.id, list);
  conversations.push({
    id: raw.id,
    visitorId: raw.visitorId,
    messageCount: list.length,
    dislikedCount: list.filter((m) => m.feedback === "DOWN").length,
    preview: raw.turns[0].q,
    createdAt: new Date(start).toISOString(),
    updatedAt: list[list.length - 1].createdAt,
  });
}

conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

// ───────────────────────────── Usage ─────────────────────────────

/**
 * 30 ngày tin nhắn AI. Có nhịp tuần (cuối tuần thấp hơn), xu hướng tăng nhẹ,
 * một ngày cao đột biến và một ngày gần như lặng — giống dữ liệu thật.
 */
export function buildDaily(days: number) {
  const rand = seeded(20250815);
  const out: { date: string; aiMessages: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(NOW - i * DAY);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.45 : 1;
    const trend = 1 + (days - i) / (days * 2.2);
    const noise = 0.65 + rand() * 0.8;

    let value = Math.round(26 * weekend * trend * noise);
    if (i === 8) value = Math.round(value * 2.4); // ngày chạy khuyến mãi
    if (i === 17) value = Math.max(1, Math.round(value * 0.15)); // ngày website bảo trì

    out.push({ date: d.toISOString().slice(0, 10), aiMessages: Math.max(0, value) });
  }

  return out;
}
