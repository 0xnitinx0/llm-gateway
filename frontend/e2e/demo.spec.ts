import { expect, Page, test } from '@playwright/test';

// All provider output and credentials below are synthetic fixtures. No cloud calls.
const config = {
  cache_similarity_threshold: 0.92, embedding_model: 'fixture-embedding', embedding_dimensions: 384,
  compression_min_tokens: 0, compression_target_ratio: 0.75, enabled_providers: ['groq', 'gemini'], tournament_providers: ['auto'], judge_provider: 'auto',
  provider_availability: [{ name: 'groq', model: 'fixture-groq', available: true, kind: 'cloud' }, { name: 'gemini', model: 'fixture-gemini', available: true, kind: 'cloud' }],
  tournament_readiness: { ready: true, candidates: ['gemini', 'groq'], judge: 'auto', reason: null, inference_verified: false },
};
const usage = { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 };
async function mockGateway(page: Page, options: { offline?: boolean; tournamentFailure?: boolean; slowStream?: boolean; unavailableTournament?: boolean } = {}) {
  const requests: Array<{ path: string; method: string; key?: string }> = [];
  const prompts = new Set<string>();
  const keys: Array<Record<string, unknown>> = [];
  let rateUsed = 0; let retryAt = 0; let chatCount = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const key = request.headers()['x-gateway-api-key'];
    requests.push({ path, method: request.method(), key });
    if (options.offline) { await route.abort('connectionrefused'); return; }
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers });
    if (path === '/ready') return json({ status: 'ready' });
    if (path === '/v1/admin/config') {
      if (request.headers()['x-admin-key'] !== 'fixture-admin') return json({ error: { message: 'Invalid admin key' } }, 401);
      return json(options.unavailableTournament ? { ...config, tournament_readiness: { ready: false, candidates: ['groq'], judge: 'auto', reason: 'Configure at least two cloud candidate providers.', inference_verified: false } } : config);
    }
    if (path === '/v1/api-keys') {
      if (request.headers()['x-admin-key'] !== 'fixture-admin') return json({ error: { message: 'Invalid admin key' } }, 401);
      if (request.method() === 'GET') return json(keys);
      const data = request.postDataJSON();
      const item = { ...data, id: 'fixture-' + keys.length, key: data.rate_limit_capacity === 3 ? 'fixture-rate' : data.name === 'Guided demo session' ? 'fixture-demo' : 'fixture-created', masked_key: 'fixture-****', created_at: '2026-01-01T00:00:00Z', status: 'active' };
      keys.push(item); return json(item);
    }
    if (path.startsWith('/v1/api-keys/') && request.method() === 'DELETE') {
      if (request.headers()['x-admin-key'] !== 'fixture-admin') return json({ error: { message: 'Invalid admin key' } }, 401);
      const item = keys.find(item => item.id === path.split('/').pop());
      if (item) item.status = 'revoked';
      return json({ status: 'revoked' });
    }
    if (path.startsWith('/v1/tools/') || path === '/v1/chat/completions' || path === '/v1/tournaments') {
      if (!key || !['fixture-demo', 'fixture-gateway', 'fixture-rate', 'fixture-created'].includes(key) || keys.some(item => item.key === key && item.status === 'revoked')) return json({ error: { message: 'Invalid or revoked gateway API key' } }, 401);
    }
    if (path === '/v1/tools/compress') {
      if (key === 'fixture-rate') {
        if (rateUsed >= 3 && Date.now() < retryAt) return json({ error: { message: 'Rate limit exceeded' } }, 429, { 'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '0', 'Retry-After': '1' });
        if (rateUsed >= 3) rateUsed = 2;
        rateUsed++; if (rateUsed === 3) retryAt = Date.now() + 1000;
      }
      const data = request.postDataJSON();
      return json({ original_messages: data.messages, compressed_messages: data.messages.map((message: { role: string; content: string }) => ({ ...message, content: message.content.replace('Could you please ', '') })), metrics: { strategy: 'fixture-compressor', original_tokens: 50, compressed_tokens: 42, tokens_saved: 8, reduction_percent: 16 } }, 200, { 'X-RateLimit-Limit': key === 'fixture-rate' ? '3' : '120', 'X-RateLimit-Remaining': key === 'fixture-rate' ? String(3 - rateUsed) : '119' });
    }
    if (path === '/v1/chat/completions') {
      chatCount++;
      const data = request.postDataJSON();
      const prompt = data.messages[0].content;
      const hit = prompts.has(prompt); prompts.add(prompt);
      const task = prompt.includes('Python') ? 'coding' : prompt.includes('tradeoffs') ? 'reasoning' : 'simple';
      const gateway = { request_id: 'fixture-request-' + chatCount, provider: 'groq', model: 'fixture-groq', cache_hit: hit, similarity: hit ? 1 : prompt.includes('similar questions') ? 0.71 : 0, llm_called: !hit, latency_ms: hit ? 12 : 240, compression: null, routing: { status: hit ? 'skipped' : 'routed', classification: hit ? null : { task_type: task, complexity: 'low', estimated_input_tokens: 20, context_size: 20, latency_sensitive: true }, provider_preference_order: hit ? [] : ['groq', 'gemini'] } };
      if (data.stream) {
        if (options.slowStream) await new Promise(resolve => setTimeout(resolve, 2000));
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Fixture streamed answer.' } }] }) + '\n\n' + 'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], gateway, usage }) + '\n\ndata: [DONE]\n\n' });
      }
      return json({ choices: [{ message: { content: 'Fixture cached answer.' } }], usage, gateway });
    }
    if (path === '/v1/tournaments') {
      if (options.tournamentFailure) return json({ error: { message: 'Tournament requires two successful cloud candidates; gemini: HTTP 503, groq: HTTP 429' } }, 502);
      return json({ winner_id: 'candidate-1', winning_response: 'Fixture winning answer.', candidates: [{ candidate_id: 'candidate-1', provider: 'groq', model: 'fixture-groq', response: 'Fixture winning answer.', latency_ms: 200, usage }, { candidate_id: 'candidate-2', provider: 'gemini', model: 'fixture-gemini', response: 'Fixture alternative answer.', latency_ms: 220, usage }, { candidate_id: 'candidate-3', provider: 'cerebras', model: 'fixture-cerebras', response: null, latency_ms: 20, error: 'HTTP 503' }], judge: { provider: 'gemini', model: 'fixture-judge', scores: { 'candidate-1': 0.9, 'candidate-2': 0.7 }, reasoning: 'Fixture judgment: the first candidate covers similarity and the miss path.', fallback_used: false }, usage, compression: { strategy: 'fixture', original_tokens: 20, compressed_tokens: 20, tokens_saved: 0, reduction_percent: 0 }, latency_ms: 280 });
    }
    if (path === '/usage') {
      if (request.headers()['x-admin-key'] !== 'fixture-admin') return json({ error: { message: 'Invalid admin key' } }, 401);
      return json({ total_requests: chatCount, cache_hits: 0, cache_misses: chatCount, cache_hit_rate: 0, active_cache_entries: prompts.size, llm_calls: chatCount, llm_calls_avoided: 0, rate_limited_requests: 0, avg_latency_ms: chatCount ? 200 : null, total_input_tokens: 20 * chatCount, total_output_tokens: 30 * chatCount, total_tokens: 50 * chatCount, compressed_tokens_saved: 0, costs: { currency: 'USD', baseline_spend_usd: 0.0001, actual_spend_usd: 0.0002, net_savings_usd: -0.0001, cache_savings_usd: 0, compression_savings_usd: 0, tournament_overhead_usd: 0.0001, priced_requests: chatCount, unpriced_requests: 0, configured_models: 2 }, compression: { original_tokens: 20, compressed_tokens: 20, tokens_saved: 0, reduction_percent: 0 }, tournaments: { count: 0, average_candidates: 0, average_winning_score: 0, judge_fallback_rate: 0 }, history: [], recent_activity: [], similarity_distribution: [] });
    }
    return json({ error: { message: 'Unexpected fixture endpoint' } }, 404);
  });
  return requests;
}
async function prepare(page: Page) {
  await page.goto('/demo');
  await page.getByLabel('Admin key', { exact: true }).fill('fixture-admin');
  await page.getByRole('button', { name: 'Save credentials', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Prepare live session', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Prepare live session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Live session prepared' })).toBeVisible();
}
async function step(page: Page, title: string) {
  await page.getByRole('navigation', { name: 'Demo steps' }).getByRole('button', { name: title }).click();
}

test('full live walkthrough, honest cache miss, failed candidate, 429 recovery and retained results', async ({ page }) => {
  const requests = await mockGateway(page);
  await prepare(page);
  expect(requests.filter(item => item.path === '/v1/chat/completions')).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('gateway_api_key'))).toBe(null);
  expect(await page.evaluate(() => sessionStorage.getItem('demo-rate-key'))).toBe('fixture-rate');
  await step(page, 'Compression');
  await page.getByRole('button', { name: 'Preview compression' }).click();
  await expect(page.getByText('fixture-compressor', { exact: true }).first()).toBeVisible();
  await expect(page.locator('mark').first()).toBeVisible();
  await step(page, 'Semantic cache');
  await page.getByRole('button', { name: 'Send initial request' }).click();
  await expect(page.getByRole('cell', { name: 'MISS', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Repeat exact request' }).click();
  await expect(page.getByRole('cell', { name: 'HIT', exact: true })).toBeVisible();
  await page.getByText('Optional paraphrase', { exact: true }).click();
  await page.getByRole('button', { name: 'Try paraphrase' }).click();
  await expect(page.getByRole('cell', { name: '0.7100', exact: true })).toBeVisible();
  await step(page, 'Routing & streaming');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await page.getByRole('button', { name: 'Start stream' }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('Fixture streamed answer.', { exact: true })).toBeVisible();
  await expect(page.getByText('coding · low complexity', { exact: false })).toBeVisible();
  await step(page, 'Tournament');
  await page.getByRole('button', { name: 'Run tournament' }).click();
  await expect(page.getByText('Winner · candidate-1')).toBeVisible();
  await expect(page.getByText('Failed: HTTP 503')).toBeVisible();
  await expect(page.getByText('Fixture judgment:', { exact: false })).toBeVisible();
  await step(page, 'Rate limit & recap');
  await page.getByRole('button', { name: 'Send four previews' }).click();
  await expect(page.getByRole('cell', { name: '429' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry one request' })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry one request' }).click();
  await expect(page.getByRole('row').last().getByRole('cell', { name: '200', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Usage & savings', exact: true }).click();
  await expect(page.getByText('Net saved (extra spending)')).toBeVisible();
  await page.getByRole('link', { name: 'Guided demo', exact: true }).click();
  await expect(page.getByText('1 observed 429s', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 observed 429s', { exact: true })).toBeVisible();
  const actions = requests.filter(item => item.path === '/v1/chat/completions').length;
  await page.getByRole('button', { name: 'Restart walkthrough' }).click();
  await expect(page.getByRole('heading', { name: 'Prepare', exact: true })).toBeVisible();
  expect(requests.some(item => item.path === '/v1/admin/reset-demo')).toBe(false);
  expect(requests.filter(item => item.path === '/v1/chat/completions')).toHaveLength(actions);
});

test('offline workspace remains informative and sample actions are isolated', async ({ page }) => {
  const requests = await mockGateway(page, { offline: true });
  await page.goto('/dashboard');
  await expect(page.getByText('The gateway request path')).toBeVisible();
  await expect(page.getByText('The backend is offline.', { exact: false })).toBeVisible();
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(4);
  await page.getByRole('link', { name: 'Start demo', exact: true }).click();
  await page.getByRole('button', { name: 'Use sample walkthrough' }).click();
  await expect(page.getByText('Sample session ready')).toBeVisible();
  await step(page, 'Compression'); await page.getByRole('button', { name: 'Preview compression' }).click();
  await expect(page.getByText('Sample result complete')).toBeVisible();
  await step(page, 'Semantic cache'); await page.getByRole('button', { name: 'Send initial request' }).click();
  await page.getByRole('button', { name: 'Repeat exact request' }).click();
  await expect(page.getByRole('cell', { name: 'HIT', exact: true })).toBeVisible();
  await step(page, 'Routing & streaming'); await page.getByRole('button', { name: 'Start stream' }).click();
  await expect(page.getByText('sample-provider / illustrative-model', { exact: false }).first()).toBeVisible();
  await step(page, 'Tournament'); await page.getByRole('button', { name: 'Run tournament' }).click();
  await expect(page.getByText('Failed: Illustrative provider failure')).toBeVisible();
  await step(page, 'Rate limit & recap'); await page.getByRole('button', { name: 'Send four previews' }).click();
  await expect(page.getByRole('cell', { name: '429' })).toBeVisible();
  expect(requests.filter(item => item.path.startsWith('/v1/tools') || item.path === '/v1/chat/completions' || item.path === '/v1/tournaments' || item.path === '/v1/api-keys')).toHaveLength(0);
  await page.getByRole('button', { name: 'Use live results' }).click();
  await step(page, 'Compression');
  await expect(page.getByRole('button', { name: 'Preview compression' })).toBeDisabled();
  await expect(page.getByText('Compressed prompt', { exact: true })).toHaveCount(0);
});

test('missing and invalid credentials, credential replacement and unavailable tournament', async ({ page }) => {
  await mockGateway(page, { unavailableTournament: true });
  await page.goto('/demo');
  await step(page, 'Routing & streaming');
  await expect(page.getByRole('button', { name: 'Start stream' })).toBeDisabled();
  await step(page, 'Prepare');
  await page.getByLabel('Admin key', { exact: true }).fill('fixture-invalid');
  await page.getByRole('button', { name: 'Save credentials' }).click();
  await expect(page.getByText('Authentication required')).toBeVisible();
  await page.getByLabel('Admin key', { exact: true }).fill('fixture-admin');
  await page.getByLabel('Gateway key', { exact: true }).fill('fixture-gateway');
  await page.getByRole('button', { name: 'Save credentials' }).click();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verify gateway key' }).click();
  await expect(page.getByText('verified by compression preview', { exact: false })).toBeVisible();
  await step(page, 'Tournament');
  await expect(page.getByRole('button', { name: 'Run tournament' })).toBeDisabled();
  await expect(page.getByText('Configure at least two cloud candidate providers.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Gateway key', { exact: true }).fill('fixture-revoked');
  await page.getByRole('button', { name: 'Save credentials' }).click();
  await page.getByRole('link', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'Compression', exact: true }).click();
  await page.getByRole('button', { name: 'Preview compression' }).click();
  await expect(page.getByText('Authentication failed', { exact: true })).toBeVisible();
});

test('stream can be stopped and tournament failures remain visible', async ({ page }) => {
  await mockGateway(page, { slowStream: true, tournamentFailure: true });
  await prepare(page);
  await step(page, 'Routing & streaming');
  await page.getByRole('button', { name: 'Start stream' }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Stopped · partial output is not a completed result')).toBeVisible();
  await expect(page.getByText('Fixture streamed answer.', { exact: true })).toHaveCount(0);
  await step(page, 'Tournament');
  await page.getByRole('button', { name: 'Run tournament' }).click();
  await expect(page.getByRole('alert')).toContainText('gemini: HTTP 503, groq: HTTP 429');
  await expect(page.getByText('Winner · candidate-1')).toHaveCount(0);
});

test('visible monitoring refreshes periodically and after credentials change', async ({ page }) => {
  const requests = await mockGateway(page);
  await prepare(page);
  await page.evaluate(() => {
    document.documentElement.dataset.refreshCount = '0';
    window.addEventListener('gateway-telemetry', () => { document.documentElement.dataset.refreshCount = String(Number(document.documentElement.dataset.refreshCount) + 1); });
  });
  await step(page, 'Routing & streaming');
  await page.getByRole('button', { name: 'Start stream' }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-refresh-count', '1');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible();
  const beforeRefresh = requests.filter(item => item.path === '/usage').length;
  await page.evaluate(() => window.dispatchEvent(new Event('gateway-telemetry')));
  await expect.poll(() => requests.filter(item => item.path === '/usage').length).toBeGreaterThan(beforeRefresh);
  const count = requests.filter(item => item.path === '/usage').length;
  await expect.poll(() => requests.filter(item => item.path === '/usage').length, { timeout: 20000 }).toBeGreaterThan(count);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Admin key', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save credentials' }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(4);
});

for (const width of [1920, 1440, 768, 390]) {
  test(`responsive walkthrough at ${width}px, keyboard access and reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockGateway(page, { offline: true });
    await page.goto('/dashboard');
    await expect(page.getByText('The gateway request path')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Start demo', exact: true }).click();
    await page.getByRole('button', { name: 'Use sample walkthrough' }).click();
    const compression = page.getByRole('navigation', { name: 'Demo steps' }).getByRole('button', { name: 'Compression' });
    await compression.focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Preview compression' }).click();
    await expect(page.getByText('Sample result complete')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`demo-${width}.png`), fullPage: true });
    expect(await page.locator('.result-reveal').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open sidebar' }).click();
      await expect(page.getByRole('button', { name: 'Close sidebar' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeFocused();
    }
  });
}


test('API-key controls create, select and revoke a key with accurate bucket units', async ({ page }) => {
  const requests = await mockGateway(page);
  await prepare(page);
  await page.getByRole('link', { name: 'API Keys', exact: true }).click();
  await page.getByRole('button', { name: 'Create API Key', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Key', exact: true })).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('Presenter test');
  await page.getByLabel('Capacity', { exact: true }).fill('20');
  await page.getByLabel('Refill / second', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Create Key', exact: true }).click();
  await expect(page.getByText('Key created and selected for the Playground.')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Presenter test' })).toContainText('20 capacity · 0.5 tokens/s');
  await page.getByRole('link', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'Compression', exact: true }).click();
  await page.getByRole('button', { name: 'Preview compression', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  expect(requests.filter(item => item.path === '/v1/tools/compress').at(-1)?.key).toBe('fixture-created');
  await page.getByRole('link', { name: 'API Keys', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Presenter test' }).getByRole('button', { name: 'Revoke', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Revoke', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Presenter test' })).toContainText('revoked');
  await page.getByRole('link', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'Compression', exact: true }).click();
  await page.getByRole('button', { name: 'Preview compression', exact: true }).click();
  await expect(page.getByText('Authentication failed', { exact: true })).toBeVisible();
});

test('monitoring distinguishes offline services from authentication', async ({ page }) => {
  await mockGateway(page, { offline: true });
  await page.goto('/usage');
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Admin key', { exact: true }).fill('fixture-admin');
  await page.getByRole('button', { name: 'Save credentials', exact: true }).click();
  await page.getByRole('link', { name: 'Usage & Savings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gateway offline' })).toBeVisible();
  await page.getByRole('link', { name: 'Semantic Cache', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gateway offline' })).toBeVisible();
  await page.getByRole('link', { name: 'API Keys', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gateway offline' })).toBeVisible();
});
