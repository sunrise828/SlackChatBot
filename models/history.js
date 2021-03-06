'use strict';
module.exports = (sequelize, DataTypes) => {
  const History = sequelize.define('History', {
    text: DataTypes.STRING,
    channel: DataTypes.STRING,
    domain: DataTypes.STRING,
    sent: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    slackUser: {
      type: DataTypes.STRING
    }
  }, {});
  return History;
};