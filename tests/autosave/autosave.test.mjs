import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAutosaveStore } from '../../src/autosave.js';
import { createCsv } from '../../src/csvExport.js';
import { csvToProject } from '../../src/csvImport.js';

const payloadFor = (i) => createCsv([], [i + 1, 2, 3]);

test('one backup survives reopening; queued edits leave the latest snapshot', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-autosave-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createAutosaveStore(directory);
  assert.equal(await store.read(), null);
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.save({ payload: payloadFor(i) })));
  await store.flush();
  assert.deepEqual(await fs.readdir(directory), ['autosave-location.json', 'autosave.csv']);
  const saved = await fs.readFile(path.join(directory, 'autosave.csv'), 'utf8');
  assert.equal(saved, payloadFor(19));
  assert.deepEqual(csvToProject(saved).graveDimensions, [20, 2, 3]);
  const reopened = createAutosaveStore(directory);
  assert.equal((await reopened.read()).payload, payloadFor(19));
  await reopened.save({ payload: payloadFor(20) });
  assert.equal((await store.read()).payload, payloadFor(20));
});

test('corrupt backups are reported and left intact', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-autosave-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'autosave.csv'), 'broken');
  await assert.rejects(createAutosaveStore(directory).read());
  assert.equal(await fs.readFile(path.join(directory, 'autosave.csv'), 'utf8'), 'broken');
});

test('legacy JSON backups remain recoverable until replaced by a project backup', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-autosave-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const legacy = { version: 1, payload: payloadFor(0), filePath: '/original.csv' };
  await fs.writeFile(path.join(directory, 'autosave.json'), JSON.stringify(legacy));
  const store = createAutosaveStore(directory);
  assert.deepEqual(await store.read(), legacy);
  await store.save({ payload: payloadFor(1), filePath: null });
  assert.deepEqual(await store.read(), { payload: payloadFor(1), filePath: null });
});

test('autosave follows the saved project directory and recovers its original path', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-autosave-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const userData = path.join(directory, 'app-data');
  const store = createAutosaveStore(userData);
  await store.save({ payload: payloadFor(0) });
  for (const folder of ['project', 'save-as']) {
    const filePath = path.join(directory, folder, 'reconstruction.csv');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, payloadFor(0));
    await store.save({ payload: payloadFor(1), filePath });
    assert.equal(await fs.readFile(path.join(path.dirname(filePath), 'autosave.csv'), 'utf8'), payloadFor(1));
    assert.equal(await fs.readFile(filePath, 'utf8'), payloadFor(0));
    assert.deepEqual(await createAutosaveStore(userData).read(), { payload: payloadFor(1), filePath });
  }
});

test('opening autosave.csv does not overwrite it on an edit', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-autosave-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'autosave.csv');
  await fs.writeFile(filePath, payloadFor(0));
  const store = createAutosaveStore(path.join(directory, 'app-data'));
  await store.save({ payload: payloadFor(1), filePath });
  assert.equal(await fs.readFile(filePath, 'utf8'), payloadFor(0));
  assert.equal(await fs.readFile(path.join(directory, 'autosave-backup.csv'), 'utf8'), payloadFor(1));
});

test('ossuary label edit retains RL through backup recovery and Save', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plotter-ossuary-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const original = await fs.readFile(new URL('../../docs/examples/ossuary.csv', import.meta.url), 'utf8');
  const project = csvToProject(original);
  assert.equal(project.ok, true, project.error);
  project.individuals[0].label = 'Edited label';
  const serialize = (value) => createCsv(value.individuals, value.graveDimensions, value.groups,
    value.graveOutline, { graves: value.graves, imageOverlay: value.imageOverlay, view: value.view }, value.vertical);
  const filePath = path.join(directory, 'ossuary.csv');
  await fs.writeFile(filePath, original);
  const userData = path.join(directory, 'app-data');
  await createAutosaveStore(userData).save({ payload: serialize(project), filePath });
  assert.equal(await fs.readFile(filePath, 'utf8'), original);
  const snapshot = await createAutosaveStore(userData).read();
  assert.match(snapshot.payload, /vertical_reference,,,,1\.98,,,,rl/);
  const recovered = csvToProject(snapshot.payload);
  assert.equal(recovered.ok, true, recovered.error);
  assert.deepEqual(recovered.vertical, project.vertical);
  assert.deepEqual(recovered.individuals[0].coords, project.individuals[0].coords);
  assert.equal(recovered.individuals[0].label, 'Edited label');
  await fs.writeFile(snapshot.filePath, serialize(recovered));
  const saved = csvToProject(await fs.readFile(filePath, 'utf8'));
  assert.deepEqual(saved.vertical, { convention: 'rl', floorRL: 1.98 });
  assert.deepEqual(saved.individuals[0].coords, project.individuals[0].coords);
});
