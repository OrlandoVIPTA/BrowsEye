import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ExhibitValidationError, EXHIBIT_SCHEMA, relativeAssetPath, textFor, validateExhibit } from '../src/exhibits.js';

const valid = () => ({
  schema: EXHIBIT_SCHEMA,
  id: 'museum.demo-001',
  title: { de: 'Ein Exponat', en: 'An exhibit' },
  source: { kind: 'file', asset: 'model/object.glb' },
  rights: { status: 'rights-reserved', holder: 'Museum Beispiel', credit: 'Museum Beispiel' },
});

test('accepts a portable exhibition package', () => {
  const exhibit = validateExhibit(valid());
  assert.equal(exhibit.id, 'museum.demo-001');
  assert.equal(exhibit.source.asset, 'model/object.glb');
  assert.equal(textFor(exhibit.title, 'en'), 'An exhibit');
});

test('normalizes a relative Windows path and blocks traversal', () => {
  assert.equal(relativeAssetPath('.\\model\\object.glb'), 'model/object.glb');
  assert.throws(() => relativeAssetPath('../confidential.glb'), ExhibitValidationError);
  assert.throws(() => relativeAssetPath('C:\\outside.glb'), ExhibitValidationError);
  assert.throws(() => relativeAssetPath(`model/unsafe\0.glb`), ExhibitValidationError);
});

test('requires provenance and a valid presentation policy', () => {
  const noRights = valid(); delete noRights.rights;
  assert.throws(() => validateExhibit(noRights), ExhibitValidationError);
  const badStereo = valid(); badStereo.presentation = { preferredStereo: 'quadbuffer' };
  assert.throws(() => validateExhibit(badStereo), ExhibitValidationError);
});

test('validates curated stations before the viewer receives them', () => {
  const exhibit = valid();
  exhibit.story = [{ id: 'detail', title: 'Detail', camera: { target: [1, 2, 3], distance: 4 } }];
  assert.equal(validateExhibit(exhibit).story[0].camera.distance, 4);
  exhibit.story[0].camera.target = [1, 2, Number.NaN];
  assert.throws(() => validateExhibit(exhibit), ExhibitValidationError);
});

test('ships a usable, rights-labelled exhibition package example', async () => {
  const source = await readFile(new URL('../examples/vipta-digital-exhibition/browseye-exhibit.json', import.meta.url), 'utf8');
  const exhibit = validateExhibit(JSON.parse(source));
  assert.equal(exhibit.source.kind, 'demo');
  assert.equal(exhibit.media[0].asset, 'media/browseye-mark.png');
});
