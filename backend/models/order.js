const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  serviceFee: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  productsPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  products: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },

  clientId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
});

module.exports = Order;