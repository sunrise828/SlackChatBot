const db = require('../models');
const User = db.ChatUser;
module.exports = {
    create: (user) => {
        return User.create(user);
    },
    find: (user) => {
        return User.findAll({
            where: user
        });
    },
    findOrCreate: (params) => {
        return User.findOrCreate(params);
    },
    getNewChannel: (name) => {
        return new Promise(async (resolve, reject) => {
            const usersD = await db.sequelize.query(`SELECT * FROM ChatUsers where channel like 'z-${name}-%' order by channel desc;`, {
                type: db.sequelize.QueryTypes.SELECT
            });
            const channels = usersD.map(user => (user.channel));
            let len = 0;
            if (channels.length > 0) {
                const oldChannel = channels[0];
                const chs = oldChannel.split('-');
                len = Number(chs[chs.length - 1]) + 1;
            }
            const newName = 'z_' + name + '_' + (len + 1);
            resolve(newName);
        })
    }

}