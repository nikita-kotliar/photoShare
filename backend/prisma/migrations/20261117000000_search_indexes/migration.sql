-- Пошук (TASK-043): фільтр ratingMin і sort=rating рахують AVG(value) по photo_id.
-- З цим індексом агрегат читає лише індекс, без звернень до таблиці ratings
CREATE INDEX "ratings_photo_id_value_idx" ON "ratings"("photo_id", "value");
