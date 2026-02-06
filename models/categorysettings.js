"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CategorySettings extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CategorySettings.belongsTo(models.Category, {
        foreignKey: "categoryId",
        as: "category",
      });
    }
  }

  CategorySettings.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "Categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      categoryProductLabel: {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          'Custom label for products in this category (e.g., "Item", "Product", "Service")',
      },
      showProductLinks: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Show option to include product links",
      },
      showPriceIncludesDelivery: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Show price includes delivery options",
      },
      showHideProductOption: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Show option to hide this product",
      },
      showIsNegotiable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Show negotiable price option",
      },
      priceTimeLimit: {
        type: DataTypes.ENUM("no_limit", "one_month", "six_months", "one_year"),
        defaultValue: "no_limit",
        comment: "Default price time limit for products in this category",
      },
    },
    {
      sequelize,
      modelName: "CategorySettings",
    },
  );

  return CategorySettings;
};
