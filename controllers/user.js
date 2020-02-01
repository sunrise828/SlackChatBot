const User = require('../models').ChatUser;
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
    }
}