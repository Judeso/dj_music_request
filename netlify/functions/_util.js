/**
 * Adapte un handler Express/Vercel (req, res) pour Netlify Functions
 */
export async function adapt(handler, event) {
  const url = event.rawUrl || ('http://localhost' + (event.path || '/') + (event.rawQuery ? '?' + event.rawQuery : ''));

  let parsedBody = null;
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
    const ct = (event.headers?.['content-type'] || '');
    parsedBody = ct.includes('application/json') ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
  }

  const req = {
    method:  event.httpMethod || 'GET',
    url:     (event.path || '/') + (event.rawQuery ? '?' + event.rawQuery : ''),
    headers: event.headers || {},
    body:    parsedBody,
    on:      () => {}
  };

  const resHeaders = {};
  let statusCode = 200;
  let resBody = '';

  const res = {
    status(code)       { statusCode = code; return res; },
    setHeader(k, v)    { resHeaders[k] = v; return res; },
    end()              { return { statusCode, headers: resHeaders, body: resBody }; },
    json(data)         { resBody = JSON.stringify(data); return { statusCode, headers: resHeaders, body: resBody }; }
  };

  const result = await handler(req, res);
  if (result && result.statusCode !== undefined) return result;
  return { statusCode, headers: resHeaders, body: resBody };
}
