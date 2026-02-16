const { Op, Sequelize } = require("sequelize");
const { Subcategory, Category } = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");

const findSubCategoryByID = async (id) => {
  try {
    const subcategory = await Subcategory.findOne({
      where: {
        id,
      },
      include: [
        {
          model: Category,
          as: "Category",
        },
      ],
    });
    return subcategory;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addSubCategory = async (req, res) => {
  try {
    let { name, CategoryId } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: false,
        message: "Name is required",
      });
    }

    if (!CategoryId) {
      return res.status(400).json({
        status: false,
        message: "Category ID is required",
      });
    }

    // Check if category exists
    const category = await Category.findByPk(CategoryId);
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // Check if subcategory with same name already exists in this category
    const existingSubCategory = await Subcategory.findOne({
      where: {
        name,
        CategoryId,
      },
    });

    if (existingSubCategory) {
      return res.status(409).json({
        status: false,
        message: "Subcategory with this name already exists in this category",
      });
    }

    const response = await Subcategory.create({
      name,
      CategoryId,
    });

    // Fetch the created subcategory with category details
    const subcategoryWithCategory = await findSubCategoryByID(response.id);

    successResponse(res, subcategoryWithCategory);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getSubCategories = async (req, res) => {
  try {
    const { CategoryId } = req.query;

    let options = {
      where: {},
      include: [
        {
          model: Category,
          as: "Category",
        },
      ],
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
      limit: req.limit,
      offset: req.offset,
      order: [["createdAt", "DESC"]],
    };

    // Add search functionality
    if (req.keyword) {
      options.where.name = {
        [Op.iLike]: `%${req.keyword}%`,
      };
    }

    // Filter by category if provided
    if (CategoryId) {
      options.where.CategoryId = CategoryId;
    }

    const { count, rows } = await Subcategory.findAndCountAll(options);

    const response = {
      rows,
      count,
      totalPages: Math.ceil(count / req.limit),
      currentPage: req.page,
      limit: req.limit,
    };

    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Subcategory ID is required",
      });
    }

    const subcategory = await findSubCategoryByID(id);

    if (!subcategory) {
      return res.status(404).json({
        status: false,
        message: "Subcategory not found",
      });
    }

    successResponse(res, subcategory);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const editSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, CategoryId } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Subcategory ID is required",
      });
    }

    // Find existing subcategory
    const subcategory = await findSubCategoryByID(id);
    if (!subcategory) {
      return res.status(404).json({
        status: false,
        message: "Subcategory not found",
      });
    }

    // Validate category if provided
    if (CategoryId && CategoryId !== subcategory.CategoryId) {
      const category = await Category.findByPk(CategoryId);
      if (!category) {
        return res.status(404).json({
          status: false,
          message: "Category not found",
        });
      }
    }

    // Check if subcategory with same name already exists in the target category
    if (name && name !== subcategory.name) {
      const targetCategoryId = CategoryId || subcategory.CategoryId;
      const existingSubCategory = await Subcategory.findOne({
        where: {
          name: {
            [Op.iLike]: name,
          },
          CategoryId: targetCategoryId,
          id: {
            [Op.ne]: id,
          },
        },
      });

      if (existingSubCategory) {
        return res.status(409).json({
          status: false,
          message: "Subcategory with this name already exists in this category",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (CategoryId) updateData.CategoryId = CategoryId;

    // Update subcategory
    await Subcategory.update(updateData, {
      where: { id },
    });

    // Fetch updated subcategory with category details
    const updatedSubCategory = await findSubCategoryByID(id);

    successResponse(res, updatedSubCategory);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Subcategory ID is required",
      });
    }

    // Find existing subcategory
    const subcategory = await findSubCategoryByID(id);
    if (!subcategory) {
      return res.status(404).json({
        status: false,
        message: "Subcategory not found",
      });
    }

    await Subcategory.destroy({
      where: { id },
    });

    successResponse(res, {
      id,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { CategoryId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!CategoryId) {
      return res.status(400).json({
        status: false,
        message: "Category ID is required",
      });
    }

    // Check if category exists
    const category = await Category.findByPk(CategoryId);
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    let options = {
      where: {
        CategoryId,
      },
      include: [
        {
          model: Category,
          as: "Category",
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["name", "ASC"]],
    };

    // Add search functionality
    if (req.keyword) {
      options.where.name = {
        [Op.iLike]: `%${req.keyword}%`,
      };
    }

    const { count, rows } = await Subcategory.findAndCountAll(options);

    const response = {
      rows,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      limit: parseInt(limit),
      category,
    };

    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

module.exports = {
  addSubCategory,
  getSubCategories,
  getSubCategory,
  editSubCategory,
  deleteSubCategory,
  getSubCategoriesByCategory,
  findSubCategoryByID,
};
