/**
 * BrowsEye exhibition packages are deliberately small and portable. They carry
 * only presentation-ready derivatives plus the information a visitor and an
 * operator need; they never claim to replace a museum collection system.
 */
export const EXHIBIT_FILE = 'browseye-exhibit.json';
export const EXHIBIT_SCHEMA = 'browseye-exhibit/1';
export const SUPPORTED_STEREO = new Set(['mono', 'sbs', 'tb', 'rows']);

export class ExhibitValidationError extends Error {
  constructor(message) { super(message); this.name = 'ExhibitValidationError'; }
}

const MAX_STORY_STOPS = 64;
const MAX_MEDIA_ITEMS = 64;
const asObject = (value, field) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new ExhibitValidationError(`${field} muss ein Objekt sein.`);
  return value;
};
const optionalString = (value, field, { max = 2_000 } = {}) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new ExhibitValidationError(`${field} muss ein nicht leerer Text sein.`);
  if (value.length > max) throw new ExhibitValidationError(`${field} ist zu lang.`);
  return value.trim();
};
const array3 = (value, field) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new ExhibitValidationError(`${field} muss drei endliche Zahlen enthalten.`);
  return value.map(Number);
};

export function relativeAssetPath(value, field = 'Dateipfad') {
  const text = optionalString(value, field, { max: 400 });
  if (!text || text.includes('\0')) throw new ExhibitValidationError(`${field} ist ungültig.`);
  const path = text.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || path.split('/').includes('..')) {
    throw new ExhibitValidationError(`${field} muss innerhalb des Ausstellungs-Pakets liegen.`);
  }
  return path;
}

export function localized(value, field, { required = true, max = 8_000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ExhibitValidationError(`${field} fehlt.`);
    return undefined;
  }
  if (typeof value === 'string') return { de: optionalString(value, field, { max }) };
  const data = asObject(value, field);
  const output = {};
  for (const language of ['de', 'en']) {
    if (data[language] !== undefined) output[language] = optionalString(data[language], `${field}.${language}`, { max });
  }
  if (!Object.keys(output).length) throw new ExhibitValidationError(`${field} benötigt mindestens einen deutschen oder englischen Text.`);
  return output;
}

export function textFor(value, language = 'de') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.de || value.en || '';
}

function validateSource(value) {
  const source = asObject(value, 'source');
  const kind = optionalString(source.kind, 'source.kind', { max: 20 });
  if (kind === 'file') return { kind, asset: relativeAssetPath(source.asset, 'source.asset') };
  if (kind === 'demo') return { kind, id: optionalString(source.id, 'source.id', { max: 80 }) };
  throw new ExhibitValidationError('source.kind muss „file“ oder „demo“ sein.');
}

function validateStory(value, index) {
  const story = asObject(value, `story[${index}]`);
  const id = optionalString(story.id || `station-${index + 1}`, `story[${index}].id`, { max: 80 });
  const result = { id, title: localized(story.title, `story[${index}].title`), text: localized(story.text, `story[${index}].text`, { required: false }) };
  if (story.camera !== undefined) {
    const camera = asObject(story.camera, `story[${index}].camera`);
    result.camera = { target: array3(camera.target, `story[${index}].camera.target`) };
    if (camera.distance !== undefined) {
      if (!Number.isFinite(camera.distance) || camera.distance <= 0 || camera.distance > 100_000) throw new ExhibitValidationError(`story[${index}].camera.distance ist ungültig.`);
      result.camera.distance = Number(camera.distance);
    }
  }
  return result;
}

function validateRights(value) {
  const rights = asObject(value, 'rights');
  const status = optionalString(rights.status, 'rights.status', { max: 80 });
  const holder = optionalString(rights.holder, 'rights.holder', { max: 300 });
  const result = { status, holder };
  for (const key of ['credit', 'license', 'source']) {
    const valueForKey = optionalString(rights[key], `rights.${key}`, { max: 800 });
    if (valueForKey) result[key] = valueForKey;
  }
  const usage = localized(rights.usage, 'rights.usage', { required: false, max: 2_000 });
  if (usage) result.usage = usage;
  return result;
}

function validateMetadata(value) {
  if (value === undefined) return {};
  const metadata = asObject(value, 'metadata');
  const result = {};
  for (const [key, raw] of Object.entries(metadata)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)) throw new ExhibitValidationError(`metadata.${key} ist kein zulässiger Feldname.`);
    result[key] = optionalString(raw, `metadata.${key}`, { max: 1_500 });
  }
  return result;
}

function validatePresentation(value) {
  if (value === undefined) return {};
  const presentation = asObject(value, 'presentation');
  const result = {};
  if (presentation.preferredStereo !== undefined) {
    if (!SUPPORTED_STEREO.has(presentation.preferredStereo)) throw new ExhibitValidationError('presentation.preferredStereo ist ungültig.');
    result.preferredStereo = presentation.preferredStereo;
  }
  if (presentation.autoRotate !== undefined) {
    if (typeof presentation.autoRotate !== 'boolean') throw new ExhibitValidationError('presentation.autoRotate muss wahr oder falsch sein.');
    result.autoRotate = presentation.autoRotate;
  }
  if (presentation.idleResetSeconds !== undefined) {
    if (!Number.isInteger(presentation.idleResetSeconds) || presentation.idleResetSeconds < 15 || presentation.idleResetSeconds > 3_600) {
      throw new ExhibitValidationError('presentation.idleResetSeconds muss zwischen 15 und 3600 Sekunden liegen.');
    }
    result.idleResetSeconds = presentation.idleResetSeconds;
  }
  return result;
}

function validateMedia(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_MEDIA_ITEMS) throw new ExhibitValidationError(`media darf höchstens ${MAX_MEDIA_ITEMS} Einträge enthalten.`);
  return value.map((entry, index) => {
    const media = asObject(entry, `media[${index}]`);
    const type = optionalString(media.type, `media[${index}].type`, { max: 30 });
    if (!['image', 'audio', 'video', 'document'].includes(type)) throw new ExhibitValidationError(`media[${index}].type ist ungültig.`);
    return { type, asset: relativeAssetPath(media.asset, `media[${index}].asset`), alt: localized(media.alt, `media[${index}].alt`, { required: false, max: 1_500 }) };
  });
}

export function validateExhibit(value) {
  const manifest = asObject(value, 'Ausstellungs-Paket');
  if (manifest.schema !== EXHIBIT_SCHEMA) throw new ExhibitValidationError(`Dieses Paket benötigt schema „${EXHIBIT_SCHEMA}“.`);
  const id = optionalString(manifest.id, 'id', { max: 180 });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) throw new ExhibitValidationError('id darf nur Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten.');
  const story = manifest.story === undefined ? [] : manifest.story;
  if (!Array.isArray(story) || story.length > MAX_STORY_STOPS) throw new ExhibitValidationError(`story darf höchstens ${MAX_STORY_STOPS} Stationen enthalten.`);
  const result = {
    schema: EXHIBIT_SCHEMA,
    id,
    version: optionalString(manifest.version || '1.0.0', 'version', { max: 50 }),
    title: localized(manifest.title, 'title', { max: 300 }),
    summary: localized(manifest.summary, 'summary', { required: false, max: 2_000 }),
    source: validateSource(manifest.source),
    metadata: validateMetadata(manifest.metadata),
    rights: validateRights(manifest.rights),
    story: story.map(validateStory),
    media: validateMedia(manifest.media),
    presentation: validatePresentation(manifest.presentation),
  };
  return Object.freeze(result);
}

export async function readExhibitManifest(file) {
  let raw;
  try { raw = JSON.parse(await file.text()); }
  catch { throw new ExhibitValidationError(`${EXHIBIT_FILE} ist kein gültiges JSON-Dokument.`); }
  return validateExhibit(raw);
}

/** Recursively collect a folder selected through the browser's File System API. */
export async function collectDirectoryFiles(directory, prefix = '') {
  const files = [];
  for await (const [name, handle] of directory.entries()) {
    const relative = `${prefix}${name}`;
    if (handle.kind === 'directory') files.push(...await collectDirectoryFiles(handle, `${relative}/`));
    else {
      const file = await handle.getFile();
      // Three.js loaders can use this conventional browser folder property.
      try { Object.defineProperty(file, 'webkitRelativePath', { value: relative, configurable: true }); } catch { /* file name remains a fallback */ }
      files.push(file);
    }
  }
  return files;
}

export function indexFiles(files) {
  const index = new Map();
  for (const file of files) {
    const relative = (file.webkitRelativePath || file.name).replaceAll('\\', '/').replace(/^\.\//, '');
    if (index.has(relative)) throw new ExhibitValidationError(`Die Paketdatei „${relative}“ ist doppelt vorhanden.`);
    index.set(relative, file);
  }
  return index;
}

export function packageManifestFile(files) {
  const index = indexFiles(files);
  const matches = [...index.entries()].filter(([path]) => path === EXHIBIT_FILE || path.endsWith(`/${EXHIBIT_FILE}`));
  if (matches.length !== 1) throw new ExhibitValidationError(`Ein Ausstellungs-Paket benötigt genau eine ${EXHIBIT_FILE}.`);
  return { file: matches[0][1], base: matches[0][0].slice(0, -EXHIBIT_FILE.length) };
}

export function packageAssetFile(files, base, asset) {
  const index = indexFiles(files);
  const fullPath = `${base}${asset}`;
  const file = index.get(fullPath);
  if (!file) throw new ExhibitValidationError(`Die im Manifest referenzierte Datei „${asset}“ fehlt.`);
  return file;
}

export const sampleExhibits = Object.freeze([
  validateExhibit({
    schema: EXHIBIT_SCHEMA, id: 'vipta.demo.atrium', version: '1.0.0',
    title: { de: 'Digitaler Ausstellungsraum', en: 'Digital Exhibition Space' },
    summary: { de: 'Eine kuratierte Architekturstudie für die BrowsEye-Vorschau.', en: 'A curated architecture study for the BrowsEye preview.' },
    source: { kind: 'demo', id: 'atrium' },
    metadata: { institution: 'VIPTA GmbH', originalFormat: 'Prozedurales Demonstrationsmodell', category: 'Demonstrator' },
    rights: { status: 'demo-content', holder: 'VIPTA GmbH', credit: 'BrowsEye Preview · kein Museumsobjekt', usage: { de: 'Nur zur Demonstration der Software.', en: 'For software demonstration only.' } },
    story: [
      { id: 'overview', title: { de: 'Der Raum', en: 'The space' }, text: { de: 'Drehen und erkunden Sie das Modell frei.', en: 'Rotate and explore the model freely.' }, camera: { target: [0, 1.8, 0], distance: 10 } },
      { id: 'atrium', title: { de: 'Der Lichthof', en: 'The atrium' }, text: { de: 'Die offene Mitte verbindet die Geschosse.', en: 'The open centre connects the floors.' }, camera: { target: [0, 2.2, 0], distance: 5.5 } },
      { id: 'roof', title: { de: 'Das Dach', en: 'The roof' }, text: { de: 'Ein Blick auf die oberste Ebene.', en: 'A view of the uppermost level.' }, camera: { target: [0, 4.6, 0], distance: 6 } },
    ],
    presentation: { autoRotate: false, preferredStereo: 'rows', idleResetSeconds: 90 },
  }),
]);
