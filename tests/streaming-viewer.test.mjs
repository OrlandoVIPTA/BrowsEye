import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowseyeStreamingLoadError, streamingSceneUrl } from '../src/streaming-viewer.js';

test('accepts only HTTP(S) streaming manifest URLs', () => {
  assert.equal(streamingSceneUrl('/scenes/villa/browseye-streaming-scene.json', 'https://viewer.example/').href, 'https://viewer.example/scenes/villa/browseye-streaming-scene.json');
  assert.throws(() => streamingSceneUrl('file:///private/villa.json'), BrowseyeStreamingLoadError);
  assert.throws(() => streamingSceneUrl('javascript:alert(1)'), BrowseyeStreamingLoadError);
});
