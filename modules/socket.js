const UserController = require('../controllers').user;
const slackbot = require('./slackbot');
const History = require('../models').History;

function emitToSocketId(socketId, eventName, data) {
    console.log(`Emit ${eventName}`, socketId, data);
    global.io.to(`${socketId}`).emit(eventName, data);
};
exports.emitToSocketId = emitToSocketId;

function emitOverChannel (eventName, data) {
    console.log(`Emit over channel ${eventName}`, data);
    global.io.emit(eventName, data);
};
exports.emitOverChannel = emitOverChannel;

exports.init = async () => {
    global.io.on('connection', async (socket) => {
        const query = socket.request._query;

        socket.on("User:Arrived", async function (data) {
            console.info('user arrived', data);
            UserController.findOrCreate({
                where: {
                    email: data.email,
                    name: data.name,
                    sessionId: data.sessionId
                },
                defaults: {
                    channel: `customer-${new Date().getTime()}`,
                    workspaceId: data.wid,
                    question: data.question
                }
            }).then(([user, created]) => {
                const plainUser = user.get({plain: true});
                socket.join(plainUser.channel);
                roomInit(socket, user);
                emitOverChannel('Room:Created', {
                    sessionId: plainUser.sessionId,
                    channel: plainUser.channel,
                    id: plainUser.id
                })
                // emitToSocketId(plainUser.channel, 'Create:Room', plainUser.id);
                
            }).catch(err => {
                console.error('error occured while adding user', err);
                // socket.emit('')
            });
        });
    });
};

function roomInit(socket, user) {
    const plainUser = user.get({plain: true});
    const roomId = plainUser.channel;
    socket.in(`${roomId}`).on('Joined:Room', async () => {
        const flag = await slackbot.init(plainUser.workspaceId);
        if (flag) {
            const workspace = global.bot[plainUser.workspaceId].myWorkspace;
            const accessToken = workspace.accessToken;
            if (!plainUser.channelId || plainUser.channelId.length <= 0) {
                const res = await slackbot.createChannel(roomId, accessToken);
            
                const cRes = await global.bot[plainUser.workspaceId]._api('channels.list');
                if (cRes.ok) {
                    global.bot[plainUser.workspaceId].channels = cRes.channels;
                }
                
                if (res.data.ok) {
                    const channel = res.data.channel;
                    const joinRes = await slackbot.joinChannel(user.channelId, accessToken);
                    if (!joinRes.data.ok) {
                        console.error('error of joining channel:', joinRes.data.error);
                    }
                    user.channelId = channel.id;
                    user.slackId = channel.creator;
                    await user.save();
                    const broadMessage = `${plainUser.name} sent first message to <#${plainUser.channelId}|${plainUser.channel}>`;
                    await global.bot[plainUser.workspaceId].postMessageToChannel(workspace.incomeChannelName, broadMessage, {});
                } else {
                    console.error('error of creating channel:', res.data.error);
                }
            }

            if (plainUser.joined < 1) {
                const joinRes = await slackbot.joinChannel(plainUser.channelId, accessToken);
                if (!joinRes.data.ok) {
                    console.error('error of joining channel:', joinRes.data.error);
                } else {
                    user.joined = 1;
                    user.save();
                }
            }
    
            if (plainUser.active < 1) {
                const activeRes = await slackbot.inviteUser(user.channelId, accessToken, workspace.botUserId);
                if (activeRes.data.ok) {
                    user.active = 1;
                    await user.save();
                } else {
                    console.error('error of joining channel:', activeRes.data.error);
                }
            }
        } else {
            emitToSocketId(plainUser.channel, 'Error', 'Invalid Workspace Id');
        }
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
        global.bot[message.wid].postMessageToChannel(plainUser.channel, message.message, {}).then(res => {
            history.sent = 1;
            history.save();
        }).fail(err => {
            console.error('error message to slack', err);
        });
    })
}