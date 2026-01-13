"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if UserId column exists, if not add it
    const tableDescription = await queryInterface.describeTable("shopusers");

    if (!tableDescription.UserId) {
      await queryInterface.addColumn("shopusers", "UserId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    // Remove name, phone, email columns if they exist
    if (tableDescription.name) {
      await queryInterface.removeColumn("shopusers", "name");
    }
    if (tableDescription.phone) {
      await queryInterface.removeColumn("shopusers", "phone");
    }
    if (tableDescription.email) {
      await queryInterface.removeColumn("shopusers", "email");
    }

    // Change default status to 'active'
    await queryInterface.changeColumn("shopusers", "status", {
      type: Sequelize.ENUM("pending", "active", "suspended"),
      defaultValue: "active",
    });
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable("shopusers");

    // Add back name, phone, email columns
    if (!tableDescription.name) {
      await queryInterface.addColumn("shopusers", "name", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      });
    }
    if (!tableDescription.phone) {
      await queryInterface.addColumn("shopusers", "phone", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "",
      });
    }
    if (!tableDescription.email) {
      await queryInterface.addColumn("shopusers", "email", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Remove UserId column if it exists
    if (tableDescription.UserId) {
      await queryInterface.removeColumn("shopusers", "UserId");
    }

    // Change default status back to 'pending'
    await queryInterface.changeColumn("shopusers", "status", {
      type: Sequelize.ENUM("pending", "active", "suspended"),
      defaultValue: "pending",
    });
  },
};
