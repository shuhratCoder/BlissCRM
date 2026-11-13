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

    // СМС юбориш усули: "eskiz" ёки "android" (SMSGate, ўз SIM-карта)
    provider: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "eskiz",
    },

    androidUrl: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },

    androidLogin: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },

    androidPassword: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },

    // Қарзли буюртма яратилганда мижозга дарҳол СМС
    orderSmsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    orderSmsTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },

    // Қарздорларга ҳар reminderDays кунда эслатма
    reminderEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    reminderDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
    },

    reminderStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    smsTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue:
        "Ассалому алайкум, {name}! Сизнинг қарзингиз: {duty} сўм.",
    },
  },
  {
    tableName: "sms_settings",
    timestamps: true,
  }
);

module.exports = SmsSetting;