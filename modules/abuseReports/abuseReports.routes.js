const { Router } = require("express");
const { validateJWT } = require("../../utils/validateJWT");
const { getPagination } = require("../../utils/getPagination");
const {
  createAbuseReport,
  getAbuseReports,
  getAbuseReportById,
  updateAbuseReport,
  deleteAbuseReport,
  getAbuseReportStats,
} = require("./abuseReports.controllers");

const router = Router();

// Public/User routes (requires authentication)
router.post("/", validateJWT, createAbuseReport);

// Admin routes (requires authentication)
router.get("/", validateJWT, getPagination, getAbuseReports);
router.get("/stats", validateJWT, getAbuseReportStats);
router.get("/:id", validateJWT, getAbuseReportById);
router.patch("/:id", validateJWT, updateAbuseReport);
router.delete("/:id", validateJWT, deleteAbuseReport);

module.exports = router;
