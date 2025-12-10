const router = require("express").Router();
const { validateJWT } = require("../../utils/validateJWT");
const {
  createPOSSale,
  getPOSSales,
  getPOSSale,
  getPOSAnalytics,
  refundPOSSale,
  createPOSSession,
  closePOSSession,
  getPOSSessions,
} = require("./pos.controllers");

// Sales routes
router.post("/sales", validateJWT, createPOSSale);
router.get("/sales", validateJWT, getPOSSales);
router.get("/sales/:id", validateJWT, getPOSSale);
router.post("/sales/:id/refund", validateJWT, refundPOSSale);

// Analytics
router.get("/analytics", validateJWT, getPOSAnalytics);

// Session routes
router.post("/sessions", validateJWT, createPOSSession);
router.get("/sessions", validateJWT, getPOSSessions);
router.patch("/sessions/:id/close", validateJWT, closePOSSession);

module.exports = router;
