import { createDemo } from './demos.js';
import { importFile } from './importers.js';
import { disposeObject } from './geometry.js';
import './experience.css';
import {
  EXHIBIT_FILE, ExhibitValidationError, collectDirectoryFiles, packageAssetFile,
  packageManifestFile, readExhibitManifest, sampleExhibits, textFor,
} from './exhibits.js';

const languageFromBrowser = () => navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
const detailsLabel = {
  de: { title: 'Ausstellung', stories: 'Entdecken', information: 'Objektinformation', rights: 'Rechte & Herkunft', media: 'Weiteres Material', document: 'Dokument herunterladen', source: 'Digitaler Zwilling', open: 'Ausstellungs-Paket öffnen', language: 'English', demo: 'Demo-Ausstellung', local: 'Lokal auf diesem Gerät', package: 'Ausstellungs-Paket', reset: 'Zur Startansicht', missing: 'Für diesen Browser ist die Ordnerauswahl nicht verfügbar. Bitte Chrome oder Edge verwenden.' },
  en: { title: 'Exhibition', stories: 'Explore', information: 'Object information', rights: 'Rights & provenance', media: 'Further material', document: 'Download document', source: 'Digital twin', open: 'Open exhibition package', language: 'Deutsch', demo: 'Demo exhibition', local: 'Local on this device', package: 'Exhibition package', reset: 'Return to opening view', missing: 'Folder selection is not available in this browser. Please use Chrome or Edge.' },
};

function safeExternalUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

function metadataLabel(key, language) {
  const labels = {
    institution: ['Institution', 'Institution'], inventoryNumber: ['Inventarnummer', 'Inventory number'],
    creator: ['Hersteller / Künstler', 'Creator / artist'], date: ['Datierung', 'Date'],
    place: ['Fundort / Ort', 'Place'], category: ['Kategorie', 'Category'],
    originalFormat: ['Digitalisierung', 'Digitisation'], digitalTwin: ['Digitaler Zwilling', 'Digital twin'],
  };
  return labels[key]?.[language === 'de' ? 0 : 1] || key;
}

/** Adds the curatorial layer to the general-purpose 3D viewer. */
export function initializeExperienceLayer({ viewer, show, setBusy, notice, icon, setMode }) {
  const state = { manifest: null, media: [], mediaUrls: [], language: languageFromBrowser(), activeStory: -1, resetTimer: null, opening: false };
  const copy = () => detailsLabel[state.language];
  const isKiosk = new URLSearchParams(location.search).get('kiosk') === '1';
  const isDesktop = new URLSearchParams(location.search).get('desktop') === '1' || Boolean(window.browseyeDesktop);

  const opener = document.createElement('button');
  opener.id = 'exhibit-open'; opener.className = 'quiet exhibit-open';
  document.querySelector('.header-actions')?.insertBefore(opener, document.getElementById('open-button'));

  const gallery = document.createElement('section');
  gallery.className = 'exhibit-gallery';
  document.getElementById('examples')?.append(gallery);

  const panel = document.createElement('aside');
  panel.id = 'exhibit-panel'; panel.className = 'exhibit-panel'; panel.hidden = true;
  document.getElementById('stage')?.append(panel);

  function resetTimer() {
    clearTimeout(state.resetTimer);
    const seconds = state.manifest?.presentation.idleResetSeconds;
    if (!isKiosk || !seconds) return;
    state.resetTimer = setTimeout(() => {
      state.activeStory = -1; viewer.fit(); viewer.setAutoRotate(Boolean(state.manifest?.presentation.autoRotate)); renderPanel();
    }, seconds * 1000);
  }

  for (const event of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) {
    window.addEventListener(event, resetTimer, { passive: true });
  }

  function renderGallery() {
    const labels = copy();
    gallery.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'section-label'; heading.textContent = labels.title; gallery.append(heading);
    for (const manifest of sampleExhibits) {
      const button = document.createElement('button'); button.className = 'exhibit-gallery-card';
      button.dataset.exhibitId = manifest.id; button.innerHTML = `${icon('building')}<span><strong></strong><small></small></span>${icon('arrow', 'chevron')}`;
      button.querySelector('strong').textContent = textFor(manifest.title, state.language);
      button.querySelector('small').textContent = labels.demo;
      button.onclick = () => loadManifest(manifest, []);
      gallery.append(button);
    }
  }

  function definitionList(items) {
    const list = document.createElement('dl'); list.className = 'exhibit-meta';
    for (const [label, value] of items) {
      if (!value) continue;
      const term = document.createElement('dt'); term.textContent = label;
      const detail = document.createElement('dd');
      const url = label === metadataLabel('digitalTwin', state.language) ? safeExternalUrl(value) : null;
      if (url) { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = value; detail.append(link); }
      else detail.textContent = value;
      list.append(term, detail);
    }
    return list;
  }

  function releaseMedia() {
    state.mediaUrls.forEach(url => URL.revokeObjectURL(url));
    state.mediaUrls = []; state.media = [];
  }

  function stageMedia(manifest, files, packageInfo) {
    if (!manifest.media.length) return { items: [], urls: [] };
    if (!packageInfo) throw new ExhibitValidationError('Medien benötigen einen Paketordner mit einer Manifest-Datei.');
    const urls = [];
    try {
      const items = manifest.media.map(item => {
        const file = packageAssetFile(files, packageInfo.base, item.asset);
        const url = URL.createObjectURL(file); urls.push(url);
        return { ...item, fileName: file.name, url };
      });
      return { items, urls };
    } catch (error) {
      urls.forEach(url => URL.revokeObjectURL(url));
      throw error;
    }
  }

  function renderMedia(labels) {
    if (!state.media.length) return null;
    const section = document.createElement('section'); const heading = document.createElement('h3'); heading.textContent = labels.media; section.append(heading);
    const items = document.createElement('div'); items.className = 'exhibit-media';
    state.media.forEach((media, index) => {
      const caption = textFor(media.alt, state.language) || media.fileName || `${labels.media} ${index + 1}`;
      if (media.type === 'image') {
        const image = document.createElement('img'); image.src = media.url; image.alt = caption; image.loading = 'lazy'; items.append(image);
      } else if (media.type === 'audio') {
        const audio = document.createElement('audio'); audio.src = media.url; audio.controls = true; audio.preload = 'metadata'; audio.setAttribute('aria-label', caption); items.append(audio);
      } else if (media.type === 'video') {
        const video = document.createElement('video'); video.src = media.url; video.controls = true; video.preload = 'metadata'; video.playsInline = true; video.setAttribute('aria-label', caption); items.append(video);
      } else {
        const link = document.createElement('a'); link.href = media.url; link.download = media.fileName; link.textContent = `${labels.document}: ${caption}`; items.append(link);
      }
    });
    section.append(items); return section;
  }

  function clearExhibit() {
    if (!state.manifest || state.opening) return;
    state.manifest = null; state.activeStory = -1; releaseMedia();
    panel.replaceChildren(); panel.hidden = true; resetTimer();
  }

  function renderPanel() {
    const manifest = state.manifest;
    panel.replaceChildren(); panel.hidden = !manifest;
    if (!manifest) return;
    const labels = copy();
    const header = document.createElement('div'); header.className = 'exhibit-panel-header';
    const kicker = document.createElement('div'); kicker.className = 'eyebrow'; kicker.textContent = labels.package;
    const title = document.createElement('h2'); title.textContent = textFor(manifest.title, state.language);
    const summary = document.createElement('p'); summary.textContent = textFor(manifest.summary, state.language);
    const actions = document.createElement('div'); actions.className = 'exhibit-actions';
    const language = document.createElement('button'); language.className = 'quiet'; language.textContent = labels.language;
    language.onclick = () => { state.language = state.language === 'de' ? 'en' : 'de'; try { localStorage.setItem('browseye.language.v1', state.language); } catch {} renderGallery(); renderPanel(); updateHeader(); };
    const close = document.createElement('button'); close.className = 'quiet'; close.title = 'Ausstellungsinformation schließen'; close.setAttribute('aria-label', close.title); close.innerHTML = icon('close'); close.onclick = () => { panel.hidden = true; };
    actions.append(language, close); header.append(kicker, title, summary, actions); panel.append(header);

    if (manifest.story.length) {
      const section = document.createElement('section'); const heading = document.createElement('h3'); heading.textContent = labels.stories; section.append(heading);
      const stops = document.createElement('div'); stops.className = 'exhibit-stops';
      manifest.story.forEach((stop, index) => {
        const button = document.createElement('button'); button.className = `exhibit-stop ${state.activeStory === index ? 'active' : ''}`;
        const number = document.createElement('span'); number.className = 'stop-number'; number.textContent = String(index + 1).padStart(2, '0');
        const content = document.createElement('span'); const stopTitle = document.createElement('strong'); stopTitle.textContent = textFor(stop.title, state.language); content.append(stopTitle);
        const stopText = textFor(stop.text, state.language); if (stopText) { const text = document.createElement('small'); text.textContent = stopText; content.append(text); }
        button.append(number, content); button.onclick = () => {
          state.activeStory = index; viewer.setAutoRotate(false);
          if (stop.camera) viewer.focusPoint(stop.camera.target, stop.camera);
          renderPanel(); resetTimer();
        }; stops.append(button);
      }); section.append(stops); panel.append(section);
    }

    const data = Object.entries(manifest.metadata).map(([key, value]) => [metadataLabel(key, state.language), value]);
    if (data.length) { const section = document.createElement('section'); const heading = document.createElement('h3'); heading.textContent = labels.information; section.append(heading, definitionList(data)); panel.append(section); }
    const rights = [['©', manifest.rights.credit], ['Inhaber', manifest.rights.holder], ['Status', manifest.rights.status], ['Nutzung', textFor(manifest.rights.usage, state.language)]];
    const rightsSection = document.createElement('section'); const rightsHeading = document.createElement('h3'); rightsHeading.textContent = labels.rights; rightsSection.append(rightsHeading, definitionList(rights)); panel.append(rightsSection);
    const media = renderMedia(labels); if (media) panel.append(media);
    const reset = document.createElement('button'); reset.className = 'exhibit-reset'; reset.innerHTML = `${icon('reset')} ${labels.reset}`; reset.onclick = () => { state.activeStory = -1; viewer.fit(); viewer.setAutoRotate(Boolean(manifest.presentation.autoRotate)); renderPanel(); resetTimer(); }; panel.append(reset);
  }

  function updateHeader() {
    const labels = copy(); opener.innerHTML = `${icon('folder')} ${labels.open}`;
    opener.title = labels.open; document.documentElement.lang = state.language;
    const local = document.querySelector('.local-badge'); if (local) local.lastChild.textContent = ` ${labels.local}`;
  }

  async function loadManifest(manifest, files) {
    if (state.opening) return;
    state.opening = true; setBusy(true, `${textFor(manifest.title, state.language)} wird vorbereitet …`);
    let data; let applied = false; let stagedMedia = { items: [], urls: [] };
    try {
      const packageInfo = files.length ? packageManifestFile(files) : null;
      stagedMedia = stageMedia(manifest, files, packageInfo);
      if (manifest.source.kind === 'demo') data = await createDemo(manifest.source.id);
      else {
        const asset = packageAssetFile(files, packageInfo.base, manifest.source.asset);
        data = await importFile(asset, files);
      }
      await show(data, textFor(manifest.title, state.language));
      applied = true; releaseMedia();
      state.manifest = manifest; state.media = stagedMedia.items; state.mediaUrls = stagedMedia.urls; state.activeStory = -1;
      viewer.setAutoRotate(Boolean(manifest.presentation.autoRotate));
      // A packaged show should come up in its intended stereo mode only on the
      // managed Player/Kiosk. Normal web visitors stay in a normal 2D view.
      if ((isDesktop || isKiosk) && manifest.presentation.preferredStereo) setMode(manifest.presentation.preferredStereo);
      renderGallery(); renderPanel(); resetTimer();
      notice(`${textFor(manifest.title, state.language)} · ${copy().local}`);
    } catch (error) {
      stagedMedia.urls.forEach(url => URL.revokeObjectURL(url));
      if (data && !applied) disposeObject(data.object);
      notice(error.message || 'Ausstellungs-Paket konnte nicht geöffnet werden.', true);
    } finally { setBusy(false); state.opening = false; }
  }

  async function choosePackage() {
    if (!('showDirectoryPicker' in window)) { notice(copy().missing, true); return; }
    try {
      const directory = await window.showDirectoryPicker({ mode: 'read' });
      const files = await collectDirectoryFiles(directory);
      const { file } = packageManifestFile(files);
      const manifest = await readExhibitManifest(file);
      await loadManifest(manifest, files);
    } catch (error) {
      if (error?.name !== 'AbortError') notice(error.message || `${EXHIBIT_FILE} konnte nicht gelesen werden.`, true);
    }
  }

  try { state.language = localStorage.getItem('browseye.language.v1') || state.language; } catch {}
  opener.onclick = choosePackage;
  document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', clearExhibit));
  for (const id of ['file-input', 'folder-input']) document.getElementById(id)?.addEventListener('change', clearExhibit);
  updateHeader(); renderGallery();
  if (isKiosk) document.body.classList.add('experience-kiosk');
  // The bundled exhibit lets a museum see the final, curated interaction before
  // it has supplied any partner data.
  loadManifest(sampleExhibits[0], []);
}
