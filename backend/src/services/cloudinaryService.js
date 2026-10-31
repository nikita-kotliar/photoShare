const cloudinary = require('../config/cloudinary');

const FOLDER = 'photoshare';

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

module.exports = { uploadImage, deleteImage };
