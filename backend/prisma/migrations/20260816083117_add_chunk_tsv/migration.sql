-- Hybrid search: thêm nhánh tìm theo từ khoá (Postgres full-text search)
-- bên cạnh nhánh vector sẵn có. Xem src/rag/retriever.service.ts.
--
-- ⚠️ File này được SỬA TAY sau khi Prisma sinh. Prisma chỉ biết tạo cột
-- tsvector thường; ta cần cột GENERATED để Postgres tự tính từ `content` mỗi
-- lần INSERT/UPDATE — code ingest không phải làm gì, và không thể quên đồng bộ.
--
-- 'simple' = tách theo khoảng trắng + hạ chữ thường, không stemming, không bỏ
-- stop-word. Chọn vì Postgres không có từ điển tiếng Việt; với tiếng Việt
-- (không biến hình) thì 'simple' là đủ. Stop-word tiếng Việt lọc ở phía code.

-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;

-- CreateIndex
-- GIN cho tsvector, giống HNSW cho vector. Khác HNSW, index này khai báo được
-- trong schema.prisma (@@index type: Gin) nên nằm trong migration bình thường.
CREATE INDEX "Chunk_tsv_idx" ON "Chunk" USING GIN ("tsv");
