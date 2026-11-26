import http from "node:http";
const routes = [["/auth/v1", 9999], ["/rest/v1", 3300], ["/storage/v1", 5000]];
http.createServer((req, res) => {
  const hit = routes.find(([p]) => req.url.startsWith(p + "/") || req.url === p || req.url.startsWith(p + "?"));
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-allow-credentials": "true" });
    return res.end();
  }
  if (!hit) { res.writeHead(404); return res.end("no route"); }
  const path = req.url.slice(hit[0].length) || "/";
  const up = http.request({ host: "127.0.0.1", port: hit[1], path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${hit[1]}` } }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-credentials": "true", "access-control-expose-headers": "*" });
    r.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, "127.0.0.1");
