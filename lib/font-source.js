// What a custom-font box entry means. Pure, so it can be tested without a DOM.
//   googlefont://Bangers              -> google
//   cssfont://https://host/fonts.css  -> css (family discovered after loading)
//   https://host/MyFont.woff2         -> file
//   Bangers                           -> google
export function parseFontSource(raw) {
  const s = (raw || '').trim();
  if (!s) return null;

  const g = s.match(/^googlefont:\/\/(.+)$/i);
  const c = s.match(/^cssfont:\/\/(.+)$/i);
  if (g || (!c && !/^https?:\/\//i.test(s))) {
    const name = (g ? g[1] : s).trim();
    return name
      ? { mode: 'google', name, url: 'https://fonts.googleapis.com/css2?family=' + name.replace(/\s+/g, '+') + '&display=swap' }
      : null;
  }

  const url = (c ? c[1] : s).trim();
  let u;
  try {
    u = new URL(url);
  } catch {
    return { mode: 'invalid' };
  }
  // cssfont:// forces the stylesheet path even if the URL looks like a file
  if (!c && /\.(ttf|otf|woff2?)($|\?)/i.test(u.pathname + u.search)) {
    const name = decodeURIComponent(u.pathname.split('/').pop()).replace(/\.[^.]+$/, '') || 'Custom';
    return { mode: 'file', name, url };
  }
  const fam = u.searchParams.get('family');
  return { mode: 'css', name: fam ? fam.split(':')[0].replace(/\+/g, ' ') : null, url };
}
