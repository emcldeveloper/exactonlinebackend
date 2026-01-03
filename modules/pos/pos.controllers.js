const {
  POSSale,
  POSSaleItem,
  POSSession,
  Product,
  ProductImage,
  Shop,
  User,
  InventoryTransaction,
  sequelize,
  Sequelize,
} = require("../../models");
const { Op } = Sequelize;
const winston = require("winston");

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

// Create a new POS sale
const createPOSSale = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      ShopId,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      amountPaid,
      customerName,
      customerPhone,
      customerId,
      notes,
      POSSessionId,
    } = req.body;

    // Validate user authentication
    if (!req.user || !req.user.id) {
      logger.error("User not authenticated or missing user ID");
      return res.status(401).json({
        message: "User not authenticated",
      });
    }

    const UserId = req.user.id;

    // Log incoming data for debugging
    logger.info(
      `Creating POS sale - Full request body:`,
      JSON.stringify(req.body, null, 2)
    );
    logger.info(`Items received:`, items);

    // Validate required fields
    if (!ShopId || !items || items.length === 0 || !total || !paymentMethod) {
      logger.error(`Validation failed:`, {
        ShopId,
        itemsLength: items?.length,
        total,
        paymentMethod,
      });
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    // Calculate amount change
    const amountChange = Math.max(0, amountPaid - total);

    // Create the sale
    const sale = await POSSale.create(
      {
        receiptNumber,
        ShopId,
        UserId,
        POSSessionId,
        subtotal: subtotal || 0,
        discount: discount || 0,
        tax: tax || 0,
        total,
        paymentMethod,
        paymentStatus: "PAID",
        amountPaid: amountPaid || total,
        amountChange,
        customerId,
        customerName,
        customerPhone,
        notes,
        status: "COMPLETED",
      },
      { transaction }
    );

    // Create sale items and update inventory
    const saleItems = [];
    for (const item of items) {
      // Validate ProductId exists
      if (!item.ProductId) {
        logger.error(`Item missing ProductId:`, item);
        throw new Error(
          `Item is missing ProductId. Item data: ${JSON.stringify(item)}`
        );
      }

      const product = await Product.findByPk(item.ProductId);
      if (!product) {
        throw new Error(`Product ${item.ProductId} not found`);
      }

      // Check stock availability
      if (product.productQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.productQuantity}, Requested: ${item.quantity}`
        );
      }

      // Calculate item totals
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemDiscount = item.discount || 0;
      const itemTax = item.tax || 0;
      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      // Create sale item
      const saleItem = await POSSaleItem.create(
        {
          POSSaleId: sale.id,
          ProductId: item.ProductId,
          productName: product.name,
          productSKU: "", // Product model doesn't have SKU field
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: itemDiscount,
          tax: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          cost: 0, // Cost price not stored in Product model
          notes: item.notes,
        },
        { transaction }
      );

      saleItems.push(saleItem);

      // Update product quantity
      const quantityBefore = product.productQuantity;
      await product.update(
        {
          productQuantity: product.productQuantity - item.quantity,
        },
        { transaction }
      );

      // Create inventory transaction
      await InventoryTransaction.create(
        {
          ProductId: item.ProductId,
          ShopId,
          UserId,
          transactionType: "SALE",
          quantityChange: -item.quantity,
          quantityBefore,
          quantityAfter: product.productQuantity - item.quantity,
          reference: receiptNumber,
          notes: `POS Sale - ${receiptNumber}`,
          unitCost: 0, // Cost price not stored in Product model
          totalCost: 0,
        },
        { transaction }
      );
    }

    // Update POS session if provided
    if (POSSessionId) {
      const session = await POSSession.findByPk(POSSessionId);
      if (session && session.status === "OPEN") {
        const updateData = {
          totalSales: session.totalSales + total,
          totalTransactions: session.totalTransactions + 1,
        };

        switch (paymentMethod) {
          case "CASH":
            updateData.cashSales = session.cashSales + total;
            break;
          case "CARD":
            updateData.cardSales = session.cardSales + total;
            break;
          case "MOBILE_MONEY":
            updateData.mobileMoneySales = session.mobileMoneySales + total;
            break;
          case "CREDIT":
            updateData.creditSales = session.creditSales + total;
            break;
        }

        await session.update(updateData, { transaction });
      }
    }

    await transaction.commit();

    // Fetch complete sale data with items
    const completeSale = await POSSale.findByPk(sale.id, {
      include: [
        {
          model: POSSaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name"],
              include: [
                {
                  model: ProductImage,
                  as: "ProductImages",
                  attributes: ["image"],
                  limit: 1,
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "cashier",
          attributes: ["id", "name", "email"],
        },
        {
          model: Shop,
          as: "shop",
        },
      ],
    });

    logger.info(`POS Sale created: ${receiptNumber}`);
    res.status(201).json({
      message: "Sale completed successfully",
      data: completeSale,
    });
  } catch (error) {
    // Only rollback if transaction hasn't been committed yet
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    logger.error(`Error creating POS sale: ${error.message}`);
    res.status(500).json({
      message: error.message || "Error creating sale",
    });
  }
};

// Get POS sales with filters
const getPOSSales = async (req, res) => {
  try {
    const {
      ShopId,
      startDate,
      endDate,
      paymentMethod,
      status,
      POSSessionId,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (ShopId) where.ShopId = ShopId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    // Default to COMPLETED status if not specified, to match analytics behavior
    if (status) {
      where.status = status;
    } else {
      where.status = "COMPLETED";
    }
    if (POSSessionId) where.POSSessionId = POSSessionId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await POSSale.findAndCountAll({
      where,
      include: [
        {
          model: POSSaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: User,
          as: "cashier",
          attributes: ["id", "name"],
        },
        {
          model: Shop,
          as: "shop",
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      message: "Sales fetched successfully",
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching POS sales: ${error.message}`);
    res.status(500).json({
      message: "Error fetching sales",
    });
  }
};

// Get single POS sale
const getPOSSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await POSSale.findByPk(id, {
      include: [
        {
          model: POSSaleItem,
          as: "items",
          include: [
            {
              model: Product,
              attributes: ["id", "productName", "productSKU"],
              include: [
                {
                  model: ProductImage,
                  as: "ProductImages",
                  attributes: ["image"],
                  limit: 1,
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "cashier",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: User,
          as: "customer",
          attributes: ["id", "fullName", "email", "phone"],
        },
        {
          model: Shop,
          as: "shop",
          attributes: ["id", "shopName", "location", "phone"],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    res.status(200).json({
      message: "Sale fetched successfully",
      data: sale,
    });
  } catch (error) {
    logger.error(`Error fetching POS sale: ${error.message}`);
    res.status(500).json({
      message: "Error fetching sale",
    });
  }
};

// Get POS analytics
const getPOSAnalytics = async (req, res) => {
  try {
    const { ShopId, startDate, endDate, period = "today" } = req.query;

    if (!ShopId) {
      return res.status(400).json({
        message: "ShopId is required",
      });
    }

    let dateFilter = {};
    const now = new Date();

    switch (period.toLowerCase()) {
      case "today":
        dateFilter = {
          [Op.gte]: new Date(now.setHours(0, 0, 0, 0)),
        };
        break;
      case "week":
      case "this_week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = { [Op.gte]: weekStart };
        break;
      case "month":
      case "this_month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        dateFilter = { [Op.gte]: monthStart };
        break;
      case "year":
      case "this_year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        dateFilter = { [Op.gte]: yearStart };
        break;
      case "custom":
        if (startDate) dateFilter[Op.gte] = new Date(startDate);
        if (endDate) dateFilter[Op.lte] = new Date(endDate);
        break;
    }

    const where = {
      ShopId,
      status: "COMPLETED",
      createdAt: dateFilter,
    };

    // Get sales summary
    const sales = await POSSale.findAll({
      where,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalTransactions"],
        [sequelize.fn("SUM", sequelize.col("total")), "totalSales"],
        [sequelize.fn("SUM", sequelize.col("subtotal")), "totalSubtotal"],
        [sequelize.fn("SUM", sequelize.col("discount")), "totalDiscount"],
        [sequelize.fn("AVG", sequelize.col("total")), "avgTransaction"],
        [sequelize.fn("SUM", sequelize.col("tax")), "totalTax"],
      ],
      raw: true,
    });

    // Get payment method breakdown
    const paymentMethods = await POSSale.findAll({
      where,
      attributes: [
        [sequelize.col("paymentMethod"), "method"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("total")), "total"],
      ],
      group: ["paymentMethod"],
      raw: true,
    });

    // Get items sold
    const itemsSold = await POSSaleItem.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalItems"],
      ],
      include: [
        {
          model: POSSale,
          as: "sale",
          where,
          attributes: [],
        },
      ],
      raw: true,
    });

    // Get top products
    const topProducts = await POSSaleItem.findAll({
      attributes: [
        "ProductId",
        "productName",
        [
          sequelize.fn("SUM", sequelize.col("POSSaleItem.quantity")),
          "totalQuantity",
        ],
        [
          sequelize.fn("SUM", sequelize.col("POSSaleItem.total")),
          "totalRevenue",
        ],
      ],
      include: [
        {
          model: POSSale,
          as: "sale",
          where,
          attributes: [],
        },
      ],
      group: ["ProductId", "productName"],
      order: [
        [sequelize.fn("SUM", sequelize.col("POSSaleItem.total")), "DESC"],
      ],
      limit: 10,
      raw: true,
    });

    // Get hourly sales (for today only)
    let hourlySales = [];
    if (period === "today") {
      hourlySales = await POSSale.findAll({
        where,
        attributes: [
          [sequelize.literal('EXTRACT(HOUR FROM "createdAt")'), "hour"],
          [sequelize.fn("COUNT", sequelize.col("id")), "transactions"],
          [sequelize.fn("SUM", sequelize.col("total")), "sales"],
        ],
        group: [sequelize.literal('EXTRACT(HOUR FROM "createdAt")')],
        order: [[sequelize.literal('EXTRACT(HOUR FROM "createdAt")'), "ASC"]],
        raw: true,
      });
    }

    res.status(200).json({
      message: "Analytics fetched successfully",
      data: {
        totalTransactions: parseInt(sales[0]?.totalTransactions || 0),
        totalSales: parseFloat(sales[0]?.totalSales || 0),
        totalDiscount: parseFloat(sales[0]?.totalDiscount || 0),
        totalTax: parseFloat(sales[0]?.totalTax || 0),
        averageSale: parseFloat(sales[0]?.avgTransaction || 0),
        totalItemsSold: parseInt(itemsSold[0]?.totalItems || 0),
        paymentMethods: paymentMethods.map((pm) => ({
          method: pm.method,
          count: parseInt(pm.count),
          total: parseFloat(pm.total),
        })),
        topProducts: topProducts.map((tp) => ({
          productName: tp.productName,
          totalQuantity: parseInt(tp.totalQuantity),
          totalRevenue: parseFloat(tp.totalRevenue),
        })),
        hourlySales: hourlySales.map((hs) => ({
          hour: parseInt(hs.hour),
          transactions: parseInt(hs.transactions),
          sales: parseFloat(hs.sales),
        })),
      },
    });
  } catch (error) {
    logger.error(`Error fetching POS analytics: ${error.message}`);
    res.status(500).json({
      message: "Error fetching analytics",
    });
  }
};

// Refund a sale
const refundPOSSale = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { refundAmount, refundReason, items } = req.body;
    const UserId = req.user.id;

    const sale = await POSSale.findByPk(id, {
      include: [{ model: POSSaleItem, as: "items" }],
    });

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    if (sale.status === "REFUNDED") {
      return res.status(400).json({
        message: "Sale already refunded",
      });
    }

    // Full or partial refund
    const isFullRefund = !items || items.length === sale.items.length;

    // Update sale status
    await sale.update(
      {
        status: isFullRefund ? "REFUNDED" : "COMPLETED",
        refundedAt: new Date(),
        refundAmount: refundAmount || sale.total,
        refundReason,
      },
      { transaction }
    );

    // Restore inventory
    for (const item of sale.items) {
      const shouldRefund =
        !items || items.find((i) => i.POSSaleItemId === item.id);

      if (shouldRefund) {
        const product = await Product.findByPk(item.ProductId);
        const quantityBefore = product.productQuantity;

        await product.update(
          {
            productQuantity: product.productQuantity + item.quantity,
          },
          { transaction }
        );

        // Create inventory transaction
        await InventoryTransaction.create(
          {
            ProductId: item.ProductId,
            ShopId: sale.ShopId,
            UserId,
            transactionType: "RETURN",
            quantityChange: item.quantity,
            quantityBefore,
            quantityAfter: product.productQuantity + item.quantity,
            reference: sale.receiptNumber,
            notes: `Refund - ${sale.receiptNumber}`,
          },
          { transaction }
        );
      }
    }

    // Update POS session
    if (sale.POSSessionId) {
      const session = await POSSession.findByPk(sale.POSSessionId);
      if (session) {
        await session.update(
          {
            totalSales: session.totalSales - (refundAmount || sale.total),
            refunds: session.refunds + (refundAmount || sale.total),
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    logger.info(`POS Sale refunded: ${sale.receiptNumber}`);
    res.status(200).json({
      message: "Sale refunded successfully",
      data: sale,
    });
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error refunding POS sale: ${error.message}`);
    res.status(500).json({
      message: "Error refunding sale",
    });
  }
};

// POS Session Management
const createPOSSession = async (req, res) => {
  try {
    const { ShopId, openingCash, notes } = req.body;
    const UserId = req.user.id;

    // Check for open session
    const openSession = await POSSession.findOne({
      where: {
        ShopId,
        UserId,
        status: "OPEN",
      },
    });

    if (openSession) {
      return res.status(400).json({
        message: "You already have an open session",
        data: openSession,
      });
    }

    const sessionNumber = `SES-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    const session = await POSSession.create({
      ShopId,
      UserId,
      sessionNumber,
      openingCash: openingCash || 0,
      notes,
      status: "OPEN",
    });

    logger.info(`POS Session created: ${sessionNumber}`);
    res.status(201).json({
      message: "Session opened successfully",
      data: session,
    });
  } catch (error) {
    logger.error(`Error creating POS session: ${error.message}`);
    res.status(500).json({
      message: "Error creating session",
    });
  }
};

const closePOSSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { closingCash, notes } = req.body;
    const UserId = req.user.id;

    const session = await POSSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (session.status === "CLOSED") {
      return res.status(400).json({
        message: "Session already closed",
      });
    }

    const expectedCash =
      session.openingCash + session.cashSales - session.refunds;
    const cashDifference = closingCash - expectedCash;

    await session.update({
      status: "CLOSED",
      endTime: new Date(),
      closingCash,
      expectedCash,
      cashDifference,
      notes: notes || session.notes,
      closedBy: UserId,
    });

    logger.info(`POS Session closed: ${session.sessionNumber}`);
    res.status(200).json({
      message: "Session closed successfully",
      data: session,
    });
  } catch (error) {
    logger.error(`Error closing POS session: ${error.message}`);
    res.status(500).json({
      message: "Error closing session",
    });
  }
};

const getPOSSessions = async (req, res) => {
  try {
    const { ShopId, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (ShopId) where.ShopId = ShopId;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await POSSession.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "cashier",
          attributes: ["id", "fullName"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      message: "Sessions fetched successfully",
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching POS sessions: ${error.message}`);
    res.status(500).json({
      message: "Error fetching sessions",
    });
  }
};

module.exports = {
  createPOSSale,
  getPOSSales,
  getPOSSale,
  getPOSAnalytics,
  refundPOSSale,
  createPOSSession,
  closePOSSession,
  getPOSSessions,
};
