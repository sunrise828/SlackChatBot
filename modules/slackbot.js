var SlackBot = require('slackbots');
var axios = require('axios');
const socket = require('./socket');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

exports.init = () => {
  global.bot = new SlackBot({
    token: config.slackApi.botToken
  });
  global.bot.on('start', function () {
    console.info('============= bot started ===================');
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    var params = {
      icon_emoji: ':cat:'
    };

    // define channel, where bot exist. You can adjust it there https://my.slack.com/services 
    // bot.postMessageToChannel('customer-1580526166566', 'meow!', params);
    // socket.init();
  });

  global.bot.on('message', function(data) {
    if (data.type != "message" || data.subtype == 'bot_message') {
      return;
    }

    const sendData = {
      author: 'Support Man',
      message: data.text,
      type: data.type,
      event_ts: data.event_ts,
      ts: data.ts
    }
    const channel = global.bot.channels.find(ch => (ch.id == data.channel));
    if (channel) {
      socket.emitToSocketId(channel.name, 'Message', sendData);
    }
  });
}

exports.createChannel = (name) => {
  let url = `https://slack.com/api/conversations.create?`;
  url += `token=${config.slackApi.token}&`;
  url += `name=${name}&`;
  url += `is_private=false`;
  return axios.post(url);
}

exports.joinChannel = (channelId) => {
  let url = `https://slack.com/api/conversations.join?`;
  url += `token=${config.slackApi.token}&`;
  url += `channel=${channelId}`;
  return axios.post(url);
}

exports.inviteUser = (channelId, users) => {
  let url = `https://slack.com/api/conversations.invite?`;
  url += `token=${config.slackApi.token}&`;
  url += `channel=${channelId}&`;
  url += `users=${users}`;
  return axios.post(url);
}

exports.postMessageToChannel = (channelId, message, params) => {
  let url = 'https://slack.com/api/chat.postMessage?';
  url += `token=${config.slackApi.token}&`;
  url += `channel=${channelId}&`;
  url += `text=${message}`;
  if (params) {
    const temp = Object.keys(params).map(key => (`${key}=${params[key]}`));
    url += `&` + temp.join('&');
  }
  return axios.post(url);
}
