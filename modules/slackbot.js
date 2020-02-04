var SlackBot = require('slackbots');
var axios = require('axios');
const socket = require('./socket');

const env = process.env.NODE_ENV || 'development';
const Workspace = require('../models').Workspace;

exports.init = async (workspaceId) => {
  if (Object.keys(global.bot).indexOf(workspaceId) < 0) {
    const workspaces = await Workspace.findAll({serialId: workspaceId});
    if (workspaces.length > 0) {
      global.bot[workspaceId] = new SlackBot({
        token: workspaces[0].botAccessToken
      });
      global.bot[workspaceId].myWorkspace = workspaces[0];
      global.bot[workspaceId].on('start', function () {
        console.info('============= bot started ===================');
        // more information about additional params https://api.slack.com/methods/chat.postMessage
        var params = {
          icon_emoji: ':cat:'
        };
    
        // define channel, where bot exist. You can adjust it there https://my.slack.com/services 
        // bot.postMessageToChannel('customer-1580526166566', 'meow!', params);
        // socket.init();
      });
    
      global.bot[workspaceId].on('message', function(data) {
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
        const channel = global.bot[workspaceId].channels.find(ch => (ch.id == data.channel));
        if (channel) {
          socket.emitToSocketId(channel.name, 'Message', sendData);
        }
      });
    } else {
      return false;
    }
  }
  return true;
}

exports.createChannel = (name, token) => {
  let url = `https://slack.com/api/conversations.create?`;
  url += `token=${token}&`;
  url += `name=${name}&`;
  url += `is_private=false`;
  return axios.post(url);
}

exports.joinChannel = (channelId, token) => {
  let url = `https://slack.com/api/conversations.join?`;
  url += `token=${token}&`;
  url += `channel=${channelId}`;
  return axios.post(url);
}

exports.inviteUser = (channelId, token, users) => {
  let url = `https://slack.com/api/conversations.invite?`;
  url += `token=${token}&`;
  url += `channel=${channelId}&`;
  url += `users=${users}`;
  return axios.post(url);
}