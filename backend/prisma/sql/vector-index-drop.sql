-- Xóa index HNSW trước khi chạy `prisma migrate dev`.
--
-- TẠI SAO CẦN: Prisma so sánh DB thật với lịch sử migration. Index này được tạo
-- ngoài migration nên Prisma coi là "drift" và ĐÒI RESET TOÀN BỘ DB — không chỉ
-- cảnh báo. Bỏ index đi thì DB khớp lịch sử, migrate chạy bình thường.
--
-- CHU TRÌNH:
--   npm run db:vector-index:drop
--   npx prisma migrate dev --name <ten>
--   npm run db:vector-index          (chỉ khi cần index để đo hiệu năng)

DROP INDEX IF EXISTS "Chunk_embedding_idx";
