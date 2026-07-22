const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Product = sequelize.define("Product", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  unit: {
    // 💡 Yangi "blok" va "pachka" birliklari ENUM ro'yxatiga muvaffaqiyatli qo'shildi
    type: DataTypes.ENUM(
      "dona",
      "kg",
      "m",
      "m2",
      "litr",
      "blok",
      "pachka"
    ),
    allowNull: false,
  },

  type: {
    type: DataTypes.ENUM(
      "whole",
      "piece"
    ),
    allowNull: false,
    defaultValue: "whole",
  },

  // 💡 YANGI USTUN: Ixtiyoriy mahsulot narxi (so'mda)
   priceGet: {
    type: DataTypes.DECIMAL(12, 2), 
    allowNull: true,
    defaultValue: null
  },

  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Product;
