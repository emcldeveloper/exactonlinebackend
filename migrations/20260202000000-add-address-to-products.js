"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn("Products", "address", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, DataTypes) {
    await queryInterface.removeColumn("Products", "address");
  },
};
