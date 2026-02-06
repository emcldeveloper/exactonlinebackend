"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Category.hasMany(models.ProductCategory);
      Category.hasMany(models.CategoryProductSpecification);
      Category.hasMany(models.Subcategory);
      Category.hasMany(models.Product);
      Category.hasOne(models.CategorySettings, {
        foreignKey: "categoryId",
        as: "settings",
      });
    }
  }
  Category.init(
    {
      id: {
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("product", "service"),
        defaultValue: "product",
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Category",
    },
  );
  return Category;
};
