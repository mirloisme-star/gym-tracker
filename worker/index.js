// Coach proxy on Cloudflare Workers. It holds the owner's GapGPT key as a secret, so every user
// of the app gets the daily coach without a key of their own.
//
// It only does one thing: turn a short facts summary into a coach message, with a fixed prompt.
// Limits keep a leaked URL from draining the account: allowed origins, a size cap, a per-IP
// daily limit and a global daily limit.
import { MAX_FACTS, SYSTEM, pickModel } from '../js/coach-prompt.js';

const API = 'https://api.gapgpt.app/v1';
const day = () => new Date().toISOString().slice(0, 10);

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const reply = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

// Counts a request against a daily limit; false when the limit is already reached.
async function spend(env, key, limit) {
  const used = Number(await env.LIMITS.get(key)) || 0;
  if (used >= limit) return false;
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}

async function gap(env, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.GAPGPT_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || res.statusText), { status: res.status });
  return data;
}

// The model is set with the MODEL variable, or picked from the key's models once a day.
async function model(env) {
  if (env.MODEL) return env.MODEL;
  const cached = await env.LIMITS.get('model');
  if (cached) return cached;
  const list = await gap(env, '/models');
  const picked = pickModel((list?.data || []).map((m) => m.id));
  if (picked) await env.LIMITS.put('model', picked, { expirationTtl: 60 * 60 * 24 });
  return picked;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/coach') return reply(404, { error: 'not_found' }, headers);

    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    if (!allowed.includes(origin)) return reply(403, { error: 'origin' }, headers);

    const input = await request.json().catch(() => null);
    const facts = typeof input?.facts === 'string' ? input.facts : '';
    if (!facts || facts.length > MAX_FACTS) return reply(400, { error: 'facts' }, headers);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await spend(env, `ip:${day()}:${ip}`, Number(env.PER_IP_DAILY) || 8))) return reply(429, { error: 'ip_limit' }, headers);
    if (!(await spend(env, `all:${day()}`, Number(env.GLOBAL_DAILY) || 300))) return reply(429, { error: 'daily_limit' }, headers);

    try {
      const data = await gap(env, '/chat/completions', {
        model: await model(env),
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Facts:\n${facts}\n\nWrite today's message.` },
        ],
      });
      const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
      if (!text) return reply(502, { error: 'empty' }, headers);
      return reply(200, { text: text.slice(0, 1500) }, headers);
    } catch (err) {
      // 402 means the owner's GapGPT credit ran out; pass it on so the app can say so.
      const status = err.status === 402 ? 402 : 502;
      return reply(status, { error: 'upstream', status: err.status || 0 }, headers);
    }
  },
};
