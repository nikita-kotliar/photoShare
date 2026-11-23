-- Вхід через Google (TASK-066): ідентифікатор акаунта Google і пароль, необов'язковий
-- для таких акаунтів. Звичайна реєстрація, як і раніше, вимагає пароль (zod)
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Один акаунт Google - один користувач. NULL у PostgreSQL не порушує унікальність
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- Без пароля і без Google увійти в акаунт неможливо, тож такого рядка бути не повинно.
-- Prisma не описує CHECK у схемі, тому обмеження лише тут
ALTER TABLE "users" ADD CONSTRAINT "users_login_method_check"
  CHECK ("password_hash" IS NOT NULL OR "google_id" IS NOT NULL);
