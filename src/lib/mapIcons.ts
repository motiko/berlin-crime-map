import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CATEGORIES, CATEGORY_META, FAMILY_META, type Category } from '../../shared/categories.ts';
import { GLYPHS } from '../components/CategoryIcon.tsx';

/** Marker diameter in CSS px; drawn at 2× for sharp rendering on high-density screens. */
export const MARKER_SIZE = 28;
const SCALE = 2;
const GLYPH_SIZE = 16;

export const markerImageId = (category: Category, hollow: boolean) => `cat-${category}${hollow ? '-hollow' : ''}`;

/** Render a Phosphor icon to SVG markup by mounting it once in a detached node. */
function glyphSvg(category: Category, color: string): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(GLYPHS[category], { size: GLYPH_SIZE * SCALE, weight: 'bold', color })));
  const svg = host.innerHTML;
  root.unmount();
  return svg;
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * A disc in the family colour with a white ring and a white icon. The hollow variant
 * (points placed at a district centre) is white with a coloured ring and icon, so it
 * doesn't read as an exact location.
 */
async function drawMarker(category: Category, hollow: boolean): Promise<ImageData> {
  const color = FAMILY_META[CATEGORY_META[category].family].color;
  const px = MARKER_SIZE * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  const r = px / 2;

  ctx.beginPath();
  ctx.arc(r, r, r - 2 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = hollow ? 'rgba(255,255,255,0.92)' : color;
  ctx.fill();
  ctx.lineWidth = 2 * SCALE;
  ctx.strokeStyle = hollow ? color : '#ffffff';
  ctx.stroke();

  const glyph = await loadSvg(glyphSvg(category, hollow ? color : '#ffffff'));
  const g = GLYPH_SIZE * SCALE;
  ctx.drawImage(glyph, r - g / 2, r - g / 2, g, g);
  return ctx.getImageData(0, 0, px, px);
}

/** Register both marker variants for every category with the map. */
export async function addMarkerImages(map: MapLibreMap): Promise<void> {
  const jobs = CATEGORIES.flatMap((c) => [false, true].map(async (hollow) => {
    const id = markerImageId(c, hollow);
    const image = await drawMarker(c, hollow);
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: SCALE });
  }));
  await Promise.all(jobs);
}
