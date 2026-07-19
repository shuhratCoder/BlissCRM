const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const PrinterSetting = sequelize.define(
  "PrinterSetting",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "BLISS MEBEL",
    },

    companyPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    connectionType: {
      type: DataTypes.ENUM(
        "mock",
        "lan",
        "usb"
      ),
      allowNull: false,
      defaultValue: "mock",
    },

    printerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 9100,
    },

    paperWidth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 80,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = PrinterSetting;