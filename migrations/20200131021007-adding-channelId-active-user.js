'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn('ChatUsers', 'channelId', {
          type: Sequelize.STRING
        }, { transaction: t }),
        queryInterface.addColumn('ChatUsers', 'active', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }, { transaction: t })
      ])
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn('Users', 'channelId', { transaction: t }),
        queryInterface.removeColumn('Users', 'active', { transaction: t })
      ])
    })
  }
};
