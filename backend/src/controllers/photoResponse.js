const ratingsService = require('../services/ratingsService');
const { toPhoto } = require('../utils/serializers');

// Світлини для відповіді API разом з рейтингом: середнє, кількість оцінок і оцінка поточного
// користувача. Рейтинг рахується одним агрегатом на всю сторінку, а не запитом на кожну світлину
async function withRatings(photos, viewer) {
  const stats = await ratingsService.statsFor(
    photos.map((photo) => photo.id),
    viewer,
  );
  return photos.map((photo) => toPhoto(photo, stats.get(photo.id)));
}

module.exports = { withRatings };
