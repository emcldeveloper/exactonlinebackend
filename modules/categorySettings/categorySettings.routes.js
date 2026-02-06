const { Router } = require("express");
const { validateJWT } = require("../../utils/validateJWT");
const {
  getCategorySettings,
  createOrUpdateCategorySettings,
  deleteCategorySettings,
  getAllCategorySettings,
} = require("./categorySettings.controllers");
const { getPagination } = require("../../utils/getPagination");

const router = Router();

// Get all category settings
router.get("/", validateJWT, getPagination, getAllCategorySettings);

// Get settings for a specific category
router.get("/:categoryId", getCategorySettings);

// Create or update settings for a specific category
router.post("/:categoryId", validateJWT, createOrUpdateCategorySettings);
router.put("/:categoryId", validateJWT, createOrUpdateCategorySettings);

// Delete settings for a specific category
router.delete("/:categoryId", validateJWT, deleteCategorySettings);

module.exports = router;
