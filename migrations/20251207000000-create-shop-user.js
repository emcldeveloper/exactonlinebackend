"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("shopusers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "active", "suspended"),
        defaultValue: "pending",
      },
      hasPOSAccess: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      hasInventoryAccess: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      invitedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      activatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ShopId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Shops",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex("shopusers", ["ShopId"]);
    await queryInterface.addIndex("shopusers", ["phone"]);
    await queryInterface.addIndex("shopusers", ["status"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("shopusers");
  },
};
