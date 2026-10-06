import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRaster, validateOverlayAsset } from '../../src/overlayAsset.js';
import { MAX_IMAGE_BYTES } from '../../src/imageOverlay.js';
const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8u0AAAAASUVORK5CYII=', 'base64');
export const asset = {source:'test.png',dataUrl:'data:image/png;base64,'+data.toString('base64'),pixelWidth:1,pixelHeight:1};
test('bounded PNG and JPEG headers establish real dimensions before decoding', () => {
  assert.deepEqual(inspectRaster(data),{mime:'image/png',pixelWidth:1,pixelHeight:1});
  assert.deepEqual(inspectRaster(Uint8Array.from([255,216,255,192,0,8,8,0,2,0,3,0])), {mime:'image/jpeg',pixelWidth:3,pixelHeight:2});
  assert.deepEqual(validateOverlayAsset(asset),asset);
});
test('oversized, corrupt, remote, SVG and mismatched embedded images are rejected', () => {
  const huge = Buffer.from(data); huge.writeUInt32BE(9000,16);
  for (const bytes of [huge, new Uint8Array(MAX_IMAGE_BYTES+1), Uint8Array.from([255,216,255,192,0,50])]) assert.throws(() => inspectRaster(bytes));
  for (const patch of [{dataUrl:'https://example.com/a.png'},{dataUrl:'data:image/svg+xml;base64,PHN2Zz4='},{pixelWidth:100},{dataUrl:asset.dataUrl.replace('image/png','image/jpeg')},{source:'/private/image.png'},{dataUrl:'data:image/png;base64,!!!!'}]) assert.throws(()=>validateOverlayAsset({...asset,...patch}));
});
