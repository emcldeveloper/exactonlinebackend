const { Op, Sequelize } = require("sequelize");
const {
  Category,
  CategoryProductSpecification,
  Product,
  Subcategory,
  CategorySettings,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");
const { invalidateCategoryCaches } = require("../../utils/cache");

const findCategoryByID = async (id) => {
  try {
    const category = await Category.findOne({
      where: {
        id,
      },
    });
    return category;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addCategory = async (req, res) => {
  try {
    let { name, type } = req.body;
    const image = await getUrl(req);
    const response = await Category.create({
      name,
      type,
      image,
    });

    // Invalidate relevant caches
    await invalidateCategoryCaches(response.id, type);

    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getCategories = async (req, res) => {
  try {
    const { type } = req.query;
    let options = {
      name: {
        [Op.like]: `%${req.keyword}%`,
      },
    };
    if (type) {
      options.type = type == "null" ? "product" : type;
    }

    const response = await Category.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: options,
      include: [
        {
          model: CategoryProductSpecification,
          // Ordering will be handled via top-level order clause
        },
        {
          model: Subcategory,
          attributes: {
            include: [
              [
                Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Products"
            WHERE "Products"."SubcategoryId" = "Subcategory"."id"
          )`),
                "productsCount",
              ],
            ],
          },
          separate: true,
          order: [
            [
              Sequelize.literal(`(
                SELECT COUNT(*)
                FROM "Products"
                WHERE "Products"."SubcategoryId" = "Subcategory"."id"
              )`),
              "DESC",
            ],
            ["createdAt", "DESC"],
          ],
        },
        {
          model: CategorySettings,
          as: "settings",
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Products"
            WHERE "Products"."CategoryId" = "Category"."id"
          )`),
            "productsCount",
          ],
        ],
      },
      order: [
        // Order category product specifications from lowest 'order' value (0 upwards)
        [CategoryProductSpecification, "order", "ASC"],
        [
          Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "Products"
            WHERE "Products"."CategoryId" = "Category"."id"
          )`),
          "DESC",
        ],
        ["createdAt", "DESC"],
      ],
    });

    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    errorResponse(res, error);
  }
};
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({
      where: { id },
      include: [
        {
          model: CategorySettings,
          as: "settings",
          required: false,
        },
      ],
    });
    successResponse(res, category);
  } catch (error) {
    errorResponse(res, error);
  }
};
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await findCategoryByID(id);

    // Store values before update for cache invalidation
    const categoryType = category.type;

    const image = await getUrl(req);
    console.log(req.body);
    console.log(image);
    if (image != null) {
      req.body.image = image;
    }
    const response = await category.update({
      ...req.body,
    });

    // Invalidate relevant caches
    await invalidateCategoryCaches(id, categoryType);

    console.log(req.body);
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await findCategoryByID(id);

    // Store values before deletion for cache invalidation
    const categoryType = category.type;

    const response = await category.destroy();

    // Invalidate relevant caches
    await invalidateCategoryCaches(id, categoryType);

    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
module.exports = {
  findCategoryByID,
  getCategories,
  addCategory,
  deleteCategory,
  addCategory,
  getCategory,
  updateCategory,
};
