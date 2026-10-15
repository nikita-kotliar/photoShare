export function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return { fields: {}, file: null };

  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const fields = {};
  let file = null;

  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    const next = buffer.indexOf(boundary, start + boundary.length);
    if (next === -1) break;

    const part = buffer.subarray(start + boundary.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4);
      const name = /name="([^"]*)"/i.exec(headers)?.[1];
      const filename = /filename="([^"]*)"/i.exec(headers)?.[1];
      const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim();

      if (name && filename !== undefined) {
        if (content.length > 0) {
          file = {
            field: name,
            filename,
            type: type || 'application/octet-stream',
            data: content,
            size: content.length,
          };
        }
      } else if (name) {
        const value = content.toString('utf8');
        if (name in fields) {
          fields[name] = [].concat(fields[name], value);
        } else {
          fields[name] = value;
        }
      }
    }
    start = next;
  }
  return { fields, file };
}
