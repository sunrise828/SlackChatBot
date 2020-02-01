const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
// This will be our application entry. We'll setup our server here.
const http = require('http');
// Set up the express app
const app = express();
// Log requests to the console.
app.use(logger('dev'));
// Parse incoming requests data (https://github.com/expressjs/body-parser)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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
const server = http.createServer(app);
server.listen(port);

//socket init
global.io = require('socket.io').listen(server);
const slackbot = require('./modules').slackbot;
slackbot.init();
const socket = require('./modules').socket;
socket.init();

module.exports = app;