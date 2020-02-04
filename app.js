const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
// This will be our application entry. We'll setup our server here.
const http = require('http');
// const https = require('https');
const fs = require('fs');

// const privateKey = fs.readFileSync('/home/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('/home/fullchain.pem', 'utf8');
// const ca = fs.readFileSync('/home/chain.pem', 'utf8');

// const credentials = {
// 	key: privateKey,
// 	cert: certificate,
// 	ca: ca
// };
// Set up the express app
const app = express();
// Log requests to the console.
app.use(logger('dev'));
// Parse incoming requests data (https://github.com/expressjs/body-parser)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// process.env.NODE_ENV = process.env.NODE_ENV || 'development';

app.use(express.static('./public'));
// Models
var models = require('./models');
models.sequelize.sync().then(() => {
    console.log('Nice! Database looks fine.');
}).catch((err) => {
    console.log(err, 'Something went wrong with the Database Update!');
})

require('./routes')(app);


// Setup a default catch-all route that sends back a welcome message in JSON format.
app.get('*', (req, res) => res.status(200).send({
    message: 'Welcome to the beginning of nothingness.',
}));
const port = parseInt(process.env.PORT, 10) || 8000;
app.set('port', port);
// const server = https.createServer(option, app);
// const server = http.createServer(app);
const server = http.createServer(app);
// const httpsServer = https.createServer(credentials, app);

//socket init
global.bot = {};
global.io = require('socket.io').listen(server);
const socket = require('./modules').socket;
socket.init();
// httpServer.listen(80, () => {
// 	console.log('HTTP Server running on port 8000');
// });

server.listen(port, () => {
	console.log('HTTPS Server running on port 443');
});

module.exports = app;