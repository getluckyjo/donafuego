'use strict';

/**
 * Minimal read-only Google Sheets client.
 *
 * Deliberately dependency-free: a service-account JWT signed with node's own
 * crypto is about thirty lines, where pulling in googleapis costs tens of
 * megabytes and a slower cold start for the same two HTTP calls.
 */

const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let cachedToken = null;   // survives while a warm lambda is reused

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Vercel env vars flatten newlines, so a pasted PEM arrives with literal \n.
 */
function normalisePrivateKey(key) {
  return String(key || '').replace(/\\n/g, '\n').trim();
}

async function getAccessToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claims);
  const signature = signer.sign(normalisePrivateKey(privateKey), 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header + '.' + claims + '.' + signature,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error('Google token exchange failed (' + res.status + '): ' + detail.slice(0, 300));
  }
  const json = await res.json();
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

/**
 * Fetch several ranges in one round trip. Values come back unformatted, so
 * numbers stay numbers and dates stay serials rather than arriving as "R130,464".
 */
async function batchGet(spreadsheetId, ranges, { email, privateKey }) {
  const token = await getAccessToken(email, privateKey);
  const qs = ranges.map((r) => 'ranges=' + encodeURIComponent(r)).join('&');
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId)
    + '/values:batchGet?' + qs
    + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'
    + '&majorDimension=ROWS';

  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error('Cannot read the sheet (' + res.status + '). Check SHEET_ID and that the '
        + 'sheet is shared with ' + email + '. ' + detail.slice(0, 200));
    }
    throw new Error('Sheets read failed (' + res.status + '): ' + detail.slice(0, 300));
  }
  const json = await res.json();
  return (json.valueRanges || []).map((vr) => vr.values || []);
}

module.exports = { batchGet, normalisePrivateKey };
