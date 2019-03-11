const http = require("http");

const hostname = "localhost";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end('{"ok":"1"}');
});

server.listen(port, hostname, () => {
  console.log(`listening at http://${hostname}:${port}/`);
});
