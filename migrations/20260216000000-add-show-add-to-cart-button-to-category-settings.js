"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CategorySettings", "showAddToCartButton", {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: "Show add to cart button for products in this category",
      after: "showIsNegotiable",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "CategorySettings",
      "showAddToCartButton",
    );
  },
};
