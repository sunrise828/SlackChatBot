const { RTMClient } = require('@slack/rtm-api');
const { Op } = require("sequelize");
const moment = require('moment');
const { WebClient, LogLevel } = require('@slack/web-api');
const socket = require('./socket');
const _ = require('lodash');
const axios = require('axios');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const User = require('../models').ChatUser;
const History = require('../models').History;
const { apiTicket } = require('../utils');

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

      if (data.text.indexOf(data.user) >= 0) {
        return;
      }

      const user = await User.findOne({
        where: {
          channelId: data.channel
        }
      });

      if (user) {
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
          event_ts: moment(history.createdAt).utcOffset(0).toISOString(),
          ts: moment(history.createdAt).utcOffset(0).toISOString(),
          domain: 'slack'
        }
        socket.emitToSocketId(data.channel, 'Message', sendData);

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
        apiTicket('import', params, async (res) => {
          if (res.status && !user.ticketId) {
            user.ticketId = res.ticket;
            await user.save();
            emitToSocketId(user.channelId, 'Ticket:Create', {
              ticket: user.ticketId
            });
          }
        })
        // axios.post(config.apiHost + 'importticket', params)
        //   .then(async (res) => {
        //     console.log('api called', res.data);
        //     if (res.data.status && !user.ticketId) {
        //       user.ticketId = res.data.ticket;
        //       await user.save();
        //       emitToSocketId(user.channelId, 'Ticket:Create', {
        //         ticket: user.ticketId
        //       });
        //     }
        //   })
        //   .catch(err => {
        //     console.log('api failed', err);
        //   });
      }
      
    });

    global.bot[workspace.id].on('user_typing', async function (data) {
      const sendData = {
        status: 'aTyping'
      }
      socket.emitToSocketId(data.channel, 'Message', sendData);
    });

    global.bot[workspace.id].on('member_joined_channel', async function (event) {
      // Add the subscription
      if (event.user == workspace.botUserId) {
        return;
      }

      const chatUser = await User.findOne({
        where: {
          channelId: event.channel,
          status: 0
        }
      });
      let slackUserName = event.user;
      let history = null;
      if (chatUser) {
        let slackUsers = [];
        if (chatUser.slackId)
          slackUsers = chatUser.slackId.split(',');
        slackUsers.push(event.user);
        chatUser.slackId = slackUsers.join(',');

        const slackUserRes = await global.slackWeb[workspace.id].users.info({
          user: event.user
        });
        if (slackUserRes.ok) {
          slackUserName = slackUserRes.user.name;
          history = await History.create({
            text: `${slackUserName} has joined chat.`,
            channel: event.channel,
            domain: 'system',
            sent: 1,
            slackUser: ''
          });

          apiTicket('import', {
            requestorName: chatUser.name,
            requestorEmail: chatUser.email,
            serialId: chatUser.workspaceId,
            content: `${slackUserName} has joined chat.`,
            domain: 'slack',
            userId: event.user
          });
          
          if (chatUser.slackUserName)
            chatUser.slackUserName = chatUser.slackUserName + ',' + slackUserRes.user.name;
          else
            chatUser.slackUserName = slackUserRes.user.name;

          socket.emitToSocketId(event.channel, 'Joined:Slack', {
            author: 'System',
            message: `${slackUserName} has joined chat.`,
            type: event.type,
            event_ts: moment(history.createdAt).utcOffset(0).toISOString(),
            ts: moment(history.createdAt).utcOffset(0).toISOString(),
            domain: 'slack',
            supportName: slackUserName,
            photoUrl: slackUserRes.user.profile.image_original || slackUserRes.user.profile.image_24
          })
        }
        await chatUser.save();
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
                global.timers[channels[i]] = setTimeout(noSupport, workspace.limitTime * 60 * 1000, channels[i]);
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
        let slackUsers = [], userNames = [];
        if (user.slackId) {
          slackUsers = user.slackId.split(',');
          userNames = user.slackUserName.split(',');
        }
        const userIndex = slackUsers.findIndex(user => (user == event.user));
        let newUsers = slackUsers.filter(id => (id != event.user));
        newUsers = _.uniq(newUsers);
        user.slackId = newUsers.join(',');
        let temp = userNames.splice(0, userIndex);
        temp = temp.concat(userNames.splice(userIndex + 1));
        user.slackUserName = temp.join(',');
        await user.save();
        if (newUsers.length < 1) {
          global.timers[event.channel] = setTimeout(noSupport, workspace.limitTime * 60 * 1000, event.channel);
        }
      }
    })

    global.bot[workspace.id].on('channel_archive', async function (event) {
      if (event.user == workspace.botUserId || event.user == workspace.userId) {
        return;
      }

      console.log('channel archived', event);

      const user = await User.findOne({
        where: {
          channelId: event.channel
        }
      });

      if (user) {
        // let slackUsers = [], userNames = [];
        // if (user.slackId) {
        //   slackUsers = user.slackId.split(',');
        //   userNames = user.slackUserName.split(',');
        // }
        // const userIndex = slackUsers.findIndex(user => (user == event.user));
        // let newUsers = slackUsers.filter(id => (id != event.user));
        // newUsers = _.uniq(newUsers);
        // user.slackId = newUsers.join(',');
        // let temp = userNames.splice(0, userIndex);
        // temp = temp.concat(userNames.splice(userIndex + 1));
        // user.slackUserName = temp.join(',');
        user.status = 1;
        await user.save();
        socket.emitToSocketId(event.channel, 'Finished', {
          ts: moment().utcOffset(0).toISOString(),
          msg: `Chat closed by <em>${user.slackUserName}</em>`
        });
        await global.slackWeb[workspace.id].chat.postMessage({
          channel: workspace.incomeChannelId,
          text: `_Chat closed on_ <#${user.channelId}|${user.channel}> by _<@${event.user}>_.`,
          attachments: [{
            pretext: 'Visitor Information',
            text: `Name: ${user.name} \n Email: ${user.email}\n Page: ${user.webPage} `
          }]
        });
        const history = await History.create({
          text: 'Ticket finished',
          channel: event.channel,
          domain: 'system'
        });

        apiTicket('import', {
          requestorName: user.name,
          requestorEmail: user.email,
          serialId: user.workspaceId,
          content: `<em>Chat closed by ${user.slackUserName}.</em>`,
          domain: 'slack',
          userId: event.user,
          ticketId: user.ticketId
        });
        
        if (user.ticketId) {
          apiTicket('finish', {
            requestorName: user.name,
            requestorEmail: user.email,
            serialId: user.workspaceId,
            domain: 'slack',
            userId: event.user,
            ticketId: user.ticketId
          });
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
    const history = await History.create({
      text: 'Ticket finished',
      channel: channelId,
      domain: 'system'
    });
    if (user.ticketId) {
      apiTicket('finish', {
        requestorName: user.name,
        requestorEmail: user.email,
        serialId: user.workspaceId,
        domain: 'slack',
        ticketId: user.ticketId
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

