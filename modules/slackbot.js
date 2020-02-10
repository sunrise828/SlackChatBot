const { RTMClient } = require('@slack/rtm-api');
const { Op } = require("sequelize");
const { WebClient, LogLevel } = require('@slack/web-api');
const socket = require('./socket');
const _ = require('lodash');

const env = process.env.NODE_ENV || 'development';
const Workspace = require('../models').Workspace;
const User = require('../models').ChatUser;

exports.init = async (workspaceId) => {
  if (Object.keys(global.bot).indexOf(workspaceId) < 0) {
    const workspaces = await Workspace.findAll({serialId: workspaceId});
    if (workspaces.length > 0) {
      global.slackWeb[workspaceId] = new WebClient(workspaces[0].accessToken, {
        logLevel: LogLevel.DEBUG
      });
      global.slackWeb[workspaceId]['botUserId'] = workspaces[0].botUserId;
      global.bot[workspaceId] = new RTMClient(workspaces[0].botAccessToken);
      
      global.bot[workspaceId].on('start', function () {
        console.info('============= bot started ===================');
      });
    
      global.bot[workspaceId].on('message', function(data) {
        if (data.type != "message" || data.subtype == 'bot_message' || data.subtype == 'channel_join') {
          return;
        }

        console.log('message received', data);
    
        const sendData = {
          author: 'Support Man',
          message: data.text,
          type: data.type,
          event_ts: data.event_ts,
          ts: data.ts
        }
        socket.emitToSocketId(data.channel, 'Message', sendData);
      });

      global.bot[workspaceId].on('member_joined_channel', async function(event) {
        // Add the subscription
        if (event.user == workspaces[0].botUserId) {
          return;
        }
        const chatUsers = await User.findAll({
          where: {
            channelId: event.channel
          }
        });
        if (chatUsers.length) {
          for(var i = 0; i < chatUsers.length; i++) {
            let chatUser = chatUsers[i];
            let slackUsers = [];
            if (chatUser.slackId)
              slackUsers = chatUser.slackId.split(',');
            slackUsers.push(event.user);
            chatUser.slackId = slackUsers.join(',');
            await chatUser.save();
          }
        }
        try {
          await addPresenceSubscriptions(workspaceId);
        } catch (error) {
          console.log('Failed to subscribe to presence, error: ', error);
        }
      });

      global.bot[workspaceId].on('presence_change', async function(event) {
        let users = event.user? [event.user]: event.users || [];
        if (users.length > 0) {
          // const userInfo = await global.slackWeb[worksp]
          let channels = [];
          const chs = await global.slackWeb[workspaceId].users.conversations({
            user: event.user
          });
          if (chs.ok) {
            channels = channels.concat(chs.channels.filter(ch => (ch.name.indexOf('z_') === 0)).map(ch => (ch.id)));
          }

          if (channels.length > 0) {
            for(var i = 0; i < channels.length; i++) {
              const user = await User.findOne({
                where: {
                  channelId: channels[i]
                }
              });

              if (user) {
                let slackUsers = [];
                if (user.slackId) slackUsers = user.slackId.split(',');
                let newUsers = event.presence == 'away'? slackUsers.filter(id => (id != event.user)): slackUsers.concat([event.user]);
                newUsers = _.uniq(newUsers);
                user.slackId = newUsers.join(',');
                await user.save();
                if (slackUsers.length <= 0 && !global.timers[channels[i]]) {
                  global.timers[channels[i]] = setTimeout(noSupport, 5 * 1000, channels[i]);
                } else if (slackUsers.length > 0 && global.timers[channels[i]]) {
                  clearTimeout(global.timers[channels[i]]);
                }
              }
            }
          }
        }
      });

      await global.bot[workspaceId].start();

      async function addPresenceSubscriptions(workspaceId, userIds) {
        if (userIds) {
          await global.bot[workspaceId].subscribePresence(userIds);  
        } else {
          const users = await global.slackWeb[workspaceId].users.list();
          if (users.ok) {
            const members = users.members.map(member => (member.id));
            await global.bot[workspaceId].subscribePresence(members);  
          }
        }
      }
    } else {
      return false;
    }
  }
  return true;
}

async function noSupport(channelId) {
  const user = await User.findOne({
    where: {
      channelId: channelId
    }
  });
  let slackUsers = [];
  if (user.slackId) slackUsers = user.slackId.split(',');
  if (slackUsers.length <= 0) {
    socket.emitToSocketId(channelId, 'NoSupport');
  }
  clearTimeout(global.timers[channelId]);
}

