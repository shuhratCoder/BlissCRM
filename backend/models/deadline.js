const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Deadline = sequelize.define("Deadline", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },

  deadline: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Deadline;