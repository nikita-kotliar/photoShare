const { colorFamily } = require('./colors');
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    // Сам google_id назовні не віддаємо, лише факт зв'язку (позначка в налаштуваннях)
    googleLinked: Boolean(user.googleId),
    createdAt: user.createdAt,
  };
}

// Публічний профіль: без email, role, isActive та хеша пароля
function toProfile(user, photosCount) {
  return {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    createdAt: user.createdAt,
    photosCount,
  };
}

function toAuthor(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  };
}

// stats: { averageRating, ratingsCount, myRating } з ratingsService.statsFor
function toPhoto(photo, stats = {}) {
  return {
    id: photo.id,
    slug: photo.slug,
    url: photo.url,
    description: photo.description,
    tags: (photo.tags ?? []).map((item) => item.tag.name),
    colors: (photo.colors ?? []).map((hex) => ({ hex, family: colorFamily(hex) })),
    author: toAuthor(photo.author),
    averageRating: stats.averageRating ?? null,
    ratingsCount: stats.ratingsCount ?? 0,
    commentsCount: photo._count?.comments ?? 0,
    myRating: stats.myRating ?? null,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}

function toComment(comment) {
  return {
    id: comment.id,
    photoId: comment.photoId,
    text: comment.text,
    author: toAuthor(comment.author),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function toRating(rating) {
  return {
    id: rating.id,
    photoId: rating.photoId,
    value: rating.value,
    user: toAuthor(rating.user),
    createdAt: rating.createdAt,
  };
}

function toLink(link) {
  return {
    id: link.id,
    photoId: link.photoId,
    url: link.url,
    qrCode: link.qrCode,
    transformations: link.transformations,
    createdAt: link.createdAt,
  };
}

// Сповіщення: хто (actor), про яку світлину і деталі (оцінка, код досягнення)
function toNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    read: Boolean(notification.readAt),
    actor: notification.actor ? toAuthor(notification.actor) : null,
    photo: notification.photo
      ? { id: notification.photo.id, slug: notification.photo.slug, url: notification.photo.url }
      : null,
    data: notification.data ?? {},
    createdAt: notification.createdAt,
  };
}

module.exports = {
  toNotification,
  toPublicUser,
  toProfile,
  toAuthor,
  toPhoto,
  toComment,
  toRating,
  toLink,
};
