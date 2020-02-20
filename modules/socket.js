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
            const wRes = await axios.post('https://www.testrtp.com/api/v1/slackbot/getinfobyserial',
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
            const newChannel = await UserController.getNewChannel(data.name, workspace.queueName);
            UserController.findOrCreate({
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
            }).then(async ([user, created]) => {

                if (user.status > 0) {
                    socket.join(user.channelId);
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
                    return emitToSocketId(user.channelId, 'Histories', {
                        status: 'finished',
                        msgs: latest
                    });
                } else {
                    let newUser = await createChannel(user, workspace);
                    const plainUser = newUser.get({ plain: true });
                    socket.join(plainUser.channelId);
                    roomInit(socket, newUser, workspace);
                    emitToSocketId(plainUser.channelId, 'Room:Created', {
                        sessionId: plainUser.sessionId,
                        channel: plainUser.channelId,
                        id: plainUser.id
                    });
                }
                
            }).catch(err => {
                console.error('error occured while adding user', err);
                // socket.emit('')
            });
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
                    const lists= channels.filter(ch => (ch.name.indexOf(seed) == 0));
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

function getChannel (lists, cname) {
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

async function roomInit(socket, user, workspace) {
    const plainUser = user.get({ plain: true });
    const roomId = plainUser.channelId;

    sendHistories(plainUser);
    socket.in(`${roomId}`).on('Joined:Room', async () => {
        // emitToSocketId(plainUser.channel, 'Error', 'Invalid Workspace Id');
        sendHistories(plainUser);
        await global.slackWeb[plainUser.workspaceId].chat.postMessage({
            channel: workspace.incomeChannelId,
            text: `${plainUser.name} started the conversation on <#${plainUser.channelId}|${plainUser.channel}>.`,
            attachments: [{
                "pretext": "Visitor Information",
                "text": "Name: "+ plainUser.name + "\n Email: "+ plainUser.email + "\nPage: " + plainUser.webPage
            }]
        });
    });

    socket.in(`${roomId}`).on('Typing', async (message) => {
        global.bot[plainUser.workspaceId].sendTyping(plainUser.channelId);
    })

    socket.in(`${roomId}`).on('Message', async (message) => {
        const history = await History.create({
            text: message.message,
            channel: roomId,
            domain: 'user'
        });
        // slackbot.postMessageToChannel(plainUser.channelId, message.message)
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
                    emitToSocketId(user.channelId, 'Message', {
                        author: 'Support Man',
                        message: `Ticket with #-${user.ticketId} is created.`,
                        type: '',
                        event_ts: new Date().getTime(),
                        ts: new Date().getTime()
                    })
                }
            })
            .catch(err => {
                console.log('api failed', err);
            });
        } else {
            console.log('error message to slack', res);
        }
    });

    socket.in(`${roomId}`).on('Finished', async (message) => {
        const user = await User.findOne({
            where: {
                channelId: roomId
            }
        });

        if (user) {
            user.status = 1;
            await user.save();
            await global.slackWeb[user.workspaceId].chat.postMessage({
                channel: user.channelId,
                text: `${user.name} finished the conversation on <#${user.channelId}|${user.channel}>.`
            });

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
        global.clientTimers[roomId] = setTimeout(async () => {
            const user = await User.findOne({
                where: {
                    channelId: roomId
                }
            });
            if (user) {
                user.status = 1;
                await user.save();

                await global.slackWeb[user.workspaceId].chat.postMessage({
                    channel: user.channelId,
                    text: `${user.name} finished the conversation on <#${user.channelId}|${user.channel}>.`
                });
            }
        }, 4 * 60 * 1000);
    });
}

async function sendHistories(user) {
    if (global.clientTimers[user.channelId]) {
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

        clearTimeout(global.clientTimers[user.channelId]);
        global.clientTimers[user.channelId] = null;
         
        await global.slackWeb[user.workspaceId].chat.postMessage({
            channel: user.channelId,
            text: `${user.name} come back online.`
        });

        emitToSocketId(user.channelId, 'Histories', {
            status: 'openning',
            msgs: latest
        });
    }
}