"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CategorySettings", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      categoryId: {
        type: Sequelize.UUID,
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
        type: Sequelize.STRING,
        allowNull: true,
        comment:
          'Custom label for products in this category (e.g., "Item", "Product", "Service")',
      },
      showProductLinks: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Show option to include product links",
      },
      showPriceIncludesDelivery: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Show price includes delivery options",
      },
      showHideProductOption: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Show option to hide this product",
      },
      showIsNegotiable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Show negotiable price option",
      },
      priceTimeLimit: {
        type: Sequelize.ENUM("no_limit", "one_month", "six_months", "one_year"),
        defaultValue: "no_limit",
        comment: "Default price time limit for products in this category",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CategorySettings");
  },
};
