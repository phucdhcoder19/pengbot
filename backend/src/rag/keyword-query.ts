/**
 * Chuẩn hoá câu hỏi cho nhánh tìm-theo-từ-khoá của hybrid search.
 *
 * File riêng, KHÔNG phụ thuộc Prisma hay Nest: đây là logic văn bản thuần,
 * và tách ra thì `npm test` chạy được mà không cần sinh Prisma Client —
 * giống rrf.ts.
 */
/**
 * Bỏ dấu tiếng Việt, giống hệt cái `unaccent` của Postgres làm với cột tsv.
 *
 * NFD tách chữ cái khỏi dấu thanh/dấu mũ rồi ta xoá phần dấu (U+0300–U+036F).
 * Riêng đ/Đ là ký tự độc lập, KHÔNG tách được bằng NFD → phải thay tay.
 */
export function stripAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Stop-word tiếng Việt: từ xuất hiện khắp nơi, không mang thông tin để tìm.
 *
 * VÌ SAO CẦN: ts_rank của Postgres KHÔNG có IDF — nó không biết "của" phổ biến
 * hơn "acm-2024-3391". Không lọc thì chunk nào lặp "của tôi" nhiều sẽ được xếp
 * cao dù chẳng liên quan. Postgres cũng không có từ điển tiếng Việt để tự bỏ.
 *
 * Danh sách cố ý ngắn: chỉ hư từ thật sự. "phí", "đơn", "hàng" là từ nội dung,
 * KHÔNG được bỏ dù phổ biến trong FAQ thương mại.
 */
const STOP_WORDS = new Set(
  `và với của cho từ trong ngoài trên dưới về đến tới tại theo bằng như
   là có không chưa được bị phải nên cần đang sẽ đã vẫn cũng đều rất quá
   thì mà nhưng hay hoặc nếu vì do bởi
   tôi tao mình bạn anh chị em ông bà họ chúng ta các những mọi mỗi
   này đó kia ấy đây đấy nào đâu gì sao thế vậy nhiêu mấy
   ạ à ơi nhé nhỉ ư hả hở ha`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Stop-word ĐÃ BỎ DẤU — dùng cho câu hỏi khách gõ không dấu.
 *
 * VÌ SAO KHÔNG chỉ bỏ dấu cả STOP_WORDS ở trên: bỏ dấu tiếng Việt sinh ra rất
 * nhiều đồng âm, và nhiều hư từ đụng đúng từ nội dung của FAQ thương mại —
 * "mấy"→"may" đụng MÁY, "bạn"→"ban" đụng BÁN, "chị"→"chi" đụng CHI PHÍ,
 * "mà"→"ma" đụng MÃ (đơn), "đã"→"da" đụng DA. Lọc theo bảng đó là âm thầm
 * vứt mất chính những từ khoá đắt giá nhất.
 *
 * Nên danh sách này chỉ giữ hư từ mà dạng không dấu của nó gần như không bao
 * giờ là từ nội dung. Quy tắc thêm từ mới: bỏ dấu ra, nếu tưởng tượng được
 * một tenant có sản phẩm mang tên đó thì ĐỪNG thêm.
 */
const STOP_WORDS_BARE = new Set(
  `và với của trong ngoài trên dưới theo như là có không chưa được bị phải
   nên đang sẽ vẫn cũng đều rất thì nhưng hay hoặc nếu bởi mình em chúng
   các này kia ấy nào gì sao nhiêu ơi nhỉ`
    .split(/\s+/)
    .filter(Boolean)
    .map(stripAccents),
);

/**
 * Chuẩn bị câu hỏi cho nhánh từ khoá: bỏ stop-word và token 1 ký tự.
 * Trả về chuỗi rỗng nếu chẳng còn gì đáng tìm → nhánh từ khoá sẽ trả [].
 *
 * Chỉ LỌC ở đây, KHÔNG tách từ theo kiểu riêng: việc tách (tokenize) để
 * Postgres làm bằng cùng config 'vietnamese' đã dùng cho cột tsv. Tự tách
 * trong TypeScript sẽ lệch — vd Postgres bẻ "ACM-2024-3391" thành 'acm',
 * '-2024', '-3391'; nếu ta gửi '2024' thì không khớp '-2024'.
 *
 * Cũng KHÔNG bỏ dấu chuỗi trả về: Postgres lo việc đó qua config, và giữ
 * nguyên bản gốc thì đổi config sau này không phải sửa chỗ này.
 */
export function keywordQueryText(question: string): string {
  return question
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')) // bỏ dấu câu hai đầu
    .filter((w) => {
      if (w.length < 2) return false;
      // Hai bảng, hai mục đích: gõ CÓ dấu thì lọc được đầy đủ (biết chắc
      // "cho" là hư từ chứ không phải "chó"); gõ KHÔNG dấu thì chỉ dám lọc
      // những từ không thể nhầm.
      return !STOP_WORDS.has(w) && !STOP_WORDS_BARE.has(stripAccents(w));
    })
    .join(' ');
}
