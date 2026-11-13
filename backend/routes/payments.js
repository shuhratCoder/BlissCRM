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
            "Тўлов суммаси 0 дан катта бўлиши керак",
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
          error: "Буюртма топилмади",
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
          error: "Буюртма тўлиқ тўланган",
        });
      }

      if (amount > debt) {
        await transaction.rollback();

        return res.status(400).json({
          error: `Қарз миқдори ${debt}. Ортиқча тўлов мумкин эмас`,
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

// ============================================================
// БИР НЕЧТА БУЮРТМА ҚАРЗИНИ БИРГА ТЎЛАШ
// Сумма мижознинг қарзли буюртмаларига энг эскисидан бошлаб
// тақсимланади; умумий қарздан кам бўлса, охиргиси қисман тўланади.
// ============================================================

router.post(
  "/rePaymentBulk",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const transaction =
      await sequelize.transaction();

    try {
      const {
        clientId,
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
            "Тўлов суммаси 0 дан катта бўлиши керак",
        });
      }

      if (!clientId) {
        await transaction.rollback();

        return res.status(400).json({
          error: "Мижоз танланмаган",
        });
      }

      const orders = await Order.findAll({
        where: { clientId },
        include: [
          {
            model: Payment,
            as: "Payments",
          },
        ],
        order: [["createdAt", "ASC"]],
        transaction,
      });

      const debts = orders
        .map((order) => {
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

          return {
            orderId: order.id,
            debt: Math.max(
              totalAmount - paidAmount,
              0
            ),
          };
        })
        .filter((item) => item.debt > 0);

      const totalDebt = debts.reduce(
        (sum, item) => sum + item.debt,
        0
      );

      if (totalDebt <= 0) {
        await transaction.rollback();

        return res.status(400).json({
          error: "Мижознинг қарзи йўқ",
        });
      }

      if (amount > totalDebt) {
        await transaction.rollback();

        return res.status(400).json({
          error: `Умумий қарз ${totalDebt}. Ортиқча тўлов мумкин эмас`,
        });
      }

      let remaining = amount;

      const allocations = [];

      for (const item of debts) {
        if (remaining <= 0) {
          break;
        }

        const part = Math.min(
          item.debt,
          remaining
        );

        await Payment.create(
          {
            orderId: item.orderId,
            receivedAmount: part,
            description,
            typeGet,
          },
          {
            transaction,
          }
        );

        allocations.push({
          orderId: item.orderId,
          amount: part,
        });

        remaining -= part;
      }

      await transaction.commit();

      return res.status(201).json({
        success: true,
        paid: amount,
        remainingDebt: totalDebt - amount,
        allocations,
      });
    } catch (error) {
      await transaction.rollback();

      return res.status(500).json({
        error: error.message,
      });
    }
  })
);

module.exports = router;