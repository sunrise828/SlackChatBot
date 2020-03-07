const axios = require('axios');
const moment = require('moment');
const UserController = require('../controllers').user;
const slackbot = require('./slackbot');
const History = require('../models').History;
const User = require('../models').ChatUser;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

function emitToSocketId(socketId, eventName, data) {
    console.log(`Emit ${eventName}`, socketId, data);
    global.io.to(`${socketId}`).emit(eventName, data);
};
exports.emitToSocketId = emitToSocketId;

function emitOverChannel(eventName, data) {
    console.log(`Emit over channel ${eventName}`, data);
    global.io.emit(eventName, data);
};
exports.emitOverChannel = emitOverChannel;

exports.init = async () => {
    global.io.on('connection', async (socket) => {
        socket.on("User:Arrived", async function (data) {
            const wRes = await axios.post(config.apiHost + 'getinfobyserial',
                {
                    serialId: data.wid
                });


            if (wRes.status != 200 || wRes.data.status < 1) {
                console.log('workspace', wRes.data);
                return emitOverChannel('Error', {
                    reason: 'wrong_workspace_id',
                    sessionId: data.sessionId
                });
            } else {
                console.log('available workspace');
                const workspace = { ...wRes.data.slackbot, warnning: wRes.data.warnmessage };

                const presence = await slackbot.verifyChannels(workspace);
                if (!presence) {
                    return emitOverChannel('Error', {
                        reason: 'not_support',
                        sessionId: data.sessionId
                    });
                }

                let user = null;
                if (data.status != 'not-started') {
                    user = await User.findOne({
                        where: {
                            email: data.email,
                            name: data.name,
                            sessionId: data.sessionId
                        }
                    });
                } else {
                    const tRes = await axios.post(config.apiHost + 'createticket',
                        {
                            serialId: data.wid,
                            requestorEmail: data.email,
                            requestorName: data.name,
                            requestUrl: data.currentPage
                        });

                    if (tRes.status != 200 || tRes.data.status < 1) {
                        return emitOverChannel('Error', {
                            reason: 'wrong_workspace_id',
                            sessionId: data.sessionId
                        });
                    }
                    const ticket = tRes.data.ticket;

                    const newChannel = await UserController.getNewChannel(data.name, workspace.queueName);
                    const users = await User.findOrCreate({
                        where: {
                            email: data.email,
                            name: data.name,
                            sessionId: data.sessionId
                        },
                        defaults: {
                            channel: newChannel.length > 0 ? newChannel : `customer-${new Date().getTime()}`,
                            workspaceId: data.wid,
                            status: 0,
                            webPage: data.currentPage,
                            ticketId: ticket
                        }
                    });
                    if (users.length > 0) {
                        user = await createChannel(users[0], workspace);
                    }
                }

                if (user) {
                    socket.join(user.channelId);
                    const plainUser = user.get({ plain: true });
                    const conNums = Object.keys(global.io.to(user.channelId).connected).length;
                    const refresh = conNums < 2 && data.status == 'started';
                    roomInit(socket, user, workspace, refresh);
                    emitToSocketId(plainUser.channelId, 'Welcome', {
                        ticket: user.ticketId,
                        welcomeMsg: workspace.welcomeMessage,
                        ts: moment(user.createdAt).utcOffset(0).toISOString()
                    });
                    await global.slackWeb[workspace.accessToken].chat.postMessage({
                        text: `*${user.name}* _is on_ ${data.currentPage}`,
                        channel: user.channelId
                    });
                    if (data.status == 'not-started') {
                        emitToSocketId(plainUser.channelId, 'Room:Created', {
                            sessionId: plainUser.sessionId,
                            channel: plainUser.channelId,
                            id: plainUser.id,
                            ticket: user.ticketId
                        });
                    }
                } else {
                    return emitOverChannel('Error', {
                        reason: 'wrong_session_id',
                        sessionId: data.sessionId
                    });
                }
            }

        });
    });
};

function createChannel(user, workspace) {
    return new Promise(async (resolve, reject) => {
        const plainUser = user.get({ plain: true });
        const flag = await slackbot.init({
            id: workspace.accessToken,
            ...workspace
        });
        if (flag) {
            const web = global.slackWeb[workspace.accessToken];
            if (!plainUser.channelId || plainUser.channelId.length <= 0) {
                const listRes = await web.conversations.list();
                if (listRes.ok) {
                    let curName = plainUser.channel.split('_');
                    curName = curName.slice(0, curName.length - 1);
                    const channels = listRes.channels.sort((a, b) => (b.created - a.created));
                    const seed = curName.join('_');
                    const lists = channels.filter(ch => (ch.name.indexOf(seed) == 0));
                    const cname = getChannel(lists, plainUser.channel);
                    if (cname && cname.length > 0) {
                        user.channel = cname;
                        user.save();
                    }
                }
                const res = await web.conversations.create({
                    name: user.channel,
                    is_private: false,
                    validate: false
                });

                if (res.ok) {
                    const channel = res.channel;
                    const joinRes = await web.conversations.join({
                        channel: channel.id
                    });
                    if (!joinRes.ok) {
                        console.error('error of joining channel:', joinRes.data.error);
                    }
                    user.channelId = channel.id;
                    await user.save();
                    const broadMessage = `Chat starting in <#${plainUser.channelId}|${plainUser.channel}>.\n${plainUser.name} sent first message for queue "${workspace.queueName}" to <#${plainUser.channelId}|${plainUser.channel}>`;
                    await web.chat.postMessage({
                        text: broadMessage,
                        channel: workspace.incomeChannelId,
                        attachments: [{
                            pretext: 'Visitor Information',
                            text: `Name: ${user.name} \n Email: ${user.email}\n Page: ${user.webPage} `
                        }]
                    });
                } else {
                    console.error('error of creating channel:', res.data.error);
                }
            }

            if (plainUser.active < 1) {
                const joinedUsers = await web.conversations.members({
                    channel: user.channelId
                });
                let flag = !joinedUsers.ok;
                if (joinedUsers.ok) {
                    flag = flag || joinedUsers.members.indexOf(web.botUserId) < 0;
                }

                if (flag) {
                    const activeRes = await web.conversations.invite({
                        channel: user.channelId,
                        users: web.botUserId
                    });
                    if (activeRes.ok) {
                        user.active = 1;
                        await user.save();
                    } else {
                        console.error('error of joining channel:', activeRes.error);
                    }
                } else {
                    user.active = 1;
                    await user.save();
                }

            }

            const joinRes = await web.conversations.leave({
                channel: plainUser.channelId
            });
            if (!joinRes.ok) {
                console.error('error of joining channel:', joinRes.error);
            }
        }
        return resolve(user);
    });
}

function getChannel(lists, cname) {
    let curName = cname.split('_');
    curName = curName.slice(0, curName.length - 1);
    const curIndex = lists.findIndex(ch => (ch.name == cname));
    if (curIndex > -1) {
        const pre = lists[curIndex].name.split('_');
        cname = curName.join('_') + '_' + (Number(pre[pre.length - 1]) + 1);
        return getChannel(lists, cname);
    } else {
        return cname;
    }
}

async function roomInit(socket, user, workspace, refresh) {
    const plainUser = user.get({ plain: true });
    const roomId = plainUser.channelId;
    console.log('room init', roomId);
    await sendHistories(plainUser, workspace, refresh);
    socket.in(`${roomId}`).on('Joined:Room', async () => {
        console.log('connected users', socket.in(`${roomId}`).connected);
        // clearClientTimer(roomId, workspace);
        await sendHistories(plainUser, workspace);
        await global.slackWeb[workspace.accessToken].chat.postMessage({
            channel: plainUser.channelId,
            text: `*${plainUser.name}* _started the conversation on_ <#${plainUser.channelId}|${plainUser.channel}>.`,
            attachments: [{
                "pretext": "Visitor Information",
                "text": "Name: " + plainUser.name + "\n Email: " + plainUser.email + "\nPage: " + plainUser.webPage
            }]
        });

    });

    socket.in(`${roomId}`).on('Typing', async (message) => {
        clearClientTimer(roomId, workspace, plainUser);
        if (global.bot[workspace.accessToken]) {
            global.bot[workspace.accessToken].sendTyping(plainUser.channelId);
        }
    })

    socket.in(`${roomId}`).on('Message', async (message) => {
        clearClientTimer(roomId, workspace, plainUser);
        const history = await History.create({
            text: message.message,
            channel: roomId,
            domain: 'user'
        });

        emitToSocketId(roomId, 'Message', {
            author: '',
            message: message.message,
            type: '',
            event_ts: moment(history.createdAt).utcOffset(0).toISOString(),
            ts: moment(history.createdAt).utcOffset(0).toISOString(),
            domain: 'user'
        });


        if (global.slackWeb[workspace.accessToken]) {
            const res = await global.slackWeb[workspace.accessToken].chat.postMessage({
                channel: plainUser.channel,
                text: message.message
            });
            if (res.ok) {
                history.sent = 1;
                history.save();

                let params = {
                    requestorName: user.name,
                    requestorEmail: user.email,
                    serialId: user.workspaceId,
                    content: message.message,
                    domain: 'user'
                };

                if (user.ticketId) {
                    params.ticketId = user.ticketId;
                }

                importTicket(params);
            } else {
                console.log('error message to slack', res);
            }
        }

    });

    socket.in(`${roomId}`).on('Finished', async (message) => {
        if (global.clientTimers[roomId]) {
            clearInterval(global.clientTimers[roomId].timer);
            global.clientTimers[roomId] = null;
            delete global.clientTimers[roomId];
        }
        finishChannel(roomId, workspace, false);
        emitToSocketId(roomId, 'Finished');
    });

    socket.in(`${roomId}`).on('disconnect', async (message) => {
        const conNum = Object.keys(global.io.to(roomId).connected).length;
        if (global.slackWeb[workspace.accessToken] && conNum < 1) {
            const newUser = await user.reload();

            if (newUser.status < 1) {
                global.slackWeb[workspace.accessToken].chat.postMessage({
                    text: `*${user.name}* _went offline_.`,
                    channel: user.channelId
                });
    
                await History.create({
                    text: `<b>${user.name}</b> <em>went offline</em>.`,
                    channel: roomId,
                    domain: 'system-user'
                });
    
                importTicket({
                    requestorName: user.name,
                    requestorEmail: user.email,
                    serialId: user.workspaceId,
                    content: `<b>${user.name}</b> <em>went offline</em>.`,
                    domain: 'system',
                    ticketId: user.ticketId
                });
            }
        }
    });
}

function sendHistories(user, workspace, flag = false) {
    return new Promise(async (resolve, reject) => {
        const histories = await History.findAll({
            where: {
                channel: user.channelId
            },
            order: [
                'createdAt'
            ]
        });

        const latest = histories.map(history => ({
            text: history.text,
            domain: history.domain,
            createdAt: history.createdAt
        }));

        if (user.status > 0) {
            if (global.clientTimers[user.channelId]) {
                clearInterval(global.clientTimers[roomId].timer);
                global.clientTimers[roomId] = null;
                delete global.clientTimers[roomId];
            }
        } else {
            clearClientTimer(user.channelId, workspace, user);
        }


        if (flag && user.status < 1 && global.slackWeb[workspace.accessToken]) {

            await global.slackWeb[workspace.accessToken].chat.postMessage({
                channel: user.channelId,
                text: `*${user.name}* _come back online_.`
            });
        }

        emitToSocketId(user.channelId, 'Histories', {
            status: user.status > 0 ? 'finished' : 'history',
            msgs: latest,
            ticket: user.ticketId,
            slackUser: user.slackUserName
        });

        resolve();
    });
}

async function clearClientTimer(roomId, workspace, keys) {
    if (global.clientTimers[roomId]) {
        clearInterval(global.clientTimers[roomId].timer);
        global.clientTimers[roomId] = null;
        delete global.clientTimers[roomId];
    }
    if (workspace.warnning.length > 0) {
        global.clientTimers[roomId] = {
            timer: setInterval(async () => {
                console.log('roomId', roomId);
                global.clientTimers[roomId].index++;
                const warnning = workspace.warnning.find(item => (item.warnMinute == global.clientTimers[roomId].index));
                if (warnning && warnning.warnMessage && warnning.warnMessage.length > 0) {
                    const message = replaceKeywords(warnning.warnMessage, keys)
                    const history = await History.create({
                        text: message,
                        channel: roomId,
                        domain: 'system'
                    });
                    emitToSocketId(roomId, 'Alert', {
                        ts: moment(history.createdAt).utcOffset(0).toISOString(),
                        msg: message
                    });
                    importTicket({
                        requestorName: keys['name'],
                        requestorEmail: keys['email'],
                        serialId: keys.workspaceId,
                        content: message,
                        domain: 'system',
                        ticketId: keys.ticketId
                    });
                }

                if (global.clientTimers[roomId].index == workspace.limitTime) {
                    emitToSocketId(roomId, 'Finish:Alert', {
                        ts: moment().utcOffset(0).toISOString(),
                        msg: `This chat has been completed and a copy of the transcript has been emailed to you at `
                    });
                    clearInterval(global.clientTimers[roomId].timer);
                    delete global.clientTimers[roomId];
                    finishChannel(roomId, workspace);
                }
            }, 60 * 1000),
            index: 0
        };
    }
}

function importTicket(params) {
    axios.post(config.apiHost + 'importticket', params)
    .then(async (res) => {
        console.log('import ticket', res.data);
    })
    .catch(err => {
        console.log('api failed', err);
    });
}

function replaceKeywords(str, keys) {
    const fIndex = str.indexOf('{');
    const lIndex = str.indexOf('}', fIndex) || str.length - 1;
    if (fIndex >= 0) {
        const key = str.substr(fIndex + 1, lIndex - fIndex - 1);
        if (keys[key]) {
            str = str.substr(0, fIndex) + keys[key] + str.substr(lIndex + 1);
            return replaceKeywords(str, keys);
        }
    } else {
        return str;
    }
}

async function finishChannel(roomId, workspace, flag = true) {
    const user = await User.findOne({
        where: {
            channelId: roomId
        }
    });

    if (user) {
        user.status = 1;
        await user.save();
        if (global.slackWeb[workspace.accessToken]) {
            await global.slackWeb[workspace.accessToken].chat.postMessage({
                channel: user.channelId,
                text: flag ? `_Chat closed due to inactivity_.` : `_Chat closed by ${user.name}_.`
            });
        }

        importTicket({
            requestorName: user.name,
            requestorEmail: user.email,
            serialId: user.workspaceId,
            content: flag ? `<em>Chat closed due to inactivity</em>.` : `<em>Chat closed by ${user.name}.</em>`,
            domain: 'system',
            ticketId: user.ticketId
        });
        if (user.ticketId) {
            axios.post(config.apiHost + 'finishticket', {
                requestorName: user.name,
                requestorEmail: user.email,
                serialId: user.workspaceId,
                domain: flag? 'system': 'user',
                ticketId: user.ticketId,
                content: flag ? `<em>Chat closed due to inactivity</em>.` : `<em>Chat closed by ${user.name}.</em>`
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
}