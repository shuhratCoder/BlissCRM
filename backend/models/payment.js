const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Payment = sequelize.define("Payment", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  receivedAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  typeGet: {
    type: DataTypes.ENUM(
      "cash",
      "card",
      "transfer"
    ),
    allowNull: false,
  },

  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Payment;