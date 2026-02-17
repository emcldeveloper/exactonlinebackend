const { Op, Sequelize } = require("sequelize");
const {
  Product,
  InventoryTransaction,
  InventoryBatch,
  InventoryAlert,
  InventorySettings,
  ProductImage,
  Shop,
  Category,
  CategorySettings,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const logger = require("../../utils/logger");
const { v4: uuidv4 } = require("uuid");

const childLogger = logger.child({ module: "Inventory Module" });

/**
 * Add or update inventory transaction and update product quantity
 */
const addInventoryTransaction = async (req, res) => {
  const requestId = uuidv4();
  try {
    const {
      ProductId,
      ShopId,
      UserId,
      transactionType,
      quantityChange,
      batchNumber,
      reference,
      notes,
      unitCost,
    } = req.body;

    childLogger.info("Adding inventory transaction", {
      requestId,
      ProductId,
      transactionType,
    });

    // Find the product
    const product = await Product.findByPk(ProductId);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    const quantityBefore = product.productQuantity || 0;
    const quantityAfter = quantityBefore + quantityChange;

    // Prevent negative stock unless it's allowed
    if (quantityAfter < 0) {
      const settings = await InventorySettings.findOne({
        where: { ProductId },
      });
      if (!settings || !settings.allowBackorder) {
        return errorResponse(
          res,
          "Insufficient stock. Backorders not allowed.",
          400,
        );
      }
    }

    // Create transaction
    const transaction = await InventoryTransaction.create({
      ProductId,
      ShopId,
      UserId,
      transactionType,
      quantityChange,
      quantityBefore,
      quantityAfter,
      batchNumber,
      reference,
      notes,
      unitCost,
      totalCost: unitCost ? unitCost * Math.abs(quantityChange) : null,
    });

    // Update product quantity
    await product.update({ productQuantity: quantityAfter });

    // If batch number provided, update or create batch
    if (batchNumber && transactionType === "RESTOCK") {
      const batch = await InventoryBatch.findOne({
        where: { batchNumber, ProductId, ShopId },
      });

      if (batch) {
        await batch.update({
          quantity: batch.quantity + quantityChange,
        });
      }
    }

    // Check for low stock alerts
    await checkAndCreateAlerts(ProductId, ShopId, quantityAfter);

    childLogger.info("Inventory transaction added successfully", {
      requestId,
      transactionId: transaction.id,
    });

    return successResponse(
      res,
      { transaction, product },
      "Inventory transaction recorded successfully",
    );
  } catch (error) {
    childLogger.error("Failed to add inventory transaction", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get inventory transactions for a product or shop
 */
const getInventoryTransactions = async (req, res) => {
  const requestId = uuidv4();
  try {
    const {
      ProductId,
      ShopId,
      type,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    childLogger.info("Fetching inventory transactions", {
      requestId,
      ProductId,
      ShopId,
    });

    const whereClause = {};
    if (ProductId) whereClause.ProductId = ProductId;
    if (ShopId) whereClause.ShopId = ShopId;
    if (type) whereClause.transactionType = type;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: transactions } =
      await InventoryTransaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name"],
            include: [
              {
                model: ProductImage,
                attributes: ["image"],
                limit: 1,
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

    return successResponse(res, {
      transactions,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    childLogger.error("Failed to fetch inventory transactions", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Add inventory batch
 */
const addInventoryBatch = async (req, res) => {
  const requestId = uuidv4();
  try {
    const {
      ProductId,
      ShopId,
      batchNumber,
      quantity,
      expiryDate,
      manufacturingDate,
      supplierInfo,
      costPerUnit,
      location,
      notes,
      reference,
    } = req.body;

    childLogger.info("Adding inventory batch", {
      requestId,
      ProductId,
      batchNumber,
      reference,
    });

    console.log("=== ADD BATCH REQUEST ===");
    console.log("Request body:", req.body);
    console.log("Reference:", reference);

    // Check if batch number already exists
    const existingBatch = await InventoryBatch.findOne({
      where: { batchNumber },
    });

    if (existingBatch) {
      return errorResponse(res, "Batch number already exists", 400);
    }

    const batch = await InventoryBatch.create({
      ProductId,
      ShopId,
      batchNumber,
      quantity,
      initialQuantity: quantity,
      expiryDate,
      manufacturingDate,
      supplierInfo,
      costPerUnit,
      location,
      notes,
    });

    // Create inventory transaction for this batch
    const product = await Product.findByPk(ProductId);
    const quantityBefore = product.productQuantity || 0;

    console.log("=== CREATING TRANSACTION ===");
    console.log("Reference to be used:", reference || null);
    console.log("Notes to be used:", notes || `Batch ${batchNumber} added`);

    await InventoryTransaction.create({
      ProductId,
      ShopId,
      transactionType: "RESTOCK",
      quantityChange: quantity,
      quantityBefore,
      quantityAfter: quantityBefore + quantity,
      batchNumber,
      reference: reference || null,
      unitCost: costPerUnit,
      totalCost: costPerUnit ? costPerUnit * quantity : null,
      notes: notes || `Batch ${batchNumber} added`,
    });

    console.log("=== TRANSACTION CREATED ===");

    // Update product quantity
    await product.update({
      productQuantity: quantityBefore + quantity,
    });

    childLogger.info("Inventory batch added successfully", {
      requestId,
      batchId: batch.id,
    });

    return successResponse(res, batch, "Inventory batch added successfully");
  } catch (error) {
    childLogger.error("Failed to add inventory batch", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get inventory batches for a product
 */
const getInventoryBatches = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ProductId, ShopId, status } = req.query;

    childLogger.info("Fetching inventory batches", {
      requestId,
      ProductId,
      ShopId,
    });

    const whereClause = {};
    if (ProductId) whereClause.ProductId = ProductId;
    if (ShopId) whereClause.ShopId = ShopId;
    if (status) whereClause.status = status;

    const batches = await InventoryBatch.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return successResponse(res, batches);
  } catch (error) {
    childLogger.error("Failed to fetch inventory batches", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get product by batch number
 */
const getProductByBatchNumber = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { batchNumber } = req.params;
    const UserId = req.user?.id;

    console.log("===== STEP 1: Request received =====");
    console.log("Batch number from params:", batchNumber);
    console.log("User ID:", UserId);
    console.log("Full req.params:", JSON.stringify(req.params));
    console.log("Full req.user:", JSON.stringify(req.user));

    childLogger.info("Fetching product by batch number", {
      requestId,
      batchNumber,
    });

    console.log("===== STEP 2: Querying database for batch =====");
    // Find the batch
    const batch = await InventoryBatch.findOne({
      where: { batchNumber },
      include: [
        {
          model: Product,
          as: "product", // Use the alias defined in the model association
          include: [
            {
              model: ProductImage,
            },
          ],
        },
      ],
    });

    console.log("===== STEP 3: Batch query result =====");
    console.log("Batch found:", !!batch);
    if (batch) {
      console.log("Batch ID:", batch.id);
      console.log("Batch ProductId:", batch.ProductId);
      console.log("Batch product (association):", !!batch.product);
      console.log("Full batch object:", JSON.stringify(batch.toJSON()));
    }

    if (!batch) {
      console.log("===== ERROR: Batch not found =====");
      childLogger.warn("Batch not found", { requestId, batchNumber });
      return errorResponse(res, "Batch not found", 404);
    }

    // Debug logging to see what we got
    childLogger.info("Batch found", {
      requestId,
      batchId: batch.id,
      hasProduct: !!batch.product,
      productId: batch.ProductId,
      batchData: JSON.stringify(batch.toJSON()),
    });

    console.log("===== STEP 4: Checking product association =====");
    // Get the product from the association, or fetch it directly if association failed
    let product = batch.product;
    console.log("Product from association:", !!product);

    if (!product) {
      console.log("===== STEP 5: Fetching product directly =====");
      childLogger.warn(
        "Product not loaded via association, fetching directly",
        {
          requestId,
          productId: batch.ProductId,
        },
      );

      // Fetch product directly
      product = await Product.findByPk(batch.ProductId, {
        include: [
          {
            model: ProductImage,
            attributes: ["id", "image"],
          },
        ],
      });

      console.log("Product fetched directly:", !!product);
      if (product) {
        console.log("Product ID:", product.id);
        console.log("Product ShopId:", product.ShopId);
        console.log("Full product:", JSON.stringify(product.toJSON()));
      }
    }

    console.log("===== STEP 6: Validating product exists =====");
    if (!product) {
      console.log("===== ERROR: Product not found =====");
      childLogger.error("Product not found for batch", {
        requestId,
        batchNumber,
        batchId: batch.id,
        productId: batch.ProductId,
      });
      return errorResponse(res, "Product not found for this batch", 404);
    }

    console.log("===== STEP 7: Verifying shop access =====");
    console.log("Product ShopId:", product.ShopId);
    console.log("User ID:", UserId);

    // Verify user has access to this product's shop
    const shop = await Shop.findOne({
      where: {
        id: product.ShopId,
        UserId,
      },
    });

    console.log("===== STEP 8: Shop query result =====");
    console.log("Shop found:", !!shop);
    if (shop) {
      console.log("Shop ID:", shop.id);
      console.log("Shop name:", shop.name);
    }

    if (!shop) {
      console.log("===== ERROR: Access denied =====");
      childLogger.warn("Access denied to product", {
        requestId,
        ShopId: product.ShopId,
        UserId,
      });
      return errorResponse(res, "Access denied to this product", 403);
    }

    console.log("===== STEP 9: Preparing response =====");
    childLogger.info("Product found by batch number", {
      requestId,
      ProductId: product.id,
    });

    const responseData = {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate,
        costPerUnit: batch.costPerUnit,
        location: batch.location,
      },
      product: {
        id: product.id,
        name: product.name,
        sellingPrice: product.sellingPrice,
        productQuantity: product.productQuantity,
        productSKU: product.productSKU,
        ProductImages: product.ProductImages,
      },
    };

    console.log("===== STEP 10: Response data prepared =====");
    console.log("Response:", JSON.stringify(responseData));

    return successResponse(res, responseData);
  } catch (error) {
    console.log("===== ERROR: Exception caught =====");
    console.log("Error message:", error.message);
    console.log("Error stack:", error.stack);
    console.log(
      "Full error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
    );

    childLogger.error("Failed to fetch product by batch number", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get inventory alerts
 */
const getInventoryAlerts = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ShopId, ProductId, alertType, severity, isResolved } = req.query;

    childLogger.info("Fetching inventory alerts", {
      requestId,
      ShopId,
      ProductId,
    });

    const whereClause = {};
    if (ShopId) whereClause.ShopId = ShopId;
    if (ProductId) whereClause.ProductId = ProductId;
    if (alertType) whereClause.alertType = alertType;
    if (severity) whereClause.severity = severity;
    if (isResolved !== undefined)
      whereClause.isResolved = isResolved === "true";

    const alerts = await InventoryAlert.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name"],
          include: [
            {
              model: ProductImage,
              attributes: ["image"],
              limit: 1,
            },
          ],
        },
      ],
      order: [
        ["severity", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    // Group alerts by severity
    const grouped = {
      CRITICAL: alerts.filter((a) => a.severity === "CRITICAL"),
      WARNING: alerts.filter((a) => a.severity === "WARNING"),
      INFO: alerts.filter((a) => a.severity === "INFO"),
    };

    return successResponse(res, { alerts, grouped });
  } catch (error) {
    childLogger.error("Failed to fetch inventory alerts", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Mark alert as read/resolved
 */
const updateInventoryAlert = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    const { isRead, isResolved } = req.body;

    childLogger.info("Updating inventory alert", { requestId, alertId: id });

    const alert = await InventoryAlert.findByPk(id);
    if (!alert) {
      return errorResponse(res, "Alert not found", 404);
    }

    const updateData = {};
    if (isRead !== undefined) updateData.isRead = isRead;
    if (isResolved !== undefined) {
      updateData.isResolved = isResolved;
      if (isResolved) {
        updateData.resolvedAt = new Date();
      }
    }

    await alert.update(updateData);

    return successResponse(res, alert, "Alert updated successfully");
  } catch (error) {
    childLogger.error("Failed to update inventory alert", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get or create inventory settings for a product
 */
const getInventorySettings = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ProductId } = req.params;

    childLogger.info("Fetching inventory settings", {
      requestId,
      ProductId,
    });

    let settings = await InventorySettings.findOne({
      where: { ProductId },
    });

    if (!settings) {
      // Get product to get ShopId
      const product = await Product.findByPk(ProductId);
      if (!product) {
        return errorResponse(res, "Product not found", 404);
      }

      // Create default settings
      settings = await InventorySettings.create({
        ProductId,
        ShopId: product.ShopId,
      });
    }

    return successResponse(res, settings);
  } catch (error) {
    childLogger.error("Failed to fetch inventory settings", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Update inventory settings for a product
 */
const updateInventorySettings = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ProductId } = req.params;
    const settingsData = req.body;

    childLogger.info("Updating inventory settings", {
      requestId,
      ProductId,
    });

    let settings = await InventorySettings.findOne({
      where: { ProductId },
    });

    if (!settings) {
      // Get product to get ShopId
      const product = await Product.findByPk(ProductId);
      if (!product) {
        return errorResponse(res, "Product not found", 404);
      }

      settings = await InventorySettings.create({
        ProductId,
        ShopId: product.ShopId,
        ...settingsData,
      });
    } else {
      await settings.update(settingsData);
    }

    return successResponse(
      res,
      settings,
      "Inventory settings updated successfully",
    );
  } catch (error) {
    childLogger.error("Failed to update inventory settings", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Get inventory statistics for a shop
 */
const getInventoryStats = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ShopId } = req.params;

    childLogger.info("Fetching inventory statistics", {
      requestId,
      ShopId,
    });

    // Get all products for the shop
    const products = await Product.findAll({
      where: { ShopId },
      attributes: [
        "id",
        "name",
        "productQuantity",
        "sellingPrice",
        "CategoryId",
      ],
      include: [
        {
          model: InventorySettings,
          as: "inventorySettings",
          attributes: ["lowStockThreshold", "buyingPrice"],
        },
        {
          model: Category,
          as: "Category",
          include: [
            {
              model: CategorySettings,
              as: "settings",
              attributes: ["showProductONInventory"],
            },
          ],
        },
      ],
    });

    // Filter products by showProductONInventory setting
    const filteredProducts = products.filter((product) => {
      const showOnInventory =
        product.Category?.settings?.showProductONInventory;
      return showOnInventory !== false; // Show if true or undefined/null
    });

    const totalProducts = filteredProducts.length;
    const inStockProducts = filteredProducts.filter(
      (p) => p.productQuantity >= 10,
    ).length;
    const lowStockProducts = filteredProducts.filter(
      (p) => p.productQuantity > 0 && p.productQuantity < 10,
    ).length;
    const outOfStockProducts = filteredProducts.filter(
      (p) => p.productQuantity === 0,
    ).length;

    // Calculate total stock value
    const totalStockValue = filteredProducts.reduce((sum, p) => {
      const qty = p.productQuantity || 0;
      const price = parseFloat(p.sellingPrice) || 0;
      return sum + qty * price;
    }, 0);

    // Calculate inventory cost
    const totalCost = filteredProducts.reduce((sum, p) => {
      const qty = p.productQuantity || 0;
      const buyingPrice = parseFloat(p.inventorySettings?.buyingPrice) || 0;
      return sum + qty * buyingPrice;
    }, 0);

    // Get recent transactions count
    const recentTransactions = await InventoryTransaction.count({
      where: {
        ShopId,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    // Get active alerts count
    const activeAlerts = await InventoryAlert.count({
      where: {
        ShopId,
        isResolved: false,
      },
    });

    return successResponse(res, {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalStockValue,
      totalCost,
      recentTransactions,
      activeAlerts,
    });
  } catch (error) {
    childLogger.error("Failed to fetch inventory statistics", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

/**
 * Helper function to check and create alerts
 */
const checkAndCreateAlerts = async (ProductId, ShopId, currentQuantity) => {
  try {
    const settings = await InventorySettings.findOne({
      where: { ProductId },
    });

    if (!settings || !settings.enableLowStockAlert) {
      return;
    }

    const product = await Product.findByPk(ProductId);

    // Check for out of stock
    if (currentQuantity === 0) {
      await InventoryAlert.findOrCreate({
        where: {
          ProductId,
          ShopId,
          alertType: "OUT_OF_STOCK",
          isResolved: false,
        },
        defaults: {
          severity: "CRITICAL",
          currentQuantity,
          message: `${product.name} is out of stock`,
        },
      });
    }
    // Check for low stock
    else if (currentQuantity <= settings.lowStockThreshold) {
      await InventoryAlert.findOrCreate({
        where: {
          ProductId,
          ShopId,
          alertType: "LOW_STOCK",
          isResolved: false,
        },
        defaults: {
          severity: "WARNING",
          currentQuantity,
          thresholdValue: settings.lowStockThreshold,
          message: `${product.name} is running low (${currentQuantity} units remaining)`,
        },
      });
    }
    // Check for reorder point
    else if (
      settings.reorderLevel &&
      currentQuantity <= settings.reorderLevel
    ) {
      await InventoryAlert.findOrCreate({
        where: {
          ProductId,
          ShopId,
          alertType: "REORDER_POINT",
          isResolved: false,
        },
        defaults: {
          severity: "INFO",
          currentQuantity,
          thresholdValue: settings.reorderLevel,
          message: `${product.name} has reached reorder point (${currentQuantity} units)`,
        },
      });
    }

    // Resolve alerts if stock is back to normal
    if (currentQuantity > settings.lowStockThreshold) {
      await InventoryAlert.update(
        {
          isResolved: true,
          resolvedAt: new Date(),
        },
        {
          where: {
            ProductId,
            ShopId,
            alertType: { [Op.in]: ["LOW_STOCK", "OUT_OF_STOCK"] },
            isResolved: false,
          },
        },
      );
    }
  } catch (error) {
    childLogger.error("Failed to check and create alerts", {
      error: error.message,
    });
  }
};

/**
 * Bulk update product quantities (for inventory count)
 */
const bulkUpdateInventory = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { ShopId, UserId, products, notes } = req.body;
    // products: [{ ProductId, countedQuantity }]

    childLogger.info("Bulk updating inventory", {
      requestId,
      ShopId,
      productsCount: products.length,
    });

    const results = [];

    for (const item of products) {
      const { ProductId, countedQuantity } = item;
      const product = await Product.findByPk(ProductId);

      if (!product) {
        results.push({
          ProductId,
          success: false,
          error: "Product not found",
        });
        continue;
      }

      const quantityBefore = product.productQuantity || 0;
      const quantityChange = countedQuantity - quantityBefore;

      if (quantityChange !== 0) {
        // Create adjustment transaction
        await InventoryTransaction.create({
          ProductId,
          ShopId,
          UserId,
          transactionType: "COUNT",
          quantityChange,
          quantityBefore,
          quantityAfter: countedQuantity,
          notes: notes || `Inventory count adjustment`,
        });

        // Update product quantity
        await product.update({ productQuantity: countedQuantity });

        // Check for alerts
        await checkAndCreateAlerts(ProductId, ShopId, countedQuantity);

        results.push({
          ProductId,
          success: true,
          quantityBefore,
          quantityAfter: countedQuantity,
          difference: quantityChange,
        });
      } else {
        results.push({
          ProductId,
          success: true,
          message: "No change needed",
        });
      }
    }

    return successResponse(res, results, "Inventory updated successfully");
  } catch (error) {
    childLogger.error("Failed to bulk update inventory", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, error.message);
  }
};

module.exports = {
  addInventoryTransaction,
  getInventoryTransactions,
  addInventoryBatch,
  getInventoryBatches,
  getProductByBatchNumber,
  getInventoryAlerts,
  updateInventoryAlert,
  getInventorySettings,
  updateInventorySettings,
  getInventoryStats,
  bulkUpdateInventory,
};
