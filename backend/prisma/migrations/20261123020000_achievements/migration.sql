-- Досягнення (TASK-070): отримані значки користувача, кожен не більше одного разу

-- CreateEnum
CREATE TYPE "AchievementCode" AS ENUM ('FIRST_PHOTO', 'TEN_PHOTOS', 'COMMENTATOR', 'CRITIC', 'FAVORITE');

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" "AchievementCode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_code_key" ON "user_achievements"("user_id", "code");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

