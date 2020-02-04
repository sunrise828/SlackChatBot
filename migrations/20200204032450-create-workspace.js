'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Workspaces', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      accessToken: {
        type: Sequelize.STRING,
        allowNull: false
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      teamName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      incomeChannelName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      incomeChannelId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      botUserId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      botAccessToken: {
        type: Sequelize.STRING,
        allowNull: false
      },
      serialId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Workspaces');
  }
};