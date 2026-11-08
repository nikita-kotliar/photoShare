const cloudinary = require('../config/cloudinary');

const FOLDER = 'photoshare';

const EFFECTS = {
  grayscale: 'grayscale',
  sepia: 'sepia',
  blur: 'blur:300',
};

function toCloudinary({ effect, angle, crop } = {}) {
  const steps = [];
  if (crop === 'square') steps.push({ aspect_ratio: '1:1', crop: 'fill', gravity: 'auto' });
  if (angle) steps.push({ angle });
  if (effect) steps.push({ effect: EFFECTS[effect] });
  return steps;
}

function transformedUrl(publicId, transformations) {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'image',
    transformation: toCloudinary(transformations),
  });
}

function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
}

module.exports = { EFFECTS, toCloudinary, transformedUrl, uploadImage, deleteImage };
