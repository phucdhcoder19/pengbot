/**
 * Nhận diện câu xã giao để trả lời ngay, KHÔNG đi qua RAG.
 *
 * VẤN ĐỀ: khách gõ "xin chào" thì hệ thống vẫn embed câu đó, tìm trong tài
 * liệu, không thấy gì liên quan rồi đáp "tôi không có thông tin". Đo trên dữ
 * liệu thật: một lời chào tốn ~1900 token và bị tính một lượt vào quota tháng
 * của tenant — trả tiền để bot nói "tôi không biết".
 *
 * CÁCH LÀM: chốt chặn đặt TRƯỚC bước embed. Khớp thì trả câu có sẵn: tức thì,
 * không gọi mạng, không tốn token, không sinh UsageEvent.
 *
 * File riêng, KHÔNG phụ thuộc Prisma hay Nest — logic văn bản thuần, test chạy
 * được mà không cần sinh Prisma Client. Giống rrf.ts và keyword-query.ts.
 */
import { stripAccents } from './keyword-query';

export type SmallTalkKind =
  | 'greeting'
  | 'thanks'
  | 'goodbye'
  | 'identity'
  | 'capability';

/**
 * Câu trả lời sẵn cho từng nhóm.
 *
 * Mọi câu đều kết bằng một lời mời hỏi tiếp: khách vào widget là đang cần gì
 * đó, đáp cụt lủn "Chào bạn." là bỏ lỡ đúng khoảnh khắc họ sẵn sàng hỏi nhất.
 *
 * Cố ý KHÔNG nhắc tên tenant hay lĩnh vực cụ thể: module này dùng chung cho
 * mọi tenant, mà tenant có thể là shop giày hay phòng khám.
 */
const REPLIES: Record<SmallTalkKind, string> = {
  greeting:
    'Xin chào! Mình là trợ lý ảo, có thể giải đáp thắc mắc dựa trên tài liệu của chúng tôi. Bạn cần hỗ trợ gì ạ?',
  thanks: 'Không có gì ạ! Bạn cần hỗ trợ thêm điều gì cứ hỏi mình nhé.',
  goodbye:
    'Tạm biệt bạn, hẹn gặp lại! Khi cần hỗ trợ bạn cứ quay lại đây nhé.',
  identity:
    'Mình là trợ lý ảo, trả lời dựa trên tài liệu chính thức của chúng tôi. Bạn muốn tìm hiểu về điều gì ạ?',
  capability:
    'Mình có thể trả lời các câu hỏi dựa trên tài liệu của chúng tôi. Bạn cứ đặt câu hỏi cụ thể, mình sẽ tra giúp bạn nhé.',
};

/**
 * Câu hỏi dài hơn ngần này thì KHÔNG coi là xã giao nữa.
 *
 * Đây là lưới an toàn quan trọng nhất của cả file: "chào shop, cho mình hỏi
 * học phí bao nhiêu" có chứa lời chào nhưng là câu hỏi thật. Trả lời xã giao
 * cho nó là nuốt mất câu hỏi của khách — sai nghiêm trọng hơn nhiều so với
 * việc bỏ sót một lời chào.
 */
const MAX_WORDS = 6;

/**
 * Hư từ và cách xưng hô bám quanh lời chào: "chào shop nhé", "cảm ơn bạn ạ".
 *
 * Chỉ dùng cho nhóm chào / cảm ơn / tạm biệt. Nhóm identity và capability khớp
 * TRƯỚC bước này, vì "bạn" ở đó là thành phần bắt buộc của câu ("bạn là ai"),
 * bỏ đi thì không còn gì để khớp.
 */
const FILLERS = new Set(
  `xin cho a ah ak oi nhe nha nhi voi the vay di ha hen
   shop ad admin bot ban minh em anh chi cac moi nguoi`
    .split(/\s+/)
    .filter(Boolean),
);

/// Khớp SAU khi đã gỡ hư từ. Vd "chào shop nhé" → "chao".
const PHRASES: Record<string, SmallTalkKind> = {
  chao: 'greeting',
  'chao buoi sang': 'greeting',
  'chao buoi chieu': 'greeting',
  'chao buoi toi': 'greeting',
  hello: 'greeting',
  helo: 'greeting',
  hallo: 'greeting',
  hi: 'greeting',
  hii: 'greeting',
  hey: 'greeting',
  alo: 'greeting',
  'a lo': 'greeting',
  'good morning': 'greeting',
  'good afternoon': 'greeting',
  'good evening': 'greeting',

  'cam on': 'thanks',
  'cam on nhieu': 'thanks',
  'cam on rat nhieu': 'thanks',
  'ok cam on': 'thanks',
  thanks: 'thanks',
  'thank you': 'thanks',
  tks: 'thanks',
  thks: 'thanks',

  bye: 'goodbye',
  'bye bye': 'goodbye',
  goodbye: 'goodbye',
  'good bye': 'goodbye',
  'tam biet': 'goodbye',
};

/// Khớp TRƯỚC khi gỡ hư từ, trên nguyên câu đã chuẩn hoá.
const QUESTIONS: Record<string, SmallTalkKind> = {
  'ban la ai': 'identity',
  'ban la gi': 'identity',
  'ban ten gi': 'identity',
  'ban ten la gi': 'identity',
  'ten ban la gi': 'identity',
  'ai day': 'identity',
  'ai vay': 'identity',
  'ban la nguoi hay may': 'identity',
  'ban la robot a': 'identity',
  'ban co phai nguoi that khong': 'identity',
  'who are you': 'identity',
  'what are you': 'identity',

  'ban lam duoc gi': 'capability',
  'ban giup duoc gi': 'capability',
  'ban giup gi duoc cho toi': 'capability',
  'ban co the giup gi': 'capability',
  'ban co the lam gi': 'capability',
  'ban ho tro gi': 'capability',
  'ban biet gi': 'capability',
  'giup duoc gi': 'capability',
  'co the giup gi': 'capability',
  'what can you do': 'capability',
};

/**
 * Chuẩn hoá về dạng so khớp được: bỏ dấu, bỏ dấu câu và emoji, gộp khoảng trắng.
 *
 * Bỏ dấu để "chào" và "chao" là một — khách chat gõ không dấu rất nhiều. Dùng
 * lại stripAccents của nhánh từ khoá thay vì viết bản thứ hai, để hai nơi không
 * bao giờ lệch nhau về cách hiểu "đ" hay chữ hai dấu.
 */
function normalize(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ') // dấu câu, emoji, ký tự lạ
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trả về câu đáp sẵn nếu là xã giao, ngược lại trả null để đi tiếp vào RAG.
 *
 * So khớp NGUYÊN CÂU chứ không tìm chuỗi con: "chào" nằm trong "chào giá" hay
 * "chào bán" là chuyện thường, khớp chuỗi con sẽ nuốt nhầm câu hỏi thật.
 */
export function smallTalkReply(question: string): string | null {
  const kind = detect(question);
  return kind ? REPLIES[kind] : null;
}

/// Tách riêng phần nhận diện để test soi được vào từng nhóm, và để chỗ gọi
/// muốn ghi log "đã chặn loại nào" thì có sẵn.
export function detectSmallTalk(question: string): SmallTalkKind | null {
  return detect(question);
}

function detect(question: string): SmallTalkKind | null {
  const text = normalize(question);
  if (!text) return null;

  const words = text.split(' ');
  if (words.length > MAX_WORDS) return null;

  // Nhóm câu hỏi về chính con bot: khớp trên nguyên văn, vì hư từ ở đây là
  // thành phần bắt buộc ("bạn" trong "bạn là ai").
  const asQuestion = QUESTIONS[text];
  if (asQuestion) return asQuestion;

  // Nhóm chào hỏi: gỡ hư từ rồi mới khớp, để "chào shop nhé" về được "chao".
  const bare = words.filter((w) => !FILLERS.has(w)).join(' ');
  if (!bare) return null;

  return PHRASES[bare] ?? null;
}
