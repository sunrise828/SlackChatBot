const UserController = require('../controllers').user;
const slackbot = require('./slackbot');
const History = require('../models').History;

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
        const query = socket.request._query;
        const channelName = query.address;
        socket.on("User:Arrived", async function (data) {
            const queIndex = data.message.indexOf('-');
            const queId = Number(data.message.substr(0, queIndex));
            const queName = data.message.substr(queIndex + 1);
            const newChannel = await UserController.getNewChannel(channelName);
            UserController.findOrCreate({
                where: {
                    email: data.email,
                    name: data.name,
                    sessionId: data.sessionId
                },
                defaults: {
                    channel: newChannel.length > 0 ? newChannel : `customer-${new Date().getTime()}`,
                    workspaceId: data.wid,
                    queueId: queId
                }
            }).then(async ([user, created]) => {
                let newUser = await createChannel(user, queName);
                const plainUser = user.get({ plain: true });
                socket.join(plainUser.channelId);
                roomInit(socket, user);
                emitToSocketId(plainUser.channelId, 'Room:Created', {
                    sessionId: plainUser.sessionId,
                    channel: plainUser.channelId,
                    id: plainUser.id
                })

            }).catch(err => {
                console.error('error occured while adding user', err);
                // socket.emit('')
            });
        });
    });
};

function createChannel(user, queName) {
    return new Promise(async (resolve, reject) => {
        const plainUser = user.get({ plain: true });
        const flag = await slackbot.init(plainUser.workspaceId);
        if (flag) {
            const web = global.slackWeb[plainUser.workspaceId];
            if (!plainUser.channelId || plainUser.channelId.length <= 0) {
                const listRes = await web.conversations.list();
                if (listRes.ok) {
                    let curName = plainUser.channel.split('_');
                    curName = curName.slice(0, curName.length - 1);
                    const channels = listRes.channels.sort((a, b) => (b.created - a.created));
                    const lists= channels.filter(ch => (ch.name.indexOf(curName.join('_') >= 0)));
                    const curIndex = lists.findIndex(ch => (ch.name == plainUser.channel));
                    if (curIndex >= 0) {
                        const pre = lists[0].name.split('_');
                        user.channel = curName.join('_') + '_' + (Number(pre[pre.length - 1]) + 1);
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
                    const broadMessage = `Chat starting in <#${plainUser.channelId}|${plainUser.channel}>.\n${plainUser.name} sent first message for queue "${queName}" to <#${plainUser.channelId}|${plainUser.channel}>`;
                    await web.chat.postMessage({
                        text: broadMessage,
                        channel: user.channelId});
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

function roomInit(socket, user) {
    const plainUser = user.get({ plain: true });
    const roomId = plainUser.channelId;
    socket.in(`${roomId}`).on('Joined:Room', async () => {
        // emitToSocketId(plainUser.channel, 'Error', 'Invalid Workspace Id');
        await global.slackWeb[plainUser.workspaceId].chat.postMessage({
            channel: 'stp',
            text: `${plainUser.name} started the conversation on <#${plainUser.channelId}|${plainUser.channel}>.`
        });
    });

    socket.in(`${roomId}`).on('Message', async (message) => {
        const history = await History.create({
            text: message.message,
            from: plainUser.id,
            to: plainUser.channelId,
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
        } else {
            console.log('error message to slack', res);
        }
    })
}