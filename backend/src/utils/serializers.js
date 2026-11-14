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

module.exports = {
  toPublicUser,
  toProfile,
  toAuthor,
  toPhoto,
  toComment,
  toRating,
  toLink,
};
