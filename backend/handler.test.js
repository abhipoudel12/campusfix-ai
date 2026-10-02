import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisFields, categories, scoreBreakdown, severities, textLimits, validateAnalysis } from './scoring.js';

process.env.TABLE_NAME = 'local-test';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
const { createHandler } = await import('./handler.js');
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII=';
const photo = { imageBase64, mimeType: 'image/png', location: 'Library', notes: '' };
const event = (method, path, body, queryStringParameters) => ({ requestContext: { http: { method } }, rawPath: path, queryStringParameters, body: body === undefined ? undefined : JSON.stringify(body) });
const analysis = { title: 'Broken light', category: 'Lighting', severity: 'High', hazard: true, recurring: false, description: 'One fixture appears dark.', action: 'Inspect the fixture.' };
const modelResponse = (value = analysis) => ({ stopReason: 'end_turn', output: { message: { content: [{ text: JSON.stringify(value) }] } } });
const modelTextResponse = (text) => ({ stopReason: 'end_turn', output: { message: { content: [{ text }] } } });

function mockServices(response = modelResponse()) {
  const items = new Map();
  const commands = [];
  let modelCalls = 0;
  const database = { async send(command) {
    const name = command.constructor.name;
    const input = command.input;
    commands.push(name);
    if (name === 'PutCommand') {
      if (input.ConditionExpression === 'attribute_not_exists(id)' && items.has(input.Item.id)) throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
      if (input.ConditionExpression?.includes('#owner') && items.get(input.Item.id)?.owner !== input.ExpressionAttributeValues[':owner']) throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
      items.set(input.Item.id, input.Item);
      return {};
    }
    if (name === 'GetCommand') return { Item: items.get(input.Key.id) };
    if (name === 'QueryCommand') {
      const ready = [...items.values()].filter((item) => item.state === 'ready').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const start = input.ExclusiveStartKey ? ready.findIndex((item) => item.id === input.ExclusiveStartKey.id) + 1 : 0;
      const page = ready.slice(start, start + input.Limit);
      const last = start + input.Limit < ready.length ? page.at(-1) : null;
      return { Items: page, LastEvaluatedKey: last ? { id: last.id, state: last.state, createdAt: last.createdAt } : undefined };
    }
    if (name === 'UpdateCommand' && input.Key.id.startsWith('quota#')) return {};
    if (name === 'UpdateCommand') {
      const current = items.get(input.Key.id);
      if (!current) throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
      const updated = input.ExpressionAttributeValues[':status']
        ? { ...current, status: input.ExpressionAttributeValues[':status'] }
        : { ...current, owner: input.ExpressionAttributeValues[':owner'], leaseUntil: input.ExpressionAttributeValues[':lease'] };
      items.set(input.Key.id, updated);
      return { Attributes: updated };
    }
    if (name === 'DeleteCommand') { if (items.get(input.Key.id)?.owner === input.ExpressionAttributeValues[':owner']) items.delete(input.Key.id); return {}; }
    throw new Error(`Unexpected ${name}`);
  } };
  const model = { async send(command) {
    modelCalls++;
    assert.equal(command.constructor.name, 'ConverseCommand');
    assert.equal(command.input.inferenceConfig.maxTokens, 350);
    const instructions = command.input.system[0].text;
    assert.match(instructions, /exactly one complete JSON object/);
    assert.match(instructions, /exactly these seven required keys and no others/);
    for (const key of analysisFields) assert.ok(instructions.includes(`"${key}"`));
    for (const value of [...categories, ...severities]) assert.ok(instructions.includes(`"${value}"`));
    for (const limit of Object.values(textLimits)) assert.ok(instructions.includes(`at most ${limit} characters after trimming surrounding whitespace`));
    assert.match(instructions, /JSON boolean \(true or false, never a string\)/);
    assert.match(instructions, /nonempty JSON string/);
    assert.equal(command.input.outputConfig, undefined);
    return response;
  } };
  return { database, model, commands, items, get modelCalls() { return modelCalls; } };
}

test('one new photo invokes model once, scores deterministically, persists text only, and duplicate skips inference', async () => {
  const services = mockServices();
  const handler = createHandler({ ...services, now: () => new Date('2026-10-01T12:00:00Z') });
  const first = await handler(event('POST', '/reports', photo));
  assert.equal(first.statusCode, 201);
  assert.equal(JSON.parse(first.body).report.score, 85);
  const second = await handler(event('POST', '/reports', photo));
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).duplicate, true);
  assert.equal(services.modelCalls, 1);
  const listed = JSON.parse((await handler(event('GET', '/reports'))).body).reports;
  assert.equal(listed.length, 1);
  assert.equal(JSON.stringify(listed).includes(imageBase64), false);
  const rejected = await handler(event('PATCH', `/reports/${listed[0].id}/status`, { status: 'Resolved' }));
  assert.equal(rejected.statusCode, 404);
  assert.equal(services.items.get(listed[0].id).status, 'Open');
});

test('plain JSON with surrounding whitespace is accepted', async () => {
  const services = mockServices(modelTextResponse(` \n${JSON.stringify(analysis)}\n `));
  const handler = createHandler(services);
  const first = await handler(event('POST', '/reports', photo));
  assert.equal(first.statusCode, 201);
  assert.equal(JSON.parse(first.body).report.score, 85);
  assert.equal(services.modelCalls, 1);
});

test('mocked model formatting variation trims text and canonicalizes enum casing', async () => {
  const varied = { ...analysis, title: '  Broken light  ', category: '  lIgHtInG  ', severity: ' hIgH ', description: '\nOne fixture appears dark.\n', action: ' Inspect the fixture. ' };
  const services = mockServices(modelResponse(varied));
  const handler = createHandler(services);
  const first = await handler(event('POST', '/reports', photo));
  assert.equal(first.statusCode, 201);
  assert.deepEqual(Object.fromEntries(analysisFields.map((key) => [key, JSON.parse(first.body).report[key]])), analysis);
  assert.equal(JSON.parse(first.body).report.score, 85);
  assert.equal(services.modelCalls, 1);
});

test('one enclosing JSON Markdown fence is accepted without changing duplicate handling', async () => {
  for (const label of ['json', '']) {
    const services = mockServices(modelTextResponse(` \n\`\`\`${label}\n${JSON.stringify(analysis)}\n\`\`\`\n `));
    const handler = createHandler(services);
    const first = await handler(event('POST', '/reports', photo));
    assert.equal(first.statusCode, 201);
    assert.equal(JSON.parse(first.body).report.score, 85);
    const second = await handler(event('POST', '/reports', photo));
    assert.equal(second.statusCode, 200);
    assert.equal(JSON.parse(second.body).duplicate, true);
    assert.equal(services.modelCalls, 1);
  }
});

test('malformed JSON and extra commentary are rejected without logging response text', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    for (const text of [
      '{"title": PRIVATE_MODEL_RESPONSE',
      `${JSON.stringify(analysis)}\nPRIVATE_MODEL_RESPONSE`,
      `\`\`\`json\n{"title": PRIVATE_MODEL_RESPONSE}\n\`\`\``,
      `\`\`\`json\n${JSON.stringify(analysis)}\n\`\`\`\nPRIVATE_MODEL_RESPONSE`,
    ]) {
      const services = mockServices(modelTextResponse(text));
      const handler = createHandler(services);
      assert.equal((await handler(event('POST', '/reports', { ...photo, notes: 'PRIVATE_NOTES' }))).statusCode, 502);
      assert.deepEqual(JSON.parse((await handler(event('GET', '/reports'))).body).reports, []);
      assert.equal(services.modelCalls, 1);
    }
    assert.equal(JSON.stringify(logs).includes('PRIVATE_MODEL_RESPONSE'), false);
    assert.equal(JSON.stringify(logs).includes('PRIVATE_NOTES'), false);
  } finally {
    console.error = originalError;
  }
});

test('missing, extra, and invalid schema fields are rejected without a fallback report', async () => {
  for (const value of [
    Object.fromEntries(Object.entries(analysis).filter(([key]) => key !== 'action')),
    { ...analysis, extra: 'unrequested' },
    { ...analysis, severity: 'Critical' },
    { ...analysis, hazard: 'true' },
    { ...analysis, title: '' },
  ]) {
    const services = mockServices(modelResponse(value));
    const handler = createHandler(services);
    assert.equal((await handler(event('POST', '/reports', photo))).statusCode, 502);
    assert.deepEqual(JSON.parse((await handler(event('GET', '/reports'))).body).reports, []);
    assert.equal(services.modelCalls, 1);
  }
});

test('bad input and model output never persist a ready report', async () => {
  const services = mockServices(modelResponse({ ...analysis, severity: 'Critical' }));
  const handler = createHandler(services);
  assert.equal((await handler(event('POST', '/reports', { ...photo, imageBase64: 'bad' }))).statusCode, 400);
  assert.equal((await handler(event('POST', '/reports', photo))).statusCode, 502);
  assert.deepEqual(JSON.parse((await handler(event('GET', '/reports'))).body).reports, []);
  assert.equal(services.modelCalls, 1);
});

test('502 diagnostics distinguish Bedrock, model output, and report write without private data', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const access = mockServices();
    const accessError = Object.assign(new Error('PRIVATE_REQUEST_DATA'), {
      name: 'AccessDeniedException', $metadata: { httpStatusCode: 403 }
    });
    const accessHandler = createHandler({ database: access.database, model: { send: async () => { throw accessError; } } });
    assert.equal((await accessHandler(event('POST', '/reports', photo))).statusCode, 502);
    assert.deepEqual(logs.at(-1), ['Analysis failed', { phase: 'bedrock_call', name: 'AccessDeniedException', httpStatus: 403 }]);

    const untrustedHandler = createHandler({ database: mockServices().database, model: { send: async () => {
      throw Object.assign(new Error('PRIVATE_REQUEST_DATA'), { name: 'PRIVATE_REQUEST_DATA' });
    } } });
    assert.equal((await untrustedHandler(event('POST', '/reports', photo))).statusCode, 502);
    assert.deepEqual(logs.at(-1), ['Analysis failed', { phase: 'bedrock_call', name: 'UnknownError' }]);

    const invalidOutput = mockServices(modelResponse({ ...analysis, severity: 'Critical' }));
    const outputHandler = createHandler(invalidOutput);
    assert.equal((await outputHandler(event('POST', '/reports', photo))).statusCode, 502);
    assert.deepEqual(logs.at(-1), ['Analysis failed', { phase: 'model_output', name: 'Error', code: 'invalid_severity' }]);

    const persistence = mockServices();
    const database = { async send(command) {
      if (command.constructor.name === 'PutCommand' && command.input.ConditionExpression?.includes('#state')) {
        throw Object.assign(new Error('PRIVATE_REQUEST_DATA'), { name: 'ConditionalCheckFailedException' });
      }
      return persistence.database.send(command);
    } };
    const writeHandler = createHandler({ database, model: persistence.model });
    assert.equal((await writeHandler(event('POST', '/reports', photo))).statusCode, 502);
    assert.deepEqual(logs.at(-1), ['Analysis failed', { phase: 'report_write', name: 'ConditionalCheckFailedException' }]);
    assert.equal(JSON.stringify(logs).includes('PRIVATE_REQUEST_DATA'), false);
  } finally {
    console.error = originalError;
  }
});

test('model-output diagnostics identify bounded failure reasons without response text', async () => {
  const cases = [
    [{ ...modelResponse(), stopReason: 'max_tokens' }, 'max_tokens'],
    [{ ...modelResponse(), stopReason: 'content_filtered' }, 'stop_reason'],
    [{ stopReason: 'end_turn', output: { message: { content: [] } } }, 'content_shape'],
    [modelResponse(null), 'content_shape'],
    [modelTextResponse('```json\nPRIVATE_MODEL_RESPONSE'), 'fence'],
    [modelTextResponse('{"title": PRIVATE_MODEL_RESPONSE'), 'json_syntax'],
    [modelResponse(Object.fromEntries(Object.entries(analysis).filter(([key]) => key !== 'action'))), 'missing_fields'],
    [modelResponse({ ...analysis, extra: 'PRIVATE_MODEL_RESPONSE' }), 'extra_fields'],
    [modelResponse({ ...analysis, title: '' }), 'invalid_title'],
    [modelResponse({ ...analysis, category: 'PRIVATE_MODEL_RESPONSE' }), 'invalid_category'],
    [modelResponse({ ...analysis, severity: 'Critical' }), 'invalid_severity'],
    [modelResponse({ ...analysis, hazard: 'true' }), 'invalid_hazard'],
    [modelResponse({ ...analysis, recurring: 'false' }), 'invalid_recurring'],
    [modelResponse({ ...analysis, description: '' }), 'invalid_description'],
    [modelResponse({ ...analysis, action: '' }), 'invalid_action'],
  ];
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    for (const [response, code] of cases) {
      const services = mockServices(response);
      const handler = createHandler(services);
      assert.equal((await handler(event('POST', '/reports', photo))).statusCode, 502);
      assert.equal(logs.at(-1)[1].code, code);
    }
    assert.equal(JSON.stringify(logs).includes('PRIVATE_MODEL_RESPONSE'), false);
    assert.equal(JSON.stringify(logs).includes('PRIVATE_NOTES'), false);
  } finally {
    console.error = originalError;
  }
});

test('oversize image dimensions are rejected before inference', async () => {
  const services = mockServices();
  const oversized = Buffer.from(imageBase64, 'base64');
  oversized.writeUInt32BE(8001, 16);
  const handler = createHandler(services);
  const response = await handler(event('POST', '/reports', { ...photo, imageBase64: oversized.toString('base64') }));
  assert.equal(response.statusCode, 400);
  assert.equal(services.modelCalls, 0);
});

test('score and model schema reject invalid classifications', () => {
  assert.deepEqual(scoreBreakdown(analysis), { severity: 70, hazard: 15, recurring: 0, total: 85 });
  assert.throws(() => validateAnalysis({ ...analysis, extra: 'text' }));
  assert.throws(() => scoreBreakdown({ ...analysis, hazard: 'true' }));
});

test('all seven fields retain exact types, allowed values, and post-trim length limits', () => {
  for (const category of categories) assert.equal(validateAnalysis({ ...analysis, category: ` ${category.toLowerCase()} ` }).category, category);
  for (const severity of severities) assert.equal(validateAnalysis({ ...analysis, severity: ` ${severity.toUpperCase()} ` }).severity, severity);
  for (const field of ['title', 'description', 'action']) {
    const limit = textLimits[field];
    assert.equal(validateAnalysis({ ...analysis, [field]: ` ${'x'.repeat(limit)} ` })[field].length, limit);
    assert.throws(() => validateAnalysis({ ...analysis, [field]: 'x'.repeat(limit + 1) }), { code: `invalid_${field}` });
    assert.throws(() => validateAnalysis({ ...analysis, [field]: '   ' }), { code: `invalid_${field}` });
    assert.throws(() => validateAnalysis({ ...analysis, [field]: 1 }), { code: `invalid_${field}` });
  }
  for (const field of analysisFields) {
    const missing = { ...analysis };
    delete missing[field];
    assert.throws(() => validateAnalysis(missing), { code: 'missing_fields' });
  }
  assert.throws(() => validateAnalysis({ ...analysis, extra: true }), { code: 'extra_fields' });
  assert.throws(() => validateAnalysis({ ...analysis, category: 'Safety' }), { code: 'invalid_category' });
  assert.throws(() => validateAnalysis({ ...analysis, category: false }), { code: 'invalid_category' });
  assert.throws(() => validateAnalysis({ ...analysis, severity: 'Critical' }), { code: 'invalid_severity' });
  assert.throws(() => validateAnalysis({ ...analysis, severity: 3 }), { code: 'invalid_severity' });
  for (const field of ['hazard', 'recurring']) {
    assert.equal(validateAnalysis({ ...analysis, [field]: false })[field], false);
    assert.equal(validateAnalysis({ ...analysis, [field]: true })[field], true);
    assert.throws(() => validateAnalysis({ ...analysis, [field]: 'false' }), { code: `invalid_${field}` });
    assert.throws(() => validateAnalysis({ ...analysis, [field]: null }), { code: `invalid_${field}` });
  }
});

test('daily quota rejection removes processing marker before any inference', async () => {
  const services = mockServices();
  const database = { async send(command) {
    if (command.constructor.name === 'UpdateCommand' && command.input.Key.id.startsWith('quota#')) {
      throw Object.assign(new Error(), { name: 'ConditionalCheckFailedException' });
    }
    return services.database.send(command);
  } };
  const handler = createHandler({ database, model: services.model });
  const response = await handler(event('POST', '/reports', photo));
  assert.equal(response.statusCode, 429);
  assert.equal(services.modelCalls, 0);
  assert.deepEqual(JSON.parse((await handler(event('GET', '/reports'))).body).reports, []);
  assert.ok(services.commands.includes('DeleteCommand'));
});

test('expired processing lock can be reclaimed after a timeout', async () => {
  const services = mockServices();
  const id = (await import('node:crypto')).createHash('sha256').update(Buffer.from(imageBase64, 'base64')).update('\0').update('library').digest('hex');
  services.items.set(id, { id, state: 'processing', owner: 'stale', leaseUntil: 1, createdAt: '2026-09-30T00:00:00Z' });
  const handler = createHandler({ database: services.database, model: services.model, now: () => new Date('2026-10-01T12:00:00Z') });
  assert.equal((await handler(event('POST', '/reports', photo))).statusCode, 201);
  assert.equal(services.modelCalls, 1);
});

test('list endpoint returns a validated cursor for the next page', async () => {
  const services = mockServices();
  for (let i = 0; i < 51; i++) {
    const id = i.toString(16).padStart(64, '0');
    services.items.set(id, { id, state: 'ready', createdAt: `2026-10-01T00:00:${String(i).padStart(2, '0')}Z` });
  }
  const handler = createHandler({ database: services.database, model: services.model });
  const first = JSON.parse((await handler(event('GET', '/reports'))).body);
  assert.equal(first.reports.length, 50);
  assert.ok(first.nextCursor);
  const second = JSON.parse((await handler(event('GET', '/reports', undefined, { cursor: first.nextCursor }))).body);
  assert.equal(second.reports.length, 1);
  assert.equal(second.nextCursor, null);
  assert.equal((await handler(event('GET', '/reports', undefined, { cursor: 'bad' }))).statusCode, 400);
});
