const { Op, Sequelize } = require("sequelize");
const {
  Product,
  ProductImage,
  ProductStat,
  OrderedProduct,
  CartProduct,
  ShopFollower,
  ProductReview,
  Favorite,
  User,
  Order,
  Shop,
  CategoryProductSpecification,
  InventorySettings,
  InventoryTransaction,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");
const moment = require("moment");
const logger = require("../../utils/logger");
const { v4: uuidv4 } = require("uuid"); // For requestId
const { invalidateProductCaches } = require("../../utils/cache");

const childLogger = logger.child({ module: "Products Module" });

// Helper function to add specification filters to query
const addSpecificationFilters = (filter, query) => {
  const specificationFilters = {};
  Object.keys(query).forEach((key) => {
    if (key.startsWith("spec_")) {
      const specLabel = key.substring(5).replace(/_/g, " "); // Remove 'spec_' prefix and convert underscores to spaces
      const specValue = query[key];
      if (specValue && specValue.toLowerCase() !== "all") {
        specificationFilters[specLabel] = specValue;
      }
    }
  });

  // Add JSON-based specification filters to the where clause
  Object.keys(specificationFilters).forEach((specLabel) => {
    const specValue = specificationFilters[specLabel];
    // Use PostgreSQL JSON operators for filtering
    if (specValue === "true" || specValue === "false") {
      // Boolean values
      filter[Op.and] = filter[Op.and] || [];
      filter[Op.and].push(
        Sequelize.where(
          Sequelize.fn(
            "CAST",
            Sequelize.literal(`"specifications"->>'${specLabel}' AS BOOLEAN`)
          ),
          specValue === "true"
        )
      );
    } else if (!isNaN(specValue) && specValue !== "") {
      // Numeric values
      filter[Op.and] = filter[Op.and] || [];
      filter[Op.and].push(
        Sequelize.where(
          Sequelize.fn(
            "CAST",
            Sequelize.literal(`"specifications"->>'${specLabel}'`),
            "FLOAT"
          ),
          parseFloat(specValue)
        )
      );
    } else {
      // String values - use case-insensitive search
      filter[Op.and] = filter[Op.and] || [];
      filter[Op.and].push(
        Sequelize.where(
          Sequelize.fn(
            "LOWER",
            Sequelize.literal(`"specifications"->>'${specLabel}'`)
          ),
          "LIKE",
          `%${specValue.toLowerCase()}%`
        )
      );
    }
  });

  return filter;
};

const findProductByID = async (id) => {
  const requestId = uuidv4();
  try {
    childLogger.info("Finding product by ID", { requestId, productId: id });
    const product = await Product.findOne({
      where: { id },
      include: [
        ProductImage,
        ProductStat,
        { model: ProductReview, include: [User] },
        Shop,
      ],
    });
    if (!product) {
      childLogger.warn("Product not found", { requestId, productId: id });
    } else {
      childLogger.info("Product found", { requestId, productId: id });
    }
    return product;
  } catch (error) {
    childLogger.error("Failed to find product", {
      requestId,
      productId: id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Add a new product
 *     tags:
 *       - Products
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewProduct'
 *     responses:
 *       200:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       500:
 *         description: Failed to create product
 */
const addProduct = async (req, res) => {
  const requestId = uuidv4();
  try {
    const {
      name,
      sellingPrice,
      productPrice,
      buyingPrice,
      priceIncludeDelivery,
      deliveryScope,
      productLink,
      isHidden,
      isNegotiable,
      specifications,
      description,
      CategoryId,
      SubcategoryId,
      ShopId,
      // Inventory fields
      productQuantity,
      initialStock,
      trackInventory,
      lowStockAlert,
      reorderLevel,
      maxStockLevel,
      allowBackorder,
      enableLowStockAlert,
      stockValuationMethod,
      productSKU,
      location,
      supplier,
      UserId,
    } = req.body;

    console.log("Adding product:", req.body);

    // Use productPrice if sellingPrice not provided (for backward compatibility)
    const finalSellingPrice = sellingPrice || productPrice;
    const finalQuantity = initialStock || productQuantity || 0;

    // Create product
    const response = await Product.create({
      name,
      sellingPrice: `${finalSellingPrice}`.replace(",", ""),
      priceIncludeDelivery,
      deliveryScope,
      productLink,
      isNegotiable,
      isHidden,
      specifications,
      description,
      CategoryId,
      SubcategoryId,
      ShopId,
      productQuantity: finalQuantity,
    });

    console.log("Product added:", response.id);

    // Create inventory settings if tracking inventory
    if (trackInventory === "true" || trackInventory === true) {
      await InventorySettings.create({
        ProductId: response.id,
        ShopId,
        trackInventory: true,
        lowStockThreshold: parseInt(lowStockAlert) || 10,
        reorderLevel: parseInt(reorderLevel) || 15,
        maxStockLevel: parseInt(maxStockLevel) || 100,
        allowBackorder: allowBackorder === "true" || allowBackorder === true,
        enableLowStockAlert:
          enableLowStockAlert === "true" || enableLowStockAlert === true,
        stockValuationMethod: stockValuationMethod || "FIFO",
        sku: productSKU,
        location,
        supplier,
        buyingPrice: buyingPrice
          ? parseFloat(`${buyingPrice}`.replace(",", ""))
          : null,
      });

      console.log("Inventory settings created");

      // Create initial inventory transaction if quantity > 0
      if (finalQuantity > 0) {
        await InventoryTransaction.create({
          ProductId: response.id,
          ShopId,
          UserId: UserId || null,
          transactionType: "RESTOCK",
          quantityChange: parseInt(finalQuantity),
          quantityBefore: 0,
          quantityAfter: parseInt(finalQuantity),
          reference: "Initial Stock",
          notes: "Initial inventory stock when product was created",
          unitCost: buyingPrice
            ? parseFloat(`${buyingPrice}`.replace(",", ""))
            : null,
          totalCost: buyingPrice
            ? parseFloat(`${buyingPrice}`.replace(",", "")) *
              parseInt(finalQuantity)
            : null,
        });

        console.log("Initial inventory transaction created");
      }
    }

    // Invalidate relevant caches
    await invalidateProductCaches(response.id, ShopId, CategoryId);

    childLogger.info("Product added successfully", {
      requestId,
      productId: response.id,
      name,
      CategoryId,
      ShopId,
    });
    successResponse(res, response);
  } catch (error) {
    console.error("Error adding product:", error);
    errorResponse(res, error);
  }
};

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get a list of products
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID or subcategory ID
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search keyword for product names
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of products to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of products to skip
 *       - in: query
 *         name: spec_{specificationLabel}
 *         schema:
 *           type: string
 *         description: Filter by product specifications. Use spec_ prefix followed by the specification label (e.g., spec_Make=Toyota, spec_Body=SUV, spec_Discount=true)
 *     responses:
 *       200:
 *         description: Successfully fetched products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 rows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       500:
 *         description: Failed to fetch products
 */
const getProducts = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { category } = req.query;
    childLogger.http("Received get products request", {
      requestId,
      method: req.method,
      url: req.url,
      query: {
        category,
        keyword: req.keyword,
        limit: req.limit,
        offset: req.offset,
      },
    });

    let filter = {
      isHidden: false,
      name: {
        [Op.like]: `%${req.keyword ?? ""}%`,
      },
    };

    // Support filtering by CategoryId or SubcategoryId
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    let includes = [
      ProductImage,
      {
        model: Shop,
        required: true,
      },
      ProductStat,
      ProductReview,
    ];
    if (req.user) {
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }
    const response = await Product.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: filter,
      order: [["createdAt", "DESC"]],
      include: includes,
      distinct: true, // This ensures correct counting with JOINs
      col: "id", // Count distinct products, not joined rows
    });

    childLogger.info("Products fetched successfully", {
      requestId,
      count: response.count,
      page: req.page,
      category,
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

const getNewArrivalProducts = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { category } = req.query;
    let includes = [
      ProductImage,
      {
        model: Shop,
        required: true,
      },
      ProductStat,
      ProductReview,
    ];
    if (req.user) {
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }

    let filter = {
      isHidden: false,
      name: {
        [Op.like]: `%${req.keyword}%`,
      },
    };
    // Support filtering by CategoryId or SubcategoryId
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    const response = await Product.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: filter,
      order: [["createdAt", "DESC"]],
      include: includes,
      distinct: true,
      col: "id",
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

const getProductSearch = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { keyword } = req.params;
    const { category } = req.query;

    let filter = {
      isHidden: false,
      name: {
        [Op.iLike]: `%${keyword}%`,
      },
    };
    // Support filtering by CategoryId or SubcategoryId
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    const response = await Product.findAll({
      where: filter,
      include: [
        ProductImage,
        {
          model: Shop,
          required: true,
        },
        // ProductStat,
        ProductReview,
      ],
    });

    childLogger.info("Product search completed", {
      requestId,
      keyword,
      count: response.length,
    });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to search products", {
      requestId,
      keyword: req.params.keyword,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getProductsForYou = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { category } = req.query;
    let includes = [
      ProductImage,
      {
        model: Shop,
        required: true,
      },
      ProductStat,
      ProductReview,
    ];
    if (req.user) {
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }

    let filter = {
      isHidden: false,
      name: {
        [Op.like]: `%${req.keyword}%`,
      },
    };
    // Support filtering by CategoryId or SubcategoryId
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    const response = await Product.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: filter,
      include: includes,
      distinct: true,
      col: "id",
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

const getShopProducts = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    const { category } = req.query;
    let includes = [
      ProductImage,
      {
        model: Shop,
      },
      ProductStat,
      ProductReview,
    ];
    if (req.user) {
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }

    let filter = {
      name: {
        [Op.iLike]: `%${req.keyword}%`,
      },
      ShopId: id,
    };
    // Support filtering by CategoryId or SubcategoryId
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    const response = await Product.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [["createdAt", "DESC"]],
      where: filter,
      include: includes,
      distinct: true,
      col: "id",
    });

    childLogger.info("Shop products fetched successfully", {
      requestId,
      shopId: id,
      count: response.count,
      page: req.page,
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    childLogger.error("Failed to fetch shop products", {
      requestId,
      shopId: req.params.id,
      keyword: req.keyword,
      limit: req.limit,
      offset: req.offset,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getRelatedProducts = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    const { category } = req.query;

    const product = await findProductByID(id);

    if (!product) {
      childLogger.warn("Product not found", { requestId, productId: id });
      return res.status(404).send({
        status: false,
        message: "Product not found",
      });
    }

    let includes = [
      ProductImage,
      {
        model: Shop,
        required: true,
      },
      ProductStat,
      ProductReview,
    ];
    if (req.user) {
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }

    let filter = {
      isHidden: false,
      name: {
        [Op.like]: `%${req.keyword}%`,
      },
      id: { [Op.ne]: id },
    };

    // If category filter is provided, use it; otherwise use the product's CategoryId for related products
    if (category && category.toLowerCase() !== "all") {
      filter[Op.or] = [{ CategoryId: category }, { SubcategoryId: category }];
    } else {
      // Default behavior: find products with same CategoryId
      filter.CategoryId = product.CategoryId;
    }

    // Add specification filters
    filter = addSpecificationFilters(filter, req.query);

    const response = await Product.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: filter,
      include: includes,
      distinct: true,
      col: "id",
    });

    childLogger.info("Related products fetched successfully", {
      requestId,
      productId: id,
      CategoryId: product.CategoryId,
      count: response.count,
      page: req.page,
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    childLogger.error("Failed to fetch related products", {
      requestId,
      productId: req.params.id,
      keyword: req.keyword,
      limit: req.limit,
      offset: req.offset,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getProduct = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    let includes = [
      ProductImage,
      ProductStat,
      {
        model: ProductReview,
        required: false,
        description: { [Op.ne]: null },
        include: [User],
      },
    ];
    console.log("fetch product by id", id);
    console.log("user", user);
    if (user) {
      includes.push({
        model: CartProduct,
        where: { UserId: user.id },
        required: false,
      });
      //adding shop and favorite details

      includes.push({
        model: Shop,
        attributes: {
          include: [
            [
              Sequelize.literal(`
                  EXISTS (
                    SELECT 1
                    FROM "ShopFollowers"
                    WHERE "ShopFollowers"."UserId" = '${user.id}'
                    AND "ShopFollowers"."ShopId" = "Shop"."id"
                  )
                `),
              "following",
            ],
          ],
        },
        include: [
          {
            model: ShopFollower,
            where: { UserId: user.id },
            required: false,
          },
        ],
      });
      includes.push({
        model: Favorite,
        where: { UserId: req.user.id },
        required: false,
      });
    }
    let options = {
      where: { id },
      include: includes,
    };
    let product = await Product.findOne(options);
    //inside product there is specifications JSON ... reorder specifications to be viceversa (bottom, up)

    console.log("product", product);
    if (!product) {
      return res.status(404).send({
        status: false,
        message: "Product not found",
      });
    }

    successResponse(res, product);
  } catch (error) {
    errorResponse(res, error);
  }
};

const updateProduct = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    childLogger.http("Received update product request", {
      requestId,
      method: req.method,
      url: req.url,
      params: { id },
      body: req.body,
    });

    childLogger.debug("Request body", { requestId, body: req.body });

    childLogger.info("Fetching product for update", {
      requestId,
      productId: id,
    });
    const product = await findProductByID(id);

    if (!product) {
      childLogger.warn("Product not found", { requestId, productId: id });
      return res.status(404).send({
        status: false,
        message: "Product not found",
      });
    }

    childLogger.info("Updating product", { requestId, productId: id });
    const response = await product.update({
      ...req.body,
    });

    // Invalidate relevant caches
    await invalidateProductCaches(id, product.ShopId, product.CategoryId);

    childLogger.info("Product updated successfully", {
      requestId,
      productId: id,
    });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to update product", {
      requestId,
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const deleteProduct = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    childLogger.http("Received delete product request", {
      requestId,
      method: req.method,
      url: req.url,
      params: { id },
    });

    childLogger.info("Fetching product for deletion", {
      requestId,
      productId: id,
    });
    const product = await findProductByID(id);

    if (!product) {
      childLogger.warn("Product not found", { requestId, productId: id });
      return res.status(404).send({
        status: false,
        message: "Product not found",
      });
    }

    childLogger.info("Deleting product", { requestId, productId: id });

    // Store values before deletion for cache invalidation
    const shopId = product.ShopId;
    const categoryId = product.CategoryId;

    const response = await product.destroy();

    // Invalidate relevant caches
    await invalidateProductCaches(id, shopId, categoryId);

    childLogger.info("Product deleted successfully", {
      requestId,
      productId: id,
    });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to delete product", {
      requestId,
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

module.exports = {
  findProductByID,
  getProducts,
  addProduct,
  deleteProduct,
  getShopProducts,
  getNewArrivalProducts,
  getProductsForYou,
  getProductSearch,
  getRelatedProducts,
  getProduct,
  updateProduct,
};
