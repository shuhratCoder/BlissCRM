const router = require("express").Router();

const {
  Client,
  Order,
  Payment,
  Deadline,
} = require("../models");

const authMiddleware = require("../middlewares/authorization");
const asyncHandler = require("../middlewares/asyncHandler");

router.post(
  "/createClient",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: "Name va phone majburiy",
      });
    }

    const client = await Client.create({
      name,
      phone,
    });

    return res.status(201).json(client);
  })
);

router.put(
  "/updateClient/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, phone } = req.body;

    const client = await Client.findByPk(id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    await client.update({
      name,
      phone,
    });

    return res.status(200).json(client);
  })
);

router.delete(
  "/deleteClient/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const client = await Client.findByPk(id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    await client.destroy();

    return res.status(200).json({
      message: "Client deleted successfully",
    });
  })
);

router.get(
  "/getClients",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const clients = await Client.findAll({
      include: [
        {
          model: Order,
          as: "Orders",
          include: [
            {
              model: Payment,
              as: "Payments",
            },
            {
              model: Deadline,
              as: "Deadline",
            },
          ],
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    const formattedClients = clients.map((client) => {
      const json = client.toJSON();

      const orders = json.Orders || [];

      const totalOrders = orders.length;

      const totalDebt = orders.reduce(
        (sum, order) => {
          const totalAmount =
            Number(order.serviceFee || 0) +
            Number(order.productsPrice || 0);

          const paidAmount = (
            order.Payments || []
          ).reduce(
            (paymentSum, payment) =>
              paymentSum +
              Number(payment.receivedAmount || 0),
            0
          );

          return (
            sum +
            Math.max(totalAmount - paidAmount, 0)
          );
        },
        0
      );

      return {
        ...json,
        totalOrders,
        totalDebt,
      };
    });

    return res.status(200).json(
      formattedClients
    );
  })
);

module.exports = router;