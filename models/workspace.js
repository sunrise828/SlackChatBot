'use strict';
module.exports = (sequelize, DataTypes) => {
  const Workspace = sequelize.define('Workspace', {
    accessToken: DataTypes.STRING,
    userId: DataTypes.STRING,
    teamName: DataTypes.STRING,
    incomeChannelName: DataTypes.STRING,
    incomeChannelId: DataTypes.STRING,
    botUserId: DataTypes.STRING,
    botAccessToken: DataTypes.STRING,
    serialId: DataTypes.STRING,
    status: DataTypes.INTEGER
  }, {});
  Workspace.associate = function(models) {
    // associations can be defined here
  };
  return Workspace;
};