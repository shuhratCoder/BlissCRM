const Client = require("./client");
const Order = require("./order");
const Payment = require("./payment");
const Deadline = require("./deadline");
const Product = require("./product");
const LocalUser = require("./localUser");

// ============================================================
// CLIENT ↔ ORDER
// ============================================================

Client.hasMany(Order, {
  foreignKey: "clientId",
  as: "Orders",
  onDelete: "CASCADE",
});

Order.belongsTo(Client, {
  foreignKey: "clientId",
  as: "Client",
});

// ============================================================
// ORDER ↔ PAYMENT
// ============================================================

Order.hasMany(Payment, {
  foreignKey: "orderId",
  as: "Payments",
  onDelete: "CASCADE",
});

Payment.belongsTo(Order, {
  foreignKey: "orderId",
  as: "Order",
});

// ============================================================
// ORDER ↔ DEADLINE
// ============================================================

Order.hasOne(Deadline, {
  foreignKey: "orderId",
  as: "Deadline",
  onDelete: "CASCADE",
});

Deadline.belongsTo(Order, {
  foreignKey: "orderId",
  as: "Order",
});

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  Client,
  Order,
  Payment,
  Deadline,
  Product,
  LocalUser,
};