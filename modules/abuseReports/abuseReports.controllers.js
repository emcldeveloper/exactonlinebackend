const { AbuseReport, User, Shop, Product, Service } = require("../../models");
const { successResponse, errorResponse } = require("../../utils/responses");
const { v4: uuidv4 } = require("uuid");
const { childLogger } = require("../../utils/logger");

/**
 * @swagger
 * /abuse-reports:
 *   post:
 *     tags:
 *       - Abuse Reports
 *     summary: Submit a new abuse report
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - reportedEntityId
 *               - reason
 *               - description
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [shop, product, service, user, reel]
 *               reportedEntityId:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 enum: [spam, inappropriate_content, fraud, harassment, fake_product, misleading_info, copyright, other]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report submitted successfully
 *       400:
 *         description: Invalid request data
 */
const createAbuseReport = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { reportType, reportedEntityId, reason, description } = req.body;
    console.log("Create abuse report request body:", req.body);
    const userId = req.user.id;

    childLogger.http("Received create abuse report request", {
      requestId,
      userId,
      reportType,
      reportedEntityId,
      reason,
    });

    // Validate required fields
    if (!reportType || !reportedEntityId || !reason || !description) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields",
      });
    }

    // Get reporter info
    const reporter = await User.findByPk(userId);
    if (!reporter) {
      return res.status(404).json({
        status: false,
        message: "Reporter not found",
      });
    }

    // Get reported entity name based on type
    let reportedEntityName = null;
    try {
      switch (reportType) {
        case "shop":
          const shop = await Shop.findByPk(reportedEntityId);
          reportedEntityName = shop?.name || null;
          break;
        case "product":
          const product = await Product.findByPk(reportedEntityId);
          reportedEntityName = product?.name || null;
          break;
        case "service":
          const service = await Service.findByPk(reportedEntityId);
          reportedEntityName = service?.name || null;
          break;
        case "user":
          const user = await User.findByPk(reportedEntityId);
          reportedEntityName = user?.name || user?.fullName || null;
          break;
      }
    } catch (error) {
      console.error("Error fetching reported entity name:", error);
      childLogger.warn("Failed to fetch reported entity name", {
        requestId,
        error: error.message,
      });
    }

    // Create the abuse report
    const report = await AbuseReport.create({
      reportType,
      reportedEntityId,
      reportedEntityName,
      reason,
      description,
      reporterId: userId,
      reporterName: reporter.name || reporter.fullName,
      reporterEmail: reporter.email,
      status: "pending",
    });

    childLogger.info("Abuse report created successfully", {
      requestId,
      reportId: report.id,
    });

    successResponse(res, report, "Report submitted successfully", 201);
  } catch (error) {
    childLogger.error("Failed to create abuse report", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /abuse-reports:
 *   get:
 *     tags:
 *       - Abuse Reports
 *     summary: Get all abuse reports (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed, all]
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [shop, product, service, user, reel, all]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of abuse reports
 */
const getAbuseReports = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { status, reportType } = req.query;

    childLogger.http("Received get abuse reports request", {
      requestId,
      userId: req.user?.id,
      status,
      reportType,
      limit: req.limit,
      offset: req.offset,
    });

    // Build filter
    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    if (reportType && reportType !== "all") {
      filter.reportType = reportType;
    }

    // Fetch reports with pagination
    const reports = await AbuseReport.findAndCountAll({
      where: filter,
      limit: req.limit,
      offset: req.offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "name", "fullName", "email"],
        },
        {
          model: User,
          as: "reviewer",
          attributes: ["id", "name", "fullName"],
        },
      ],
    });

    childLogger.info("Abuse reports fetched successfully", {
      requestId,
      count: reports.count,
    });

    successResponse(res, {
      count: reports.count,
      page: req.page,
      rows: reports.rows,
    });
  } catch (error) {
    childLogger.error("Failed to fetch abuse reports", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /abuse-reports/{id}:
 *   get:
 *     tags:
 *       - Abuse Reports
 *     summary: Get a specific abuse report by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Abuse report details
 *       404:
 *         description: Report not found
 */
const getAbuseReportById = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;

    childLogger.http("Received get abuse report by ID request", {
      requestId,
      reportId: id,
    });

    const report = await AbuseReport.findByPk(id, {
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "name", "fullName", "email", "phoneNumber"],
        },
        {
          model: User,
          as: "reviewer",
          attributes: ["id", "name", "fullName"],
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        status: false,
        message: "Report not found",
      });
    }

    successResponse(res, report);
  } catch (error) {
    childLogger.error("Failed to fetch abuse report", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /abuse-reports/{id}:
 *   patch:
 *     tags:
 *       - Abuse Reports
 *     summary: Update abuse report status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, under_review, resolved, dismissed]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       404:
 *         description: Report not found
 */
const updateAbuseReport = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const userId = req.user.id;

    childLogger.http("Received update abuse report request", {
      requestId,
      reportId: id,
      status,
      userId,
    });

    const report = await AbuseReport.findByPk(id);

    if (!report) {
      return res.status(404).json({
        status: false,
        message: "Report not found",
      });
    }

    // Update fields
    const updates = {};
    if (status) {
      updates.status = status;
      updates.reviewedBy = userId;
      updates.reviewedAt = new Date();
    }
    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes;
    }

    await report.update(updates);

    childLogger.info("Abuse report updated successfully", {
      requestId,
      reportId: id,
    });

    successResponse(res, report, "Report updated successfully");
  } catch (error) {
    childLogger.error("Failed to update abuse report", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /abuse-reports/{id}:
 *   delete:
 *     tags:
 *       - Abuse Reports
 *     summary: Delete an abuse report (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 */
const deleteAbuseReport = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;

    childLogger.http("Received delete abuse report request", {
      requestId,
      reportId: id,
    });

    const report = await AbuseReport.findByPk(id);

    if (!report) {
      return res.status(404).json({
        status: false,
        message: "Report not found",
      });
    }

    await report.destroy();

    childLogger.info("Abuse report deleted successfully", {
      requestId,
      reportId: id,
    });

    successResponse(res, null, "Report deleted successfully");
  } catch (error) {
    childLogger.error("Failed to delete abuse report", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /abuse-reports/stats:
 *   get:
 *     tags:
 *       - Abuse Reports
 *     summary: Get abuse report statistics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report statistics
 */
const getAbuseReportStats = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received get abuse report stats request", {
      requestId,
    });

    const { Op } = require("sequelize");

    // Get counts by status
    const statusCounts = await AbuseReport.findAll({
      attributes: [
        "status",
        [
          require("sequelize").fn("COUNT", require("sequelize").col("id")),
          "count",
        ],
      ],
      group: ["status"],
    });

    // Get counts by report type
    const typeCounts = await AbuseReport.findAll({
      attributes: [
        "reportType",
        [
          require("sequelize").fn("COUNT", require("sequelize").col("id")),
          "count",
        ],
      ],
      group: ["reportType"],
    });

    // Get counts by reason
    const reasonCounts = await AbuseReport.findAll({
      attributes: [
        "reason",
        [
          require("sequelize").fn("COUNT", require("sequelize").col("id")),
          "count",
        ],
      ],
      group: ["reason"],
    });

    // Total reports
    const totalReports = await AbuseReport.count();

    // Recent reports (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentReports = await AbuseReport.count({
      where: {
        createdAt: {
          [Op.gte]: sevenDaysAgo,
        },
      },
    });

    const stats = {
      total: totalReports,
      recentCount: recentReports,
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = parseInt(item.dataValues.count);
        return acc;
      }, {}),
      byType: typeCounts.reduce((acc, item) => {
        acc[item.reportType] = parseInt(item.dataValues.count);
        return acc;
      }, {}),
      byReason: reasonCounts.reduce((acc, item) => {
        acc[item.reason] = parseInt(item.dataValues.count);
        return acc;
      }, {}),
    };

    successResponse(res, stats);
  } catch (error) {
    childLogger.error("Failed to fetch abuse report stats", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

module.exports = {
  createAbuseReport,
  getAbuseReports,
  getAbuseReportById,
  updateAbuseReport,
  deleteAbuseReport,
  getAbuseReportStats,
};
