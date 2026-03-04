'use strict';

/**
 * FlareSolverr client — bypasses Cloudflare Bot Management via a real Chromium session.
 *
 * Deploy FlareSolverr on Koyeb (free tier):
 *   Docker image: ghcr.io/flaresolverr/flaresolverr:latest
 *   Port: 8191
 *   Then set FLARESOLVERR_URL=https://your-app.koyeb.app on Vercel
 *
 * API:
 *   POST /v1  { cmd: "request.get", url, maxTimeout }
 *   → { status:"ok", solution:{ status, response, cookies, userAgent } }
 */

const axios = require('axios');
const { createLogger } = require('./logger');

const log = createLogger('flaresolverr');

const MAX_TIMEOUT = Number(process.env.FLARESOLVERR_MAX_TIMEOUT) || 55_000;

/**
 * Check whether a FlareSolverr URL is configured.
 * @returns {string|null}
 */
function getFlareSolverrUrl() {
  return (process.env.FLARESOLVERR_URL || '').trim() || null;
}

/**
 * Make a GET request through FlareSolverr.
 * Returns the response body string, or null on failure.
 *
 * @param {string} url   — URL to fetch
 * @param {number} [timeout]
 * @returns {Promise<string|null>}
 */
async function flareSolverrGet(url, timeout = MAX_TIMEOUT) {
  const baseUrl = getFlareSolverrUrl();
  if (!baseUrl) {
    log.debug('FlareSolverr not configured (FLARESOLVERR_URL not set)');
    return null;
  }

  const endpoint = baseUrl.replace(/\/$/, '') + '/v1';
  log.info(`FlareSolverr GET ${url.slice(0, 100)}`);

  try {
    const { data } = await axios.post(endpoint, {
      cmd: 'request.get',
      url,
      maxTimeout: timeout,
    }, {
      timeout: timeout + 5_000,
      headers: { 'Content-Type': 'application/json' },
    });

    if (data?.status !== 'ok') {
      log.warn(`FlareSolverr status not ok: ${data?.status} — ${data?.message}`);
      return null;
    }

    const httpStatus = data?.solution?.status;
    const body       = data?.solution?.response || '';
    log.info(`FlareSolverr solved (http=${httpStatus}, bodyLen=${body.length})`);

    if (httpStatus && httpStatus >= 400) {
      log.warn(`FlareSolverr: HTTP ${httpStatus} for ${url}`);
      return null;
    }

    return body;
  } catch (err) {
    log.error(`FlareSolverr request failed: ${err.message}`);
    return null;
  }
}

/**
 * Convenience helper: fetch URL, parse as JSON.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
async function flareSolverrGetJSON(url) {
  const body = await flareSolverrGet(url);
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    // Body might be CF challenge HTML even after FlareSolverr
    if (body.includes('<html') || body.includes('Just a moment')) {
      log.warn('FlareSolverr returned HTML (CF challenge still active)');
      return null;
    }
    log.warn('FlareSolverr body is not valid JSON');
    return null;
  }
}

module.exports = { getFlareSolverrUrl, flareSolverrGet, flareSolverrGetJSON };
