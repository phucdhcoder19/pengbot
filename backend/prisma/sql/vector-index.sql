-- Index HNSW cho vector search trên Chunk.embedding.
--
-- TẠI SAO KHÔNG NẰM TRONG MIGRATION:
-- Prisma không hiểu kiểu vector nên cũng không khai báo được index HNSW trong
-- schema.prisma. Nếu để index trong migration, mỗi lần chạy `prisma migrate dev`
-- Prisma sẽ thấy index "lạ" trong DB, coi là drift, và tự sinh migration DROP nó.
--
-- CÁCH DÙNG: npm run db:vector-index
-- Chạy lại sau mỗi lần `prisma migrate dev` hoặc `migrate reset`.
-- (`prisma migrate deploy` KHÔNG drop index này, nên production không bị ảnh hưởng.)
--
-- vector_cosine_ops khớp với toán tử <=> dùng trong truy vấn retrieve.

CREATE INDEX IF NOT EXISTS "Chunk_embedding_idx"
  ON "Chunk" USING hnsw (embedding vector_cosine_ops);
