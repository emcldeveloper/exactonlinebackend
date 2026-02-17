const { CategorySettings, Category } = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");

const findCategorySettingsByCategoryID = async (categoryId) => {
  try {
    const settings = await CategorySettings.findOne({
      where: {
        categoryId,
      },
      include: [
        {
          model: Category,
          as: "category",
        },
      ],
    });
    return settings;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCategorySettings = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const settings = await findCategorySettingsByCategoryID(categoryId);

    if (!settings) {
      return errorResponse(
        res,
        { message: "Category settings not found" },
        404,
      );
    }

    successResponse(res, settings);
  } catch (error) {
    errorResponse(res, error);
  }
};

const createOrUpdateCategorySettings = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Log the incoming request body to track what's being received
    console.log("====================================");
    console.log("Category Settings Update Request:");
    console.log("Category ID:", categoryId);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("====================================");
    
    const {
      categoryProductLabel,
      showProductLinks,
      showPriceIncludesDelivery,
      showHideProductOption,
      showIsNegotiable,
      showAddToCartButton,
      priceTimeLimit,
    } = req.body;

    // Check if category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return errorResponse(res, { message: "Category not found" }, 404);
    }

    // Check if settings already exist
    let settings = await CategorySettings.findOne({
      where: { categoryId },
    });

    const settingsData = {
      categoryProductLabel,
      showProductLinks,
      showPriceIncludesDelivery,
      showHideProductOption,
      showIsNegotiable,
      showAddToCartButton,
      priceTimeLimit,
    };

    console.log("Settings data to save:", JSON.stringify(settingsData, null, 2));

    if (settings) {
      // Update existing settings
      await settings.update(settingsData);
      console.log("Settings updated successfully");
    } else {
      // Create new settings
      settings = await CategorySettings.create({
        categoryId,
        ...settingsData,
      });
      console.log("Settings created successfully");
    }

    const response = await CategorySettings.findOne({
      where: { categoryId },
      include: [
        {
          model: Category,
          as: "category",
        },
      ],
    });

    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const deleteCategorySettings = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const settings = await findCategorySettingsByCategoryID(categoryId);

    if (!settings) {
      return errorResponse(
        res,
        { message: "Category settings not found" },
        404,
      );
    }

    await settings.destroy();
    successResponse(res, { message: "Category settings deleted successfully" });
  } catch (error) {
    errorResponse(res, error);
  }
};

const getAllCategorySettings = async (req, res) => {
  try {
    const settings = await CategorySettings.findAll({
      include: [
        {
          model: Category,
          as: "category",
        },
      ],
      limit: req.limit,
      offset: req.offset,
    });

    successResponse(res, {
      count: settings.length,
      page: req.page,
      rows: settings,
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  getCategorySettings,
  createOrUpdateCategorySettings,
  deleteCategorySettings,
  getAllCategorySettings,
  findCategorySettingsByCategoryID,
};
