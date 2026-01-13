module.exports = (sequelize, DataTypes) => {
  const ShopUser = sequelize.define(
    "ShopUser",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "suspended"),
        defaultValue: "active",
      },
      hasPOSAccess: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      hasInventoryAccess: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      invitedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "shopusers",
      timestamps: true,
    }
  );

  ShopUser.associate = (models) => {
    ShopUser.belongsTo(models.Shop, {
      foreignKey: "ShopId",
      onDelete: "CASCADE",
    });
    ShopUser.belongsTo(models.User, {
      foreignKey: "UserId",
      onDelete: "CASCADE",
    });
  };

  return ShopUser;
};
