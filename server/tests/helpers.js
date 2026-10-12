'use strict';

// Shared HTTP test utilities. Not named *.test.js, so the runner never treats
// this file as a suite. Requires the Express app once per test process.
const app = require('../src/app');

// An in-memory cookie jar mirroring the browser behaviour the app expects.
function makeJar() {
  const store = new Map();
  return {
    setFrom(response) {
      const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      for (const raw of cookies) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        if (index > 0) store.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    },
    get(name) {
      return store.get(name);
    },
    header() {
      return [...store.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    }
  };
}

async function startServer() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function stopServer(server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

// Low-level fetch wrapper: attaches the jar cookie, optional CSRF header and a
// JSON body, and always pumps the response back into the jar.
async function request(baseUrl, method, pathName, options = {}) {
  const { jar, csrf, body, headers = {} } = options;
  const finalHeaders = { ...headers };
  if (jar) finalHeaders.cookie = jar.header();
  if (csrf) finalHeaders['x-csrf-token'] = csrf;

  const init = { method, headers: finalHeaders };
  if (body !== undefined) {
    finalHeaders['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(baseUrl + pathName, init);
  if (jar) jar.setFrom(response);
  return response;
}

async function readJson(response) {
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body
  }
  return { json, text };
}

async function ensureCsrf(baseUrl, jar) {
  const response = await request(baseUrl, 'GET', '/api/csrf-token', { jar });
  const { json } = await readJson(response);
  return json && json.csrfToken ? json.csrfToken : null;
}

// Convenience wrapper: login returns a jar, csrf token and the parsed body.
async function login(baseUrl, username, password) {
  const jar = makeJar();
  const csrf = await ensureCsrf(baseUrl, jar);
  const response = await request(baseUrl, 'POST', '/api/auth/login', { jar, csrf, body: { username, password } });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  return { jar, csrf, status: response.status, json, text };
}

module.exports = { makeJar, startServer, stopServer, request, readJson, ensureCsrf, login };
