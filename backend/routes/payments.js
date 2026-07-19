const router = require("express").Router();

const {
  Order,
  Payment,
} = require("../models");

const authMiddleware = require("../middlewares/authorization");
const asyncHandler = require("../middlewares/asyncHandler");
const sequelize = require("../db");

router.post(
  "/rePayment",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const transaction =
      await sequelize.transaction();

    try {
      const {
        orderId,
        receivedAmount,
        description,
        typeGet,
      } = req.body;

      const amount = Number(receivedAmount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        await transaction.rollback();

        return res.status(400).json({
          error:
            "Received amount 0 dan katta bo'lishi kerak",
        });
      }

      const order = await Order.findByPk(
        orderId,
        {
          include: [
            {
              model: Payment,
              as: "Payments",
            },
          ],
          transaction,
        }
      );

      if (!order) {
        await transaction.rollback();

        return res.status(404).json({
          error: "Order not found",
        });
      }

      const totalAmount =
        Number(order.serviceFee || 0) +
        Number(order.productsPrice || 0);

      const paidAmount = (
        order.Payments || []
      ).reduce(
        (sum, payment) =>
          sum +
          Number(payment.receivedAmount || 0),
        0
      );

      const debt = Math.max(
        totalAmount - paidAmount,
        0
      );

      if (debt <= 0) {
        await transaction.rollback();

        return res.status(400).json({
          error: "Order to'liq to'langan",
        });
      }

      if (amount > debt) {
        await transaction.rollback();

        return res.status(400).json({
          error: `Qarz miqdori ${debt}. Ortiqcha to'lov mumkin emas`,
        });
      }

      const payment = await Payment.create(
        {
          orderId,
          receivedAmount: amount,
          description,
          typeGet,
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      return res.status(201).json(payment);
    } catch (error) {
      await transaction.rollback();

      return res.status(500).json({
        error: error.message,
      });
    }
  })
);

module.exports = router;