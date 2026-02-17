"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Services", "providerLinks", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Services", "providerPhones", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Services", "providerEmails", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Services", "providerDocuments", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Services", "providerAddress", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Services", "yearsOfExperience", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("Services", "certifications", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Services", "workingHours", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Services", "serviceArea", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Services", "providerLinks");
    await queryInterface.removeColumn("Services", "providerPhones");
    await queryInterface.removeColumn("Services", "providerEmails");
    await queryInterface.removeColumn("Services", "providerDocuments");
    await queryInterface.removeColumn("Services", "providerAddress");
    await queryInterface.removeColumn("Services", "yearsOfExperience");
    await queryInterface.removeColumn("Services", "certifications");
    await queryInterface.removeColumn("Services", "workingHours");
    await queryInterface.removeColumn("Services", "serviceArea");
  },
};
