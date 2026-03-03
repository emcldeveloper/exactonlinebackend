"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AbuseReport extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Reporter association
      AbuseReport.belongsTo(models.User, {
        foreignKey: "reporterId",
        as: "reporter",
      });

      // Reviewer association (admin)
      AbuseReport.belongsTo(models.User, {
        foreignKey: "reviewedBy",
        as: "reviewer",
      });
    }
  }
  AbuseReport.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      reportType: {
        type: DataTypes.ENUM("shop", "product", "service", "user", "reel"),
        allowNull: false,
      },
      reportedEntityId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reportedEntityName: {
        type: DataTypes.STRING,
        allowNull: true,
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
      },
      reporterId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reporterName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reporterEmail: {
        type: DataTypes.STRING,
        allowNull: true,
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
      },
      reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "AbuseReport",
    },
  );
  return AbuseReport;
};
