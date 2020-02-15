'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('ChatUser', {
    channel: DataTypes.STRING,
    email: DataTypes.STRING,
    name: DataTypes.STRING,
    sessionId: DataTypes.STRING,
    workspaceId: DataTypes.STRING,
    channelId: DataTypes.STRING,
    active: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    joined: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    slackId: DataTypes.STRING,
    ticketId: DataTypes.STRING,
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '0: opening, 1: finished'
    },
    webPage: {
      type: DataTypes.STRING
    }
  }, {});
  User.associate = function(models) {
    // associations can be defined here
  };
  return User;
};