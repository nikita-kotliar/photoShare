
const db = require('../config/db');

// Find-or-create: існуючі теги беремо, нових створюємо.
// Повертає записи тегів з id у тому самому порядку, що й names.
//
// createMany зі skipDuplicates працює як INSERT ... ON CONFLICT DO NOTHING,
// тому два одночасні запити з тим самим новим тегом не створять дубліката
// і не впадуть на унікальному індексі.
//
// names мають бути вже нормалізовані (validators/tags.js).
async function findOrCreate(names, client = db) {
  if (names.length === 0) return [];

  await client.tag.createMany({
    data: names.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const tags = await client.tag.findMany({
    where: { name: { in: names } },
  });

  // findMany не гарантує порядок відповідно до names,
  // тому відновлюємо його явно.
  const byName = new Map(tags.map((tag) => [tag.name, tag]));

  return names.map((name) => byName.get(name)).filter(Boolean);
}

// Вкладене створення зв'язків photo_tags при створенні світлини.
function nestedCreate(tags) {
  return {
    create: tags.map((tag) => ({
      tag: {
        connect: { id: tag.id },
      },
    })),
  };
}

// Заміна всіх тегів світлини:
// старі зв'язки видаляємо, нові створюємо.
// ВАЖЛИВО: викликати всередині транзакції.
async function replacePhotoTags(client, photoId, names) {
  const tags = await findOrCreate(names, client);

  await client.photoTag.deleteMany({
    where: { photoId },
  });

  if (tags.length > 0) {
    await client.photoTag.createMany({
      data: tags.map((tag) => ({
        photoId,
        tagId: tag.id,
      })),
    });
  }
}

module.exports = {
  findOrCreate,
  nestedCreate,
  replacePhotoTags,
};

