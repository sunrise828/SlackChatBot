'use strict';
module.exports = (sequelize, DataTypes) => {
  const Queue = sequelize.define('Queue', {
    serialId: DataTypes.STRING,
    name: DataTypes.STRING,
    queId: DataTypes.INTEGER
  }, {});
  Queue.associate = function(models) {
    // associations can be defined here
  };
  return Queue;
};