const router = require("express").Router();

const {
  Product,
} = require("../models");

const authMiddleware = require("../middlewares/authorization");
const asyncHandler = require("../middlewares/asyncHandler");
const sequelize = require("../db");

router.post(
  "/createProduct",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const {
      name,
      amount = 0,
      unit,
      type,
      description,
    } = req.body;

    if (!name || !unit || !type) {
      return res.status(400).json({
        error:
          "Name, unit va type majburiy",
      });
    }

    const product = await Product.create({
      name,
      amount: Number(amount),
      unit,
      type,
      description,
    });

    return res.status(201).json(product);
  })
);

router.post(
  "/addProducts",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const transaction =
      await sequelize.transaction();

    try {
      const { products } = req.body;

      if (
        !Array.isArray(products) ||
        products.length === 0
      ) {
        await transaction.rollback();

        return res.status(400).json({
          error: "Products topilmadi",
        });
      }

      const updatedProducts = [];

      for (const item of products) {
        const amount = Number(item.amount);

        if (
          !item.productId ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          await transaction.rollback();

          return res.status(400).json({
            error:
              "Product amount noto'g'ri",
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

          return res.status(404).json({
            error: "Product not found",
          });
        }

        await product.update(
          {
            amount:
              Number(product.amount) +
              amount,
          },
          {
            transaction,
          }
        );

        updatedProducts.push(product);
      }

      await transaction.commit();

      return res.status(200).json({
        message:
          "Products added successfully",
        products: updatedProducts,
      });
    } catch (error) {
      await transaction.rollback();

      return res.status(500).json({
        error: error.message,
      });
    }
  })
);

router.put(
  "/updateProduct/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const {
      name,
      amount,
      unit,
      type,
      description,
    } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    await product.update({
      name,
      amount:
        amount !== undefined
          ? Number(amount)
          : product.amount,
      unit,
      type,
      description,
    });

    return res.status(200).json(product);
  })
);

router.delete(
  "/deleteProduct/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    await product.destroy();

    return res.status(200).json({
      message:
        "Product deleted successfully",
    });
  })
);

router.get(
  "/getProducts",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const products = await Product.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(products);
  })
);

module.exports = router;