import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReportPage } from '../src/report-pages.js';

test('cursor pages append unseen reports; refresh keeps a newly submitted report', () => {
  const first = [{ id: 'new' }, { id: 'old' }];
  assert.deepEqual(mergeReportPage(first, [{ id: 'old' }, { id: 'older' }]).map((item) => item.id), ['new', 'old', 'older']);
  assert.deepEqual(mergeReportPage(first, [{ id: 'old' }, { id: 'latest' }], true).map((item) => item.id), ['old', 'latest', 'new']);
});
