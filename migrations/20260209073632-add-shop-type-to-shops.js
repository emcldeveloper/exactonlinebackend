"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Shops", "shopType", {
      type: Sequelize.ENUM("products", "services", "both"),
      allowNull: false,
      defaultValue: "both",
      after: "registeredBy",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Shops", "shopType");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Shops_shopType";',
    );
  },
};
