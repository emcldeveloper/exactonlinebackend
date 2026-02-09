"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Shop extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Shop.hasMany(models.Reel, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.Product, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.Chat, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.ShopCalender, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasOne(models.ShopSubscription, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.ShopDocument, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.ShopView, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.ShopFollower, {
        onDelete: "CASCADE",
        scope: true,
      });
      Shop.hasMany(models.ShopUser, {
        onDelete: "CASCADE",
        scope: true,
        as: "ShopUsers",
      });
      Shop.belongsTo(models.User);
    }
  }
  Shop.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      registeredBy: {
        type: DataTypes.STRING,
        defaultValue: "Business",
      },
      shopType: {
        type: DataTypes.ENUM("products", "services", "both"),
        allowNull: false,
        defaultValue: "both",
      },
      name: {
        unique: true,
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shopLong: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      shopImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shopLat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      UserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      isApproved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Shop",
    },
  );
  return Shop;
};
