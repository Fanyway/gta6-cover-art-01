// Draws GTA 6-style multi-panel cover art onto a canvas 2D context.
// Own design: white-guttered panels, a Vice City sunset/neon grade, and a
// big bold title block. No Rockstar artwork, logo or font is used anywhere.

export const LAYOUTS = {
  // Hero panel on the left, two stacked panels on the right.
  trio: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ],
  // Three equal vertical columns.
  triptych: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  // One full-bleed panel.
  solo: [{ x: 0, y: 0, w: 1, h: 1 }],
};

export const GRADES = {
  sunset: {
    wash: ['rgba(255, 154, 61, 0.16)', 'rgba(255, 46, 136, 0.20)', 'rgba(123, 47, 247, 0.22)'],
    glow: '#ff2e88',
    scrim: 'rgba(24, 4, 40, 0.62)',
  },
  neon: {
    wash: ['rgba(34, 211, 238, 0.14)', 'rgba(123, 47, 247, 0.22)', 'rgba(255, 46, 136, 0.20)'],
    glow: '#22d3ee',
    scrim: 'rgba(8, 4, 36, 0.62)',
  },
  night: {
    wash: ['rgba(123, 47, 247, 0.18)', 'rgba(30, 10, 60, 0.24)', 'rgba(255, 46, 136, 0.16)'],
    glow: '#ff7ad9',
    scrim: 'rgba(10, 2, 28, 0.66)',
  },
};

/** Panel rects in pixels for a layout at a given cover size. */
export function panelRects(layout, width, height, gutter) {
  const defs = LAYOUTS[layout] ?? LAYOUTS.trio;
  return defs.map((d) => {
    // Outer edges keep a full gutter as a frame; shared edges split it,
    // so every gap between panels is exactly one gutter wide.
    const left = d.x * width + (d.x === 0 ? gutter : gutter / 2);
    const top = d.y * height + (d.y === 0 ? gutter : gutter / 2);
    const right = (d.x + d.w) * width - (d.x + d.w >= 1 ? gutter : gutter / 2);
    const bottom = (d.y + d.h) * height - (d.y + d.h >= 1 ? gutter : gutter / 2);
    return { x: left, y: top, w: right - left, h: bottom - top };
  });
}

/**
 * Draws one photo into a panel rect, cover-fitting it with the panel's
 * zoom and pan offsets. Offsets are fractions of the panel size, clamped
 * so the photo always covers the panel.
 */
export function drawPanelPhoto(ctx, img, rect, panel) {
  if (!img) return;
  const zoom = panel.zoom ?? 1;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const maxOx = Math.max(0, (pw - rect.w) / 2);
  const maxOy = Math.max(0, (ph - rect.h) / 2);
  const ox = Math.max(-maxOx, Math.min(maxOx, (panel.ox ?? 0) * rect.w));
  const oy = Math.max(-maxOy, Math.min(maxOy, (panel.oy ?? 0) * rect.h));
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + ox, rect.y + (rect.h - ph) / 2 + oy, pw, ph);
}

function fitTitleSize(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  }
  return size;
}

/**
 * Draws the whole cover.
 * state: { layout, grade, title, subtitle, panels: [{ img, zoom, ox, oy }] }
 * opts: { forExport } — when false, the selected panel gets a highlight
 * outline on the preview (never part of the exported art).
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const gutter = Math.max(4, Math.round(Math.min(W, H) * 0.012));

  // Warm off-white gutters, like a printed poster.
  ctx.fillStyle = '#f7f2e9';
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(state.layout, W, H, gutter);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.img) {
      drawPanelPhoto(ctx, panel.img, rect, panel);
    } else {
      ctx.fillStyle = '#241a33';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    // Sunset / neon wash over the photo.
    const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    wash.addColorStop(0, grade.wash[0]);
    wash.addColorStop(0.55, grade.wash[1]);
    wash.addColorStop(1, grade.wash[2]);
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    // Crisp white inner edge, then the selection outline on previews.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, Math.round(gutter / 4));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (!opts.forExport && i === state.selectedPanel) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(2, Math.round(gutter / 2));
      ctx.strokeRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
    }
  });

  // Vignette, so the edges fall away like a poster print.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(15, 2, 25, 0)');
  vig.addColorStop(1, 'rgba(15, 2, 25, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Bottom scrim, then the title block, left-aligned.
  const scrim = ctx.createLinearGradient(0, H * 0.68, 0, H);
  scrim.addColorStop(0, 'rgba(10, 2, 24, 0)');
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  const padX = W * 0.045;
  if (title) {
    const size = fitTitleSize(ctx, title, W * 0.91, H * 0.115);
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16, 4, 28, 0.92)';
    ctx.lineWidth = size * 0.14;
    ctx.shadowColor = grade.glow;
    ctx.shadowBlur = size * 0.28;
    const y = H * 0.925;
    ctx.strokeText(title, padX, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, padX, y);
    ctx.shadowBlur = 0;
  }
  if (subtitle) {
    const subSize = Math.max(10, Math.round(H * 0.026));
    ctx.font = `700 ${subSize}px "Helvetica Neue", Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`;
    } catch {
      // letterSpacing is Chrome-only; harmless elsewhere.
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(subtitle, padX, H * 0.975);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // Reset for the next draw.
    }
  }
}
