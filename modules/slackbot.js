const { RTMClient } = require('@slack/rtm-api');
const { Op } = require("sequelize");
const { WebClient, LogLevel } = require('@slack/web-api');
const socket = require('./socket');
const _ = require('lodash');
const axios = require('axios');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const User = require('../models').ChatUser;
const History = require('../models').History;

exports.init = async (workspace) => {
  if (Object.keys(global.bot).indexOf(workspace.id) < 0) {
    global.slackWeb[workspace.id] = new WebClient(workspace.accessToken, {
      logLevel: LogLevel.DEBUG
    });
    global.slackWeb[workspace.id]['botUserId'] = workspace.botUserId;
    global.bot[workspace.id] = new RTMClient(workspace.botAccessToken);

    global.bot[workspace.id].on('start', function () {
      console.info('============= bot started ===================');
    });

    global.bot[workspace.id].on('message', async function (data) {
      if (data.type != "message" || data.subtype) {
        return;
      }

      const history = await History.create({
        text: data.text,
        channel: data.channel,
        domain: 'slack',
        sent: 1,
        slackUser: data.user
      });

      const sendData = {
        author: 'Support Man',
        message: data.text,
        type: data.type,
        event_ts: data.event_ts,
        ts: data.ts,
        domain: 'slack'
      }
      socket.emitToSocketId(data.channel, 'Message', sendData);

      const user = await User.findOne({
        where: {
          channelId: data.channel
        }
      });

      let params = {
        requestorName: user.name,
        requestorEmail: user.email,
        serialId: user.workspaceId,
        content: data.text,
        domain: 'slack',
        userId: data.user
      };
      if (user.ticketId) {
        params.ticketId = user.ticketId;
      }
      console.log('params', params);
      axios.post(config.apiHost + 'importticket', params)
        .then(async (res) => {
          console.log('api called', res.data);
          if (res.data.status && !user.ticketId) {
            user.ticketId = res.data.ticket;
            await user.save();
            emitToSocketId(user.channelId, 'Ticket:Create', {
              ticket: user.ticketId
            });
          }
        })
        .catch(err => {
          console.log('api failed', err);
        });
    });

    global.bot[workspace.id].on('user_typing', async function (data) {
      const sendData = {
        status: 'aTyping'
      }
      socket.emitToSocketId(data.channel, 'Message', sendData);
    });

    global.bot[workspace.id].on('member_joined_channel', async function (event) {
      // Add the subscription
      if (event.user == workspace.botUserId || event.user == workspace.userId) {
        return;
      }
      const chatUsers = await User.findAll({
        where: {
          channelId: event.channel
        }
      });
      if (chatUsers.length) {
        for (var i = 0; i < chatUsers.length; i++) {
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
        await addPresenceSubscriptions();
      } catch (error) {
        console.log('Failed to subscribe to presence, error: ', error);
      }
    });

    global.bot[workspace.id].on('presence_change', async function (event) {
      let users = event.user ? [event.user] : event.users || [];
      if (users.length > 0) {
        // const userInfo = await global.slackWeb[worksp]
        let channels = [];
        const chs = await global.slackWeb[workspace.id].users.conversations({
          user: event.user
        });
        if (chs.ok) {
          channels = channels.concat(chs.channels.filter(ch => (ch.name.indexOf('z_') === 0)).map(ch => (ch.id)));
        }

        if (channels.length > 0) {
          for (var i = 0; i < channels.length; i++) {
            const user = await User.findOne({
              where: {
                channelId: channels[i]
              }
            });

            if (user) {
              let slackUsers = [];
              if (user.slackId) slackUsers = user.slackId.split(',');
              let newUsers = event.presence == 'away' ? slackUsers.filter(id => (id != event.user)) : slackUsers.concat([event.user]);
              newUsers = _.uniq(newUsers);
              user.slackId = newUsers.join(',');
              await user.save();
              if (slackUsers.length <= 0 && !global.timers[channels[i]]) {
                global.timers[channels[i]] = setTimeout(noSupport, 4 * 60 * 1000, channels[i]);
              } else if (slackUsers.length > 0 && global.timers[channels[i]]) {
                clearTimeout(global.timers[channels[i]]);
              }
            }
          }
        }
      }
    });

    global.bot[workspace.id].on('member_left_channel', async function (event) {
      if (event.user == workspace.botUserId || event.user == workspace.userId) {
        return;
      }

      const user = await User.findOne({
        where: {
          channelId: event.channel
        }
      });

      if (user) {
        let slackUsers = [];
        if (user.slackId) slackUsers = user.slackId.split(',');
        let newUsers = slackUsers.filter(id => (id != event.user));
        newUsers = _.uniq(newUsers);
        user.slackId = newUsers.join(',');
        await user.save();
        if (newUsers.length < 1) {
          global.timers[event.channel] = setTimeout(noSupport, 4 * 60 * 1000, event.channel);
        }
      }
    })

    await global.bot[workspace.id].start();

    async function addPresenceSubscriptions(userIds) {
      if (userIds) {
        await global.bot[workspace.id].subscribePresence(userIds);
      } else {
        const users = await global.slackWeb[workspace.id].users.list();
        if (users.ok) {
          const members = users.members.map(member => (member.id));
          const lastMembers = members.filter(member => ([workspace.botUserId, workspace.userId].indexOf(member) < 0));
          await global.bot[workspace.id].subscribePresence(lastMembers);
        }
      }
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
    user.status = 1;
    await user.save();
    socket.emitToSocketId(channelId, 'NoSupport');

    if (user.ticketId) {
      axios.post(config.apiHost + 'finishticket', {
        requestorName: user.name,
        requestorEmail: user.email,
        serialId: user.workspaceId,
        domain: 'slack',
        ticketId: user.ticketId
      })
        .then(async (res) => {
          if (res.status) {
            console.log('ticket finished ', res.data.ticket);
          }
        })
        .catch(err => {
          console.log('api failed', err);
        });
    }
  }
  clearTimeout(global.timers[channelId]);
}

exports.verifyChannels = (workspace) => {
  return new Promise(async (resolve) => {
    const webclient = global.slackWeb[workspace.id] || new WebClient(workspace.accessToken);
    if (webclient) {
      const { ok, members } = await webclient.conversations.members({
        channel: workspace.incomeChannelId
      });

      if (ok && members) {
        const promiseAll = members.map(member => {
          return new Promise(async (resolve, reject) => {
            const { ok, presence } = await webclient.users.getPresence({
              user: member
            });

            if (ok) {
              resolve(presence);
            } else {
              resolve({});
            }
          })
        });

        const results = await Promise.all(promiseAll);
        let flag = false;
        for (var i = 0; i < results.length; i++) {
          if (results[i] === 'active') {
            flag = true;
            break;
          }
        }
        resolve(flag);
      }
    } else {
      resolve(false);
    }
  })

}

