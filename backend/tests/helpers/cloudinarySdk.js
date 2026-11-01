const actual = jest.requireActual('cloudinary');

const files = new Map();
let uploads = 0;
let failure = null;

function takeFailure() {
  const error = failure;
  failure = null;
  return error;
}

const uploader = {
  upload_stream: jest.fn((options, callback) => ({
    end(buffer) {
      setImmediate(() => {
        const error = takeFailure();
        if (error) return callback(error);
        uploads += 1;
        const publicId = `${options.folder}/p${uploads}`;
        files.set(publicId, buffer);
        return callback(null, {
          public_id: publicId,
          secure_url: `https://res.cloudinary.com/demo/image/upload/${publicId}.png`,
        });
      });
    },
  })),
  destroy: jest.fn(async (publicId) => {
    const error = takeFailure();
    if (error) throw error;
    return { result: files.delete(publicId) ? 'ok' : 'not found' };
  }),
};

const cloud = {
  files,
  failNext(error) {
    failure = error;
  },
  reset() {
    files.clear();
    uploads = 0;
    failure = null;
    uploader.upload_stream.mockClear();
    uploader.destroy.mockClear();
  },
};

module.exports = { ...actual, v2: { ...actual.v2, uploader }, cloud };
