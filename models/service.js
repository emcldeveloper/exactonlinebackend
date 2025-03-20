"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Service.belongsTo(models.Shop);
      Service.belongsTo(models.Category);
      Service.hasMany(models.ServiceImage, {
        onDelete: "CASCADE",
        scope: true,
      });
    }
  }
  Service.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      CategoryId: {
        allowNull: false,
        type: DataTypes.UUID,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      serviceLink: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isHidden: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      ShopId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Service",
    }
  );
  return Service;
};
