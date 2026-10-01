// Proxy same-origin para la API: el navegador solo ve https://tu-dominio
// y este function reenvía a la API HTTP de Somee del lado servidor
// (entre servidores no aplica el bloqueo de mixed content).
// Respeta Cache-Control del backend, incluido no-store del sorteo.
const TARGET = process.env.SOME_API_BASE || 'http://geovistaapi.somee.com';

export default async function handler(req, res) {
  try {
    const segs = req.query.path;
    const path = Array.isArray(segs) ? segs.join('/') : segs || '';
    const url = new URL(`${TARGET}/api/${path}`);

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path' || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.append(key, value);
    }

    const headers = {};
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : JSON.stringify(req.body ?? {}),
    });

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => {
      const k = key.toLowerCase();
      if (k === 'content-type' || k === 'cache-control') res.setHeader(key, val);
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).json({ error: 'API no disponible', detail: String((err && err.message) || err) });
  }
}
