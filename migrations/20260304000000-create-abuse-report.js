"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("AbuseReports", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      reportType: {
        type: DataTypes.ENUM("shop", "product", "service", "user", "reel"),
        allowNull: false,
        comment: "Type of entity being reported",
      },
      reportedEntityId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "ID of the shop/product/service/user being reported",
      },
      reportedEntityName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Name of entity for easy reference",
      },
      reason: {
        type: DataTypes.ENUM(
          "spam",
          "inappropriate_content",
          "fraud",
          "harassment",
          "fake_product",
          "misleading_info",
          "copyright",
          "other",
        ),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "Detailed description of the issue",
      },
      reporterId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "User ID who submitted the report",
      },
      reporterName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Reporter name for reference",
      },
      reporterEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Reporter email for follow-up",
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "under_review",
          "resolved",
          "dismissed",
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      adminNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Internal notes from admin review",
      },
      reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Admin user ID who reviewed the report",
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex("AbuseReports", ["reportType"]);
    await queryInterface.addIndex("AbuseReports", ["reportedEntityId"]);
    await queryInterface.addIndex("AbuseReports", ["reporterId"]);
    await queryInterface.addIndex("AbuseReports", ["status"]);
    await queryInterface.addIndex("AbuseReports", ["createdAt"]);
  },

  async down(queryInterface, DataTypes) {
    await queryInterface.dropTable("AbuseReports");
  },
};
