const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Client = sequelize.define("Client", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Мижозга охирги автоматик СМС юборилган вақт (эслатма даври шундан саналади)
  lastSmsAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = Client;