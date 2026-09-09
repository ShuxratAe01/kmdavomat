/** Yuklangan faylning haqiqiy turini baytlardan aniqlaydi (MIME sarlavhaga ishonilmaydi). */

export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

export function sniffVideo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'video/webm', ext: '.webm' };
  }
  const head = buf.subarray(0, Math.min(64, buf.length)).toString('latin1');
  const ftypAt = head.indexOf('ftyp');
  if (ftypAt >= 4) {
    const brand = head.slice(ftypAt + 4, ftypAt + 8).replace(/\0/g, '').toLowerCase();
    if (brand.startsWith('qt')) return { mime: 'video/quicktime', ext: '.mov' };
    if (brand.startsWith('3g')) return { mime: 'video/3gpp', ext: '.3gp' };
    return { mime: 'video/mp4', ext: '.mp4' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 11) === 'AVI') {
    return { mime: 'video/x-msvideo', ext: '.avi' };
  }
  return null;
}
