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

  // Дастур охирги марта ишлаган вақт (соатни орқага суришдан ҳимоя)
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // Admin CRM серверига захира нусха юбориш учун калит ва ҳолат
  backupToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  lastBackupAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  lastBackupHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  lastBackupError: {
    type: DataTypes.TEXT,
    allowNull: true,
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
      "blocked",
      "inactive"
    ),
    allowNull: false,
    defaultValue: "active",
  },
});

module.exports = LocalUser;