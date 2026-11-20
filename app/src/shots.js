// Fixed scenes for screenshots and headless checks:
//   ?shot=cover&photo=pier&caption=...&size=1920x1080&layout=trio&grade=sunset
//       shows the cover alone, filling the viewport.
//   ?shot=editor&photo=boulevard&caption=... shows the editor with a photo loaded.
//   ?shot=export&size=1080x1350 runs the export and reports its PNG size and
//       dimensions on <html data-export="WxH:bytes"> for verification.
// window.__shotReady is set once the scene is painted.
function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

function parsePngSize(buffer) {
  const bytes = new Uint8Array(buffer);
  // PNG signature, then the IHDR chunk: width at bytes 16-19, height at 20-23.
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(buffer);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

export async function runShot(shot, query, api) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'VICE CITY • 2026';
  const layout = query.get('layout') ?? 'trio';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? '1080x1080';

  try {
    await api.loadSamples();
    api.setTitle(caption);
    api.setSubtitle(subtitle);
    api.setLayout(layout);
    api.setGrade(grade);
    api.setSize(size);

    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      const idx = api.state.photos.findIndex((p) => p.name === `${photo}.jpg`);
      if (idx >= 0) {
        api.state.selectedPhoto = idx;
        api.state.panels[0].photo = idx;
        // Panels sharing one photo get spread crops, so no two panels
        // show the same framing (matters most in the triptych).
        api.state.panels.forEach((panel, i) => {
          if (i > 0 && panel.photo === idx) {
            // Half a panel-width of pan each way: a tall narrow panel
            // shows only a slice of a landscape photo, so a small
            // offset barely moves it — spread wide to show real variety.
            panel.ox = i === 1 ? -0.5 : 0.5;
            panel.oy = 0;
          }
        });
      }
      api.redraw();
      ready();
    } else if (shot === 'editor') {
      document.body.classList.add('shot-editor');
      const idx = api.state.photos.findIndex((p) => p.name === `${photo}.jpg`);
      if (idx >= 0) {
        api.state.selectedPhoto = idx;
        api.state.panels[0].photo = idx;
        api.state.panels[1].photo = idx;
      }
      api.redraw();
      ready();
    } else if (shot === 'export') {
      const { blob, w, h } = await api.exportCover();
      const dims = parsePngSize(await blob.arrayBuffer());
      document.documentElement.dataset.export = dims
        ? `${dims.w}x${dims.h}:${blob.size}`
        : `unknown:${blob.size}`;
      document.documentElement.dataset.exportRequested = `${w}x${h}`;
      ready();
    } else {
      api.redraw();
      ready();
    }
  } catch (err) {
    document.documentElement.dataset.error = String(err.message || err);
    window.__shotReady = true;
  }
}
