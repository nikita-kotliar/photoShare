const QRCode = require('qrcode');

function toDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 320 });
}

module.exports = { toDataUrl };
