"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "CategorySettings",
      "showProductONInventory",
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Show product on inventory",
        after: "showAddToCartButton",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "CategorySettings",
      "showProductONInventory",
    );
  },
};
