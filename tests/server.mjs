import http from 'node:http';
import { readFile } from 'node:fs/promises';
http.createServer(async (req, res) => {
  const path = process.env.BASELINE ? 'tests/fixtures/v0.6.html' : 'dist/index.html';
  if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(await readFile(path));
}).listen(4173, '127.0.0.1');
