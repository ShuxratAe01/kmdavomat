/* ===== Ob-havo belgilari =====
 * Hammasi SVG — hech qanday rasm yuklanmaydi, har qanday ekranda tiniq.
 * Yumshoq gradiyentlar va soyalar bilan hajmli ko'rinish beriladi.
 */

/** Bulut — barcha bulutli belgilar uchun umumiy shakl */
function cloudShape(id, { x = 0, y = 0, scale = 1, tint = 'light' } = {}) {
  const top = tint === 'light' ? '#ffffff' : '#eceaf6';
  const bottom = tint === 'light' ? '#dcd9ee' : '#c9c5e2';
  return `
    <defs>
      <linearGradient id="cl-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}" />
        <stop offset="1" stop-color="${bottom}" />
      </linearGradient>
    </defs>
    <g transform="translate(${x} ${y}) scale(${scale})" fill="url(#cl-${id})">
      <circle cx="23" cy="32" r="11" />
      <circle cx="38" cy="27" r="14" />
      <circle cx="50" cy="34" r="10" />
      <rect x="15" y="34" width="41" height="13" rx="6.5" />
    </g>`;
}

/** Quyosh — nurlari bilan */
function sunShape(id, { x = 0, y = 0, scale = 1, rays = true } = {}) {
  const rayMarks = rays
    ? Array.from({ length: 8 }, (_, i) =>
        `<rect x="-2" y="-25" width="4" height="8" rx="2" transform="rotate(${i * 45})" />`
      ).join('')
    : '';
  return `
    <defs>
      <radialGradient id="sn-${id}" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#ffe680" />
        <stop offset="0.55" stop-color="#ffc93c" />
        <stop offset="1" stop-color="#f5a623" />
      </radialGradient>
    </defs>
    <g transform="translate(${x} ${y}) scale(${scale})">
      <g fill="#ffcf4d">${rayMarks}</g>
      <circle r="13" fill="url(#sn-${id})" />
    </g>`;
}

/** Tomchi */
function drop(cx, cy, s = 1) {
  return `<path transform="translate(${cx} ${cy}) scale(${s})"
    d="M0-6C0-6 5 0 5 3A5 5 0 0 1-5 3C-5 0 0-6 0-6Z" fill="#5b9df9" />`;
}

/** Qor donasi */
function flake(cx, cy, s = 1) {
  const arms = [0, 60, 120].map(
    (a) => `<rect x="-1.6" y="-9" width="3.2" height="18" rx="1.6" transform="rotate(${a})" />`
  ).join('');
  return `<g transform="translate(${cx} ${cy}) scale(${s})" fill="#ffffff">${arms}</g>`;
}

const ICONS = {
  sun: (id) => sunShape(id, { x: 32, y: 32, scale: 1.15 }),

  moon: (id) => `
    <defs>
      <linearGradient id="mn-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe27a" />
        <stop offset="1" stop-color="#f5b91f" />
      </linearGradient>
    </defs>
    <path d="M40 12a21 21 0 1 0 12 38 24 24 0 0 1-12-38Z" fill="url(#mn-${id})" />
    <path d="M18 15l1.7 4.2 4.3 1.6-4.3 1.7L18 27l-1.7-4.5-4.3-1.7 4.3-1.6z" fill="#ffd84d" />
    <path d="M52 20l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#ffd84d" />`,

  cloud: (id) => cloudShape(id, { y: 6 }),

  'sun-cloud': (id) =>
    sunShape(id, { x: 26, y: 24, scale: 0.85 }) + cloudShape(id, { x: 6, y: 12, scale: 0.9 }),

  'moon-cloud': (id) => `
    <defs>
      <linearGradient id="mc-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe27a" />
        <stop offset="1" stop-color="#f5b91f" />
      </linearGradient>
    </defs>
    <path d="M30 10a15 15 0 1 0 9 27 17 17 0 0 1-9-27Z" fill="url(#mc-${id})" />
    ${cloudShape(id, { x: 6, y: 14, scale: 0.9 })}`,

  rain: (id) => `
    ${cloudShape(id, { y: 0 })}
    ${drop(24, 54, 1)} ${drop(35, 58, 1.15)} ${drop(46, 54, 1)}`,

  thunder: (id) => `
    ${cloudShape(id, { y: -2, tint: 'dark' })}
    ${drop(22, 54, 0.9)} ${drop(48, 54, 0.9)}
    <path d="M37 40l-9 15h7l-3 12 12-17h-7l4-10z" fill="#ffc93c" />`,

  snow: (id) => `
    ${cloudShape(id, { y: 0 })}
    ${flake(25, 55, 0.75)} ${flake(39, 58, 0.9)} ${flake(51, 54, 0.7)}`,

  sleet: (id) => `
    ${cloudShape(id, { y: 0 })}
    ${drop(24, 54, 0.95)} ${flake(38, 57, 0.8)} ${drop(50, 54, 0.95)}`,

  fog: (id) => `
    ${cloudShape(id, { y: -4 })}
    <g fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round">
      <path d="M17 50h30" /><path d="M22 58h26" />
    </g>`,
};

/** Belgining SVG kodini qaytaradi */
function weatherIconSvg(name, size = 46) {
  const draw = ICONS[name] || ICONS.cloud;
  // Gradiyent nomlari sahifada takrorlanmasin
  const id = name + '-' + Math.random().toString(36).slice(2, 7);
  return `<svg class="weather-icon" viewBox="0 0 64 64" width="${size}" height="${size}"
    aria-hidden="true">${draw(id)}</svg>`;
}
