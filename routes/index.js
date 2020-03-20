const User = require('../models').ChatUser;

module.exports = (app) => {
    app.get('/', (req, res) => {
        res.status(200).send({
            message:    'Welcome'
        })
    });

    app.post('/api/v1/rtphelp', (req, res) => {
        res.send({
            "response_type": "in_channel",
            text: `_RTP Help Center_.`,
            attachments: [{
                "pretext": "/rtp-finish",
                "text": "finish current conversation."
            }]
        });
    });

    app.post('/api/v1/rtpfinish', async (req, res) => {
        console.log('rtp finished', req.body);
        res.send();
        const { channel_id, user_id, user_name, team_id } = req.body;
        
        try {
            const user = await User.findOne({
                where: {
                    channelId: channel_id
                }
            });
    
            if (user && user.slackToken && global.slackWeb[user.slackToken]) {
                // const memberRes = await global.slackWeb[user.slackToken]
                await global.slackWeb[user.slackToken].conversations.archive({
                    channel: channel_id
                });
            }
        } catch(err) {
            console.log('error', err);
        }
    })
}