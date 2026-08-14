-- Email trở thành unique toàn hệ thống thay vì unique theo từng tenant.
-- Đổi lại: login chỉ cần email + password, không phải hỏi thêm mã công ty.

-- DropIndex
DROP INDEX "User_tenantId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
