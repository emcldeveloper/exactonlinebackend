module.exports = (sequelize, DataTypes) => {
  const ShopUser = sequelize.define(
    "ShopUser",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "suspended"),
        defaultValue: "pending",
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
  };

  return ShopUser;
};
