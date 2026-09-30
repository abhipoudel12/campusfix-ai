import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, createDemoReport, scenarios, selectReports, updateReportStatus } from '../src/demo.js';

test('scores use documented severity and hazard rules', () => {
  assert.equal(calculateScore(scenarios.lighting), 85);
  assert.equal(calculateScore(scenarios.trash), 30);
  assert.equal(calculateScore(scenarios.leak), 65);
});

test('sample report uses scenario facts and supplied location without changing source data', () => {
  const report = createDemoReport({ scenarioKey: 'sidewalk', location: '  North quad  ', notes: 'By the stairs', id: 'r1', createdAt: '2026-09-30T00:00:00.000Z' });
  assert.equal(report.location, 'North quad');
  assert.equal(report.title, scenarios.sidewalk.title);
  assert.equal(report.score, 85);
  assert.equal(report.status, 'Open');
  assert.equal(report.notes, 'By the stairs');
  assert.throws(() => createDemoReport({ scenarioKey: 'lighting', location: ' ' }));
});

test('status updates and score sorting/filtering operate on in-memory reports', () => {
  const low = createDemoReport({ scenarioKey: 'trash', location: 'Hall', id: 'low' });
  const high = createDemoReport({ scenarioKey: 'lighting', location: 'Quad', id: 'high' });
  const original = [low, high];
  const changed = updateReportStatus(original, 'high', 'Resolved');
  assert.equal(original[1].status, 'Open');
  assert.deepEqual(selectReports(changed).map((item) => item.id), ['high', 'low']);
  assert.deepEqual(selectReports(changed, { sort: 'lowest' }).map((item) => item.id), ['low', 'high']);
  assert.deepEqual(selectReports(changed, { status: 'Resolved' }).map((item) => item.id), ['high']);
  assert.throws(() => updateReportStatus(changed, 'low', 'Unknown'));
});
