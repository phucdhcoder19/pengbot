-- Tìm kiếm từ khoá KHÔNG PHÂN BIỆT DẤU cho tiếng Việt.
--
-- VẤN ĐỀ: khách gõ "hoan tien" (không dấu — cách gõ rất phổ biến khi chat)
-- thì nhánh full-text không khớp được "hoàn tiền" trong tài liệu, vì
-- to_tsvector('simple', ...) giữ nguyên dấu. Cả hai phía phải được bỏ dấu
-- thì mới gặp nhau.
--
-- CÁCH LÀM: một text search configuration riêng, chép từ 'simple' rồi chèn
-- từ điển `unaccent` vào trước. Nhờ vậy CẢ tài liệu (cột tsv) LẪN câu hỏi
-- (to_tsquery) đều đi qua cùng một phép chuẩn hoá — bốn tổ hợp có-dấu /
-- không-dấu đều khớp nhau.
--
-- ĐÃ KIỂM: unaccent bản đi kèm Postgres 16 xử lý đúng cả chữ hai dấu
-- (ầ ặ ỡ ữ ị) lẫn đ → d, nên KHÔNG cần bộ unaccent.rules tuỳ chỉnh.
--
-- ĐÁNH ĐỔI: bỏ dấu làm tiếng Việt sinh ra đồng âm ("ma" ← mà/má/mã/mạ), tức
-- tăng recall và giảm precision ở nhánh từ khoá. Chấp nhận được vì (1) nhánh
-- vector vẫn phân biệt được nghĩa, và (2) RRF xếp thấp những chunk chỉ một
-- nhánh thích.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 'simple' = không stemming, không stop-word (Postgres không có từ điển
-- tiếng Việt). Ta chỉ thêm đúng một việc: bỏ dấu.
DROP TEXT SEARCH CONFIGURATION IF EXISTS vietnamese;
CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);

-- Phải liệt kê đủ mọi loại token chứa chữ. Thiếu 'word' (token có ký tự
-- ngoài ASCII) là đúng phần tiếng Việt có dấu không được bỏ dấu — tức là
-- hỏng đúng thứ ta đang sửa.
ALTER TEXT SEARCH CONFIGURATION vietnamese
  ALTER MAPPING FOR
    asciiword, asciihword, hword_asciipart,
    word, hword, hword_part,
    numword, numhword, hword_numpart
  WITH unaccent, simple;

-- Postgres 16 không có ALTER COLUMN ... SET EXPRESSION (mãi PG17 mới có),
-- nên phải xoá rồi tạo lại cột. Thao tác này viết lại toàn bộ bảng Chunk và
-- dựng lại index GIN — với vài nghìn chunk là chuyện vài giây, nhưng nhớ
-- điều đó khi bảng đã lớn.
--
-- DROP COLUMN tự xoá luôn Chunk_tsv_idx vì index phụ thuộc vào cột.
ALTER TABLE "Chunk" DROP COLUMN "tsv";

ALTER TABLE "Chunk" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('vietnamese'::regconfig, "content")) STORED;

CREATE INDEX "Chunk_tsv_idx" ON "Chunk" USING GIN ("tsv");
