const http = require('http');
const { SitesService } = require('F:/server-qingqigo/dist/modules/sites/sites.service.js');
const redisStub = { get: async()=>{throw 0}, set: async()=>{throw 0}, incr: async()=>{throw 0}, expire: async()=>{throw 0} };
const configStub = { get: (key, def)=>def };
const svc = new SitesService(redisStub, configStub);
const port = Number(process.env.SMOKE_PORT || 3000);
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const u = new URL(req.url, 'http://localhost:3000');
  if (u.pathname !== '/api/sites/meta') { res.writeHead(404).end('{}'); return; }
  try {
    const data = await svc.getMeta(u.searchParams.get('url') || '', '1.1.1.1');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, message: 'ok', data }));
  } catch (e) {
    res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: e.status || 500, message: e.message, data: null }));
  }
}).listen(port, () => console.log(`smoke server on :${port}`));
