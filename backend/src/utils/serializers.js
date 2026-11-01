function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
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

function toPhoto(photo) {
  return {
    id: photo.id,
    slug: photo.slug,
    url: photo.url,
    description: photo.description,
    // ====== tags arrive with TASK-020, ratings with TASK-042 ======
    tags: [],
    author: toAuthor(photo.author),
    averageRating: null,
    ratingsCount: 0,
    commentsCount: photo._count?.comments ?? 0,
    myRating: null,
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

module.exports = { toPublicUser, toAuthor, toPhoto, toComment, toLink };
