const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');
const { setupSocketServer } = require('./lib/socketServer');
const { loadData } = require('./lib/pokemonData');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, { cors: { origin: '*' } });

  setupSocketServer(io);
  loadData(); // load pokemon data on startup

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
