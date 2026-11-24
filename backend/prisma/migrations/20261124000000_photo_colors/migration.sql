-- Палітра світлини (TASK-074): до 5 головних кольорів від Cloudinary і їхні групи для пошуку
ALTER TABLE "photos" ADD COLUMN "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "photos" ADD COLUMN "color_families" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "photos_color_families_idx" ON "photos" USING GIN ("color_families");
