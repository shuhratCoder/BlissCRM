const router = require("express").Router();
const { Product } = require("../models");
const authMiddleware = require("../middlewares/authorization");
const asyncHandler = require("../middlewares/asyncHandler");
const sequelize = require("../db");

// 1. MAHSULOT YARATISH (POST /crm/createProduct)
router.post(
  "/createProduct",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const {
      name,
      amount = 0,
      unit,
      type = "whole",
      description,
      priceGet,
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: "Name va unit majburiy",
      });
    }

    const product = await Product.create({
      name,
      amount: Number(amount),
      unit,
      type,
      description,
      priceGet: priceGet !== undefined && priceGet !== "" && priceGet !== null ? Number(priceGet) : null,
    });

    return res.status(201).json(product);
  })
);

// 2. MAHSULOT XARIDI / OMBORNI TO'LDIRISH (POST /crm/addProducts)
router.post(
  "/addProducts",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      let productsInput = req.body.products || req.body;

      // Agar massiv bo'lmasa, uni massiv ko'rinishiga keltiramiz
      if (!Array.isArray(productsInput)) {
        if (productsInput && productsInput.productId) {
          productsInput = [productsInput];
        } else if (req.body && req.body.productId) {
          productsInput = [req.body];
        } else {
          productsInput = [];
        }
      }

      if (productsInput.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Products topilmadi",
        });
      }

      const updatedProducts = [];

      for (const item of productsInput) {
        const amount = Number(item.amount);

        if (!item.productId || !Number.isFinite(amount) || amount <= 0) {
          await transaction.rollback();
          return res.status(400).json({
            error: "Product id yoki miqdori noto'g'ri",
          });
        }

        const product = await Product.findByPk(item.productId, { transaction });

        if (!product) {
          await transaction.rollback();
          return res.status(404).json({
            error: "Product not found",
          });
        }

        await product.update(
          {
            amount: Number(product.amount) + amount,
          },
          { transaction }
        );

        updatedProducts.push(product);
      }

      await transaction.commit();

      return res.status(200).json({
        message: "Products added successfully",
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

// 3. MAHSULOTNI TAHRIRLASH (PUT /crm/updateProduct/:id)
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
      priceGet,
    } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    await product.update({
      name,
      amount: amount !== undefined ? Number(amount) : product.amount,
      unit,
      type: type || product.type || "whole",
      description,
      priceGet: priceGet !== undefined && priceGet !== "" && priceGet !== null ? Number(priceGet) : product.priceGet,
    });

    return res.status(200).json(product);
  })
);

// 4. 💡 MAHSULOTNI O'CHIRISH (DELETE /crm/deleteProduct/:id VA ZAXIRA REJIMDA /crm/:id)
// Frontend so'rovi qaysi biri bilan kelsa ham xatosiz ushlab qoladigan qilib birlashtirildi
const deleteHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findByPk(id);

  if (!product) {
    return res.status(404).json({
      error: "Product not found",
    });
  }

  await product.destroy();

  return res.status(200).json({
    message: "Product deleted successfully",
  });
});

router.delete("/deleteProduct/:id", authMiddleware, deleteHandler);
router.delete("/:id", authMiddleware, deleteHandler); // 💡 Zaxira yo'l (Frontend /crm/ID ko'rinishida yuborsa)

// 5. MAHSULOTLAR RO'YXATINI OLISH (GET /crm/getProducts)
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
