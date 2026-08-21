const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const SmsSetting = sequelize.define(
  "SmsSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
    },

    eskizLogin: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },

    eskizPassword: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },

    smsTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue:
        "Assalomu alaykum, {name}! Sizning qarzingiz: {duty} so'm.",
    },
  },
  {
    tableName: "sms_settings",
    timestamps: true,
  }
);

module.exports = SmsSetting;