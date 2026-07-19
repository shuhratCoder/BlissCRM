const jwt = require("jsonwebtoken");

require("dotenv").config();

function authMiddleware(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_NOT_FOUND",
        message: "Token topilmadi",
      });
    }

    const [type, token] =
      authHeader.split(" ");

    if (
      type !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN_FORMAT",
        message:
          "Token formati noto'g'ri",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET topilmadi"
      );

      return res.status(500).json({
        success: false,
        code: "JWT_SECRET_NOT_FOUND",
        message:
          "Server konfiguratsiyasi noto'g'ri",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      decoded.type !==
      "local-session"
    ) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION_TYPE",
        message:
          "Desktop session token noto'g'ri",
      });
    }

    if (!decoded.localUserId) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Session ma'lumotlari noto'g'ri",
      });
    }

    req.user = {
      id: decoded.localUserId,
      ownerId: decoded.ownerId,
      username: decoded.username,
      companyName:
        decoded.companyName,
    };

    return next();
  } catch (error) {
    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message:
          "Session muddati tugagan",
      });
    }

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Token noto'g'ri",
      });
    }

    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "AUTH_ERROR",
      message:
        "Authorization xatosi",
    });
  }
}

module.exports = authMiddleware;