const app = require('express')();
const static = require('express').static;
const Server = require('http').Server;

const http = new Server(app);
const io = require('socket.io')(http);
const makeCrud = require('express-json-file-crud').makeCrud;

const port = process.env.PORT || 3000;

const features = makeCrud('features', './storage');
app.use('/features', function(request, response) {
  features(request, response);
  if (request.method === 'PUT') {
    io.emit('change:features', request.url.substr(1));
  }
});

app.use(static('client'));

http.listen(port, function () {
  console.log('listening on *:' + port);
});
