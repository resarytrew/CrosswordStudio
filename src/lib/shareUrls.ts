/** Base URL honoring GitHub Pages-style /CrosswordStudio base path when deployed there. */
export function getAppOriginBase(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const path = window.location.pathname || '/';
  let basePath = origin;
  const marker = '/CrosswordStudio';
  if (path.includes(marker)) {
    const idx = path.indexOf(marker) + marker.length;
    basePath = origin + path.substring(0, idx);
  } else if (path.length > 1) {
    const first = path.split('/').filter(Boolean)[0];
    if (first && first.length > 0) {
      basePath = origin + '/' + first;
    }
  }
  return basePath;
}

export function playUrl(slugOrDocId: string): string {
  return `${getAppOriginBase()}/play/${slugOrDocId}`;
}

export function previewUrl(slugOrDocId: string): string {
  return `${getAppOriginBase()}/p/${slugOrDocId}`;
}

export function ogImageUrl(): string {
  return `${getAppOriginBase()}/og-crossword.svg`;
}
