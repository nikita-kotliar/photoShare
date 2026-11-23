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
          colors: cloud.colors,
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
  colors: [
    ['#2B59BA', 41.2],
    ['#F2F6FF', 30.5],
    ['#2B59BA', 12],
    ['#E53935', 2.1],
  ],
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
