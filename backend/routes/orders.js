const router = require("express").Router();

const {
  Order,
  Product,
  Payment,
  Deadline,
  Client,
} = require("../models");

const { sendOrderSms } = require("../services/autoSms");

const authMiddleware = require(
  "../middlewares/authorization"
);

const asyncHandler = require(
  "../middlewares/asyncHandler"
);

const sequelize = require("../db");

router.post(
  "/createOrder",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const transaction =
      await sequelize.transaction();

    let transactionFinished = false;

    try {
      const {
        clientId,
        serviceFee = 0,
        productsPrice = 0,
        description,
        products = [],
        status,
        deadline,
        receivedAmount = 0,
        typeGet,
      } = req.body;
      const serviceFeeNumber =
        Number(serviceFee) || 0;

      const productsPriceNumber =
        Number(productsPrice) || 0;

      const receivedAmountNumber =
        Number(receivedAmount) || 0;

      const totalAmount =
        serviceFeeNumber +
        productsPriceNumber;

      // CLIENT
      const client = await Client.findByPk(
        clientId,
        {
          transaction,
        }
      );

      if (!client) {
        await transaction.rollback();
        transactionFinished = true;

        return res.status(404).json({
          error: "Мижоз топилмади",
        });
      }

      // STATUS
      if (
        !["debt", "existent"].includes(status)
      ) {
        await transaction.rollback();
        transactionFinished = true;

        return res.status(400).json({
          error: "Буюртма ҳолати нотўғри",
        });
      }

      // DEBT VALIDATION
      if (status === "debt") {
        if (
          receivedAmountNumber < 0 ||
          receivedAmountNumber > totalAmount
        ) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error:
              "Тўлов суммаси нотўғри",
          });
        }
      }

      // PRODUCTS
      const orderProducts = [];

      for (const item of products) {
        const amount =
          Number(item.amount);

        if (
          !item.productId ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error:
              "Маҳсулот маълумоти нотўғри",
          });
        }

        const product =
          await Product.findByPk(
            item.productId,
            {
              transaction,
            }
          );

        if (!product) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(404).json({
            error:
              `Маҳсулот топилмади (ID: ${item.productId})`,
          });
        }

        const newAmount =
          Number(product.amount) - amount;

        if (newAmount < 0) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error:
              `${product.name} омборда етарли эмас`,
          });
        }

        const price =
          Number(item.price) || 0;

        orderProducts.push({
          productId: product.id,
          name: item.name || product.name,
          amount,
          price,
          total:
            Number(item.total) ||
            amount * price,
          unit: product.unit,
        });

        await product.update(
          {
            amount: newAmount,
          },
          {
            transaction,
          }
        );
      }

      // CREATE ORDER
      const order = await Order.create(
        {
          clientId,
          serviceFee: serviceFeeNumber,
          productsPrice:
            productsPriceNumber,
          description,
          products: orderProducts,
        },
        {
          transaction,
        }
      );

      // DEBT PAYMENT
      if (status === "debt") {
        if (receivedAmountNumber > 0) {
          await Payment.create(
            {
              orderId: order.id,
              receivedAmount:
                receivedAmountNumber,
              typeGet,
              description,
            },
            {
              transaction,
            }
          );
        }

        // Муддат ихтиёрий: белгиланмаган бўлса, ёзув яратилмайди
        if (deadline) {
          await Deadline.create(
            {
              orderId: order.id,
              deadline,
              description,
            },
            {
              transaction,
            }
          );
        }
      }

      // FULL PAYMENT
      if (status === "existent") {
        await Payment.create(
          {
            orderId: order.id,
            receivedAmount: totalAmount,
            typeGet,
            description,
          },
          {
            transaction,
          }
        );
      }

      await transaction.commit();

      transactionFinished = true;

      // GET CREATED ORDER
      const createdOrder =
        await Order.findByPk(order.id, {
          include: [
            {
              model: Client,
              as: "Client",
            },
            {
              model: Payment,
              as: "Payments",
            },
            {
              model: Deadline,
              as: "Deadline",
            },
          ],
        });

      // Қарзли буюртма бўлса ва созламаларда ёқилган бўлса, мижозга СМС.
      // СМС хатоси буюртмага таъсир қилмайди.
      const sms = await sendOrderSms(order.id);

      return res.status(201).json({
        success: true,
        order: createdOrder,
        sms,
      });
    } catch (error) {
      if (!transactionFinished) {
        await transaction.rollback();
      }

      console.error(
        "CREATE ORDER ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }
  })
);

router.get(
  "/getOrders",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const orders = await Order.findAll({
      include: [
        {
          model: Client,
          as: "Client",
        },
        {
          model: Payment,
          as: "Payments",
        },
        {
          model: Deadline,
          as: "Deadline",
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(orders);
  })
);

module.exports = router;