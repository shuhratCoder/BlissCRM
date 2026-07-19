const router = require("express").Router();

const {
  Order,
  Product,
  Payment,
  Deadline,
  Client,
} = require("../models");

const PrinterSetting = require(
  "../models/printerSetting"
);

const {
  printReceipt,
} = require("../services/printerService");

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
          error: "Client not found",
        });
      }

      // STATUS
      if (
        !["debt", "existent"].includes(status)
      ) {
        await transaction.rollback();
        transactionFinished = true;

        return res.status(400).json({
          error: "Order status noto'g'ri",
        });
      }

      // DEBT VALIDATION
      if (status === "debt") {
        if (!deadline) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error: "Deadline majburiy",
          });
        }

        if (
          receivedAmountNumber < 0 ||
          receivedAmountNumber > totalAmount
        ) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error:
              "Received amount noto'g'ri",
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
              "Product ma'lumoti noto'g'ri",
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
              `Product with ID ${item.productId} not found`,
          });
        }

        const newAmount =
          Number(product.amount) - amount;

        if (newAmount < 0) {
          await transaction.rollback();
          transactionFinished = true;

          return res.status(400).json({
            error:
              `Not enough stock for ${product.name}`,
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

      // AUTO PRINT
      let printResult = null;

      try {
        const printerSettings =
          await PrinterSetting.findOne();

        if (printerSettings) {
          const paidAmount = (
            createdOrder.Payments || []
          ).reduce(
            (sum, payment) =>
              sum +
              Number(
                payment.receivedAmount || 0
              ),
            0
          );

          const orderTotal =
            Number(
              createdOrder.serviceFee || 0
            ) +
            Number(
              createdOrder.productsPrice || 0
            );

          const debt = Math.max(
            0,
            orderTotal - paidAmount
          );

          printResult =
            await printReceipt(
              printerSettings.toJSON(),
              {
                companyName:
                  printerSettings.companyName ||
                  "BLISS",

                companyPhone:
                  printerSettings.companyPhone || "",

                orderId:
                  createdOrder.id,

                clientName:
                  createdOrder.Client
                    ?.name || "-",

                clientPhone:
                  createdOrder.Client
                    ?.phone || "-",

                products:
                  createdOrder.products ||
                  [],

                serviceFee:
                  Number(
                    createdOrder.serviceFee ||
                      0
                  ),

                productsPrice:
                  Number(
                    createdOrder.productsPrice ||
                      0
                  ),

                paidAmount,

                debt,

                deadline:
                  createdOrder.Deadline
                    ?.deadline || null,

                date:
                  createdOrder.createdAt,
              }
            );
        }
      } catch (printError) {
        console.error(
          "AUTO PRINT ERROR:",
          printError
        );

        printResult = {
          success: false,
          message: printError.message,
        };
      }

      return res.status(201).json({
        success: true,
        order: createdOrder,
        print: printResult,
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