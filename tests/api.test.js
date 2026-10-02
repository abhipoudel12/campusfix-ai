import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('connected list uses the cursor, validates pages, and never submits', async () => {
  const calls = [];
  const api = createApi('https://api.example', async (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    return response(200, { reports: [{ id: 'r1' }], nextCursor: null });
  });
  assert.deepEqual(await api.listReports('next/page+1'), { reports: [{ id: 'r1' }], nextCursor: null });
  assert.deepEqual(calls, [{ url: 'https://api.example/reports?cursor=next%2Fpage%2B1', method: 'GET' }]);
  const invalid = createApi('https://api.example', async () => response(200, { reports: {}, nextCursor: null }));
  await assert.rejects(invalid.listReports(), /invalid report page/);
});

test('connected submission sends one request and explains server failure', async () => {
  const calls = [];
  const file = { type: 'image/png', arrayBuffer: async () => Uint8Array.of(1, 2, 3).buffer };
  const api = createApi('https://api.example', async (url, options) => {
    calls.push({ url, options });
    return response(502, { error: 'Analysis could not be completed' });
  });
  await assert.rejects(api.submitReport(file, 'North walk', ''), /No report was saved/);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    imageBase64: 'AQID', mimeType: 'image/png', location: 'North walk', notes: ''
  });
});

test('connection loss leaves submission outcome unknown and makes no retry', async () => {
  let calls = 0;
  const api = createApi('https://api.example', async () => { calls++; throw new Error('network failure'); });
  const file = { type: 'image/png', arrayBuffer: async () => Uint8Array.of(1).buffer };
  await assert.rejects(api.submitReport(file, 'Library', ''), /outcome is unknown/);
  assert.equal(calls, 1);
  await assert.rejects(api.listReports(), /Could not connect/);
});
