const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const LocalUser = sequelize.define("LocalUser", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  ownerId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  pinHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  licenseId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  licenseStartsAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  licenseExpiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  licenseStatus: {
    type: DataTypes.ENUM(
      "active",
      "expired",
      "blocked"
    ),
    allowNull: false,
    defaultValue: "active",
  },
});

module.exports = LocalUser;