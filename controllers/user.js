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
    getNewChannel: (uname, que) => {
        const name = uname.toLowerCase().replace(/\s/g, '_') + '_' + que.toLowerCase().replace(/\s/g, '_');
        return new Promise(async (resolve, reject) => {
            const usersD = await db.sequelize.query(`SELECT * FROM ChatUsers where channel like 'z_${name}_%' order by channel desc;`, {
                type: db.sequelize.QueryTypes.SELECT
            });
            const channels = usersD.map(user => (user.channel));
            let len = 0;
            if (channels.length > 0) {
                const oldChannel = channels[0];
                const chs = oldChannel.split('_');
                len = Number(chs[chs.length - 1]) + 1;
            }
            const newName = 'z_' + name + '_' + (len > 0? len: (len + 1));
            resolve(newName);
        })
    }

}