#!/usr/bin/env node
/**
 * Mock Global Relay Server
 * ========================
 * Simulates the Global Relay OAuth 2.0 + Archival API endpoints locally.
 * Run this before starting the Tauri app to test without a real GR account.
 *
 * Usage:
 *   node tools/mock-gr-server/server.js [--port 8080] [--verbose] [--fail-rate 0.1]
 *
 * Endpoints emulated:
 *   POST /oauth/token            → OAuth2 client_credentials token
 *   POST /conversations          → Archive a Discord message
 *   GET  /health                 → Health check
 *   GET  /admin/requests         → View all recorded requests (audit)
 *   DELETE /admin/requests       → Clear request log
 *   POST /admin/scenario         → Set failure scenario for testing
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const PORT = parseInt(args[args.indexOf('--port') + 1] || '8080', 10);
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const FAIL_RATE = parseFloat(args[args.indexOf('--fail-rate') + 1] || '0');

// ─── State ───────────────────────────────────────────────────────────────────
const requestLog = [];       // All incoming requests
const archivedMessages = []; // Successfully archived messages
let scenario = 'normal';     // 'normal' | '429' | '500' | 'slow' | 'auth_fail'
let requestCount = 0;

// Valid mock tokens (any client_id/secret works in mock mode)
const MOCK_TOKEN_PREFIX = 'mock_gr_token_';
const TOKEN_LIFETIME_SECONDS = 3600;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(level, ...args) {
  const ts = new Date().toISOString();
  if (level === 'debug' && !VERBOSE) return;
  console.log(`[${ts}] [${level.toUpperCase()}]`, ...args);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Mock-Server': 'DiscordToGlobalRelay-MockGR/1.0',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function sendError(res, statusCode, message, retryAfter) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Mock-Server': 'DiscordToGlobalRelay-MockGR/1.0',
  };
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify({ error: message, statusCode }));
}

function parseFormBody(body) {
  const params = {};
  for (const part of body.split('&')) {
    const [k, v] = part.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

function randomId(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex').toUpperCase();
}

function shouldFail() {
  return FAIL_RATE > 0 && Math.random() < FAIL_RATE;
}

// ─── Request Recording ───────────────────────────────────────────────────────
function recordRequest(method, path, headers, body, response) {
  const entry = {
    id: ++requestCount,
    timestamp: new Date().toISOString(),
    method,
    path,
    headers: { ...headers },
    body: body || null,
    response,
  };
  // Redact Authorization header value (keep type)
  if (entry.headers['authorization']) {
    const [type] = entry.headers['authorization'].split(' ');
    entry.headers['authorization'] = `${type} [REDACTED]`;
  }
  requestLog.push(entry);
  if (VERBOSE) {
    log('debug', `→ ${method} ${path}`, JSON.stringify(body).substring(0, 200));
  }
  return entry;
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleOAuth(req, res, rawBody) {
  log('info', 'OAuth token request received');

  if (scenario === 'auth_fail') {
    recordRequest(req.method, req.url, req.headers, null, { status: 401 });
    return sendError(res, 401, 'invalid_client: Mock auth failure scenario active');
  }

  const params = parseFormBody(rawBody);
  const { grant_type, client_id, client_secret } = params;

  // Validate grant type
  if (grant_type !== 'client_credentials') {
    recordRequest(req.method, req.url, req.headers, params, { status: 400 });
    return sendError(res, 400, `Unsupported grant_type: ${grant_type}. Expected: client_credentials`);
  }

  // In mock mode, any non-empty client_id and client_secret are accepted
  if (!client_id || !client_secret) {
    recordRequest(req.method, req.url, req.headers, params, { status: 400 });
    return sendError(res, 400, 'Missing client_id or client_secret');
  }

  log('info', `✓ Issuing mock token for client_id="${client_id}"`);

  const token = MOCK_TOKEN_PREFIX + randomId();
  const responseBody = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: TOKEN_LIFETIME_SECONDS,
    scope: 'archive:write archive:read',
    // GR-specific fields
    issued_at: Date.now(),
    client_id,
  };

  recordRequest(req.method, req.url, req.headers, { ...params, client_secret: '[REDACTED]' }, { status: 200, token_issued: true });
  sendJSON(res, 200, responseBody);
}

async function handleArchive(req, res, rawBody) {
  log('info', 'Archive request received');

  // Check Authorization header
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    recordRequest(req.method, req.url, req.headers, null, { status: 401 });
    return sendError(res, 401, 'Missing or invalid Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.slice(7);
  if (!token.startsWith(MOCK_TOKEN_PREFIX) && token !== 'test_token') {
    recordRequest(req.method, req.url, req.headers, null, { status: 401 });
    log('warn', `Rejected unknown token: ${token.substring(0, 20)}...`);
    return sendError(res, 401, 'Invalid access token. Did you obtain it from POST /oauth/token?');
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    recordRequest(req.method, req.url, req.headers, rawBody, { status: 400 });
    return sendError(res, 400, `Invalid JSON body: ${e.message}`);
  }

  // Validate required fields
  const { conversationOverview, conversationEvents } = body;
  if (!conversationOverview || !conversationEvents) {
    recordRequest(req.method, req.url, req.headers, body, { status: 400 });
    return sendError(res, 400, 'Missing required fields: conversationOverview, conversationEvents');
  }

  // Scenario-based failure injection
  if (scenario === '429' || shouldFail()) {
    log('warn', '⚠ Injecting 429 Rate Limit response');
    recordRequest(req.method, req.url, req.headers, body, { status: 429 });
    return sendError(res, 429, 'rate_limit_exceeded: Too many requests', 2);
  }

  if (scenario === '500') {
    log('warn', '⚠ Injecting 500 Server Error response');
    recordRequest(req.method, req.url, req.headers, body, { status: 500 });
    return sendError(res, 500, 'internal_error: Mock server error scenario active');
  }

  if (scenario === 'slow') {
    log('info', '⏳ Injecting slow response (3s delay)');
    await new Promise(r => setTimeout(r, 3000));
  }

  // Build successful response
  const reconciliationId = randomId('GR-RCNCL-');
  const archived = {
    reconciliationId,
    status: 'accepted',
    timestamp: new Date().toISOString(),
    messageCount: conversationEvents.length,
    conversationId: conversationOverview.conversationId,
    channelName: conversationOverview.channelName,
    guildName: conversationOverview.guildName,
    events: conversationEvents.map(e => ({
      messageId: e.messageId,
      senderName: e.senderName,
      contentPreview: (e.content || '').substring(0, 50) + ((e.content || '').length > 50 ? '...' : ''),
      archivedAt: new Date().toISOString(),
    })),
  };

  archivedMessages.push(archived);
  recordRequest(req.method, req.url, req.headers, body, { status: 200, reconciliationId });

  log('info', `✓ Archived ${conversationEvents.length} event(s) → reconciliationId=${reconciliationId}`);
  logArchivedMessage(archived);

  sendJSON(res, 200, {
    reconciliationId,
    status: 'accepted',
    timestamp: archived.timestamp,
  });
}

function logArchivedMessage(msg) {
  console.log('\n┌─────────────────────────────────────────────────────');
  console.log(`│ 📨 ARCHIVED MESSAGE`);
  console.log(`│ Reconciliation ID : ${msg.reconciliationId}`);
  console.log(`│ Guild             : ${msg.guildName}`);
  console.log(`│ Channel           : ${msg.channelName}`);
  msg.events.forEach((e, i) => {
    console.log(`│ Event #${i + 1}          :`);
    console.log(`│   Message ID      : ${e.messageId}`);
    console.log(`│   Sender          : ${e.senderName}`);
    console.log(`│   Content preview : ${e.contentPreview}`);
  });
  console.log('└─────────────────────────────────────────────────────\n');
}

function handleHealth(req, res) {
  sendJSON(res, 200, {
    status: 'ok',
    mock: true,
    scenario,
    archivedCount: archivedMessages.length,
    requestCount,
    uptime: process.uptime(),
  });
}

function handleAdminRequests(req, res) {
  if (req.method === 'DELETE') {
    requestLog.length = 0;
    return sendJSON(res, 200, { cleared: true });
  }
  sendJSON(res, 200, {
    total: requestLog.length,
    requests: requestLog,
  });
}

function handleAdminArchived(req, res) {
  sendJSON(res, 200, {
    total: archivedMessages.length,
    messages: archivedMessages,
  });
}

async function handleAdminScenario(req, res, rawBody) {
  let body;
  try { body = JSON.parse(rawBody); } catch { body = {}; }

  const validScenarios = ['normal', '429', '500', 'slow', 'auth_fail'];
  if (!validScenarios.includes(body.scenario)) {
    return sendError(res, 400, `Invalid scenario. Valid: ${validScenarios.join(', ')}`);
  }

  scenario = body.scenario;
  log('info', `⚙ Scenario changed to: ${scenario}`);
  sendJSON(res, 200, { scenario, message: `Scenario set to "${scenario}"` });
}

// ─── Main Request Handler ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  let rawBody = '';
  try {
    rawBody = await readBody(req);
  } catch (e) {
    return sendError(res, 400, `Failed to read request body: ${e.message}`);
  }

  try {
    // OAuth token endpoint
    if (method === 'POST' && (path === '/oauth/token' || path === '/oauth2/token' || path === '/token')) {
      return await handleOAuth(req, res, rawBody);
    }

    // Archive endpoint
    if (method === 'POST' && (path === '/conversations' || path === '/v1/conversations' || path === '/api/conversations')) {
      return await handleArchive(req, res, rawBody);
    }

    // Health check
    if (method === 'GET' && path === '/health') {
      return handleHealth(req, res);
    }

    // Admin: view/clear request log
    if ((method === 'GET' || method === 'DELETE') && path === '/admin/requests') {
      return handleAdminRequests(req, res);
    }

    // Admin: view archived messages
    if (method === 'GET' && path === '/admin/archived') {
      return handleAdminArchived(req, res);
    }

    // Admin: set failure scenario
    if (method === 'POST' && path === '/admin/scenario') {
      return await handleAdminScenario(req, res, rawBody);
    }

    // 404 for unknown paths
    sendError(res, 404, `Unknown endpoint: ${method} ${path}. See README for available endpoints.`);
  } catch (err) {
    log('error', `Unhandled error: ${err.message}`);
    sendError(res, 500, `Mock server internal error: ${err.message}`);
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        🧪  Mock Global Relay Server  🧪                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  OAuth URL  : http://127.0.0.1:${PORT}/oauth/token          ║`);
  console.log(`║  Archive    : http://127.0.0.1:${PORT}/conversations         ║`);
  console.log(`║  Health     : http://127.0.0.1:${PORT}/health                ║`);
  console.log(`║  Admin      : http://127.0.0.1:${PORT}/admin/requests         ║`);
  console.log(`║  Archived   : http://127.0.0.1:${PORT}/admin/archived         ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Fail rate  : ${(FAIL_RATE * 100).toFixed(0)}%                                      ║`);
  console.log(`║  Verbose    : ${VERBOSE ? 'yes' : 'no'}                                       ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  CLIENT CREDENTIALS TO USE IN THE APP:                  ║');
  console.log('║    GR Client ID     : mock-client-id                    ║');
  console.log('║    GR Client Secret : mock-client-secret                ║');
  console.log(`║    GR OAuth URL     : http://127.0.0.1:${PORT}/oauth/token    ║`);
  console.log(`║    GR API Base URL  : http://127.0.0.1:${PORT}                ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Waiting for requests... (Ctrl+C to stop)\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Try: node server.js --port 8081`);
  } else {
    console.error(`\n❌ Server error: ${err.message}`);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n\n📊 Session Summary:`);
  console.log(`   Total requests  : ${requestCount}`);
  console.log(`   Archived msgs   : ${archivedMessages.length}`);
  console.log('\nMock server stopped. Goodbye!\n');
  process.exit(0);
});
