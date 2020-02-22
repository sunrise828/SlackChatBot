const axios = require('axios');
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

            if (wRes.status != 200 || wRes.data.msg !== 'success') {
                return emitOverChannel('Error', {
                    reason: 'wrong_workspace_id',
                    sessionId: data.sessionId
                });
            }
            const workspace = wRes.data.slackbot;
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
                        webPage: data.currentPage
                    }
                });
                if (users.length > 0) {
                    user = await createChannel(users[0], workspace);
                }
            }

            if (user) {
                socket.join(user.channelId);
                clearClientTimer();
                const plainUser = user.get({ plain: true });
                roomInit(socket, user, workspace, data.status == 'started');
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
                    reason: 'wrong_workspace_id',
                    sessionId: data.sessionId
                });
            }
        });
    });
};

function createChannel(user, workspace) {
    return new Promise(async (resolve, reject) => {
        const plainUser = user.get({ plain: true });
        const flag = await slackbot.init({
            id: plainUser.workspaceId,
            ...workspace
        });
        if (flag) {
            const web = global.slackWeb[plainUser.workspaceId];
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
                        channel: user.channelId,
                        attachments: [{
                            pretext: 'Visitor Information',
                            text: `Name: ${user.name} \n Email: ${user.email}\n Page: ${user.webPage} `
                        }]
                    });
                } else {
                    console.error('error of creating channel:', res.data.error);
                }
            }

            if (plainUser.joined < 1) {
                const joinRes = await web.conversations.join({
                    channel: plainUser.channelId
                });
                if (!joinRes.ok) {
                    console.error('error of joining channel:', joinRes.error);
                } else {
                    user.joined = 1;
                    user.save();
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

    sendHistories(plainUser, refresh);
    socket.in(`${roomId}`).on('Joined:Room', async () => {
        clearClientTimer(roomId);
        sendHistories(plainUser);
        await global.slackWeb[plainUser.workspaceId].chat.postMessage({
            channel: workspace.incomeChannelId,
            text: `${plainUser.name} started the conversation on <#${plainUser.channelId}|${plainUser.channel}>.`,
            attachments: [{
                "pretext": "Visitor Information",
                "text": "Name: " + plainUser.name + "\n Email: " + plainUser.email + "\nPage: " + plainUser.webPage
            }]
        });
    });

    socket.in(`${roomId}`).on('Typing', async (message) => {
        clearClientTimer(roomId);
        if (global.bot[plainUser.workspaceId]) {
            global.bot[plainUser.workspaceId].sendTyping(plainUser.channelId);
        }
    })

    socket.in(`${roomId}`).on('Message', async (message) => {
        clearClientTimer(roomId);
        const history = await History.create({
            text: message.message,
            channel: roomId,
            domain: 'user'
        });

        emitToSocketId(roomId, 'Message', {
            author: '',
            message: message.message,
            type: '',
            event_ts: history.createdAt,
            ts: history.createdAt,
            domain: 'user'
        });
        

        if (global.slackWeb[message.wid]) {
            const res = await global.slackWeb[message.wid].chat.postMessage({
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
    
                axios.post(config.apiHost + 'importticket', params)
                    .then(async (res) => {
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
            } else {
                console.log('error message to slack', res);
            }
        }
        
    });

    socket.in(`${roomId}`).on('Finished', async (message) => {
        if (global.clientTimers[roomId]) {
            clearTimeout(global.clientTimers[roomId]);
            delete global.clientTimers[roomId];
        }
        const user = await User.findOne({
            where: {
                channelId: roomId
            }
        });

        if (user) {
            user.status = 1;
            await user.save();
            if (global.slackWeb[user.workspaceId]) {
                await global.slackWeb[user.workspaceId].chat.postMessage({
                    channel: user.channelId,
                    text: `${user.name} finished the conversation on <#${user.channelId}|${user.channel}>.`
                });
            }

            if (user.ticketId) {
                axios.post(config.apiHost + 'finishticket', {
                    requestorName: user.name,
                    requestorEmail: user.email,
                    serialId: user.workspaceId,
                    domain: 'user',
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
    });

    socket.in(`${roomId}`).on('disconnect', async (message) => {
        global.slackWeb[user.workspaceId].chat.postMessage({
            text: `${user.name} went offline`,
            channel: user.channelId
        });
    });
}

async function sendHistories(user, flag = false) {
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

    if (global.clientTimers[user.channelId]) {
        clearTimeout(global.clientTimers[user.channelId]);
        global.clientTimers[user.channelId] = null;
    }

    if (flag && user.status < 1 && global.slackWeb[user.workspaceId]) {
        await global.slackWeb[user.workspaceId].chat.postMessage({
            channel: user.channelId,
            text: `${user.name} come back online.`
        });
    }

    emitToSocketId(user.channelId, 'Histories', {
        status: user.status > 0? 'finished': 'history',
        msgs: latest,
        ticket: user.ticketId
    });
}

async function clearClientTimer(roomId) {
    if (global.clientTimers[roomId]) {
        clearTimeout(global.clientTimers[roomId]);
        global.clientTimers[roomId] = null;
    }
    global.clientTimers[roomId] = setTimeout(() => {
        emitToSocketId(roomId, '2MinAlert');
        global.clientTimers[roomId] = setTimeout(() => {
            emitToSocketId(roomId, '3MinAlert');
            global.clientTimers[roomId] = setTimeout(() => {
                emitToSocketId(roomId, 'Finished');
                clearTimeout(global.clientTimers[roomId]);
                global.clientTimers[roomId] = null;
            }, 60 * 1000);
        }, 60 * 1000);
    }, 2 * 60 * 1000);
}