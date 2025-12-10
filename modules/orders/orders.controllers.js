const { Op } = require("sequelize");
const {
  Shop,
  User,
  OrderedProduct,
  Order,
  Product,
  ProductImage,
  Notification,
  InventoryTransaction,
  POSSale,
  POSSaleItem,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");
const { getUserChats } = require("../chats/chats.controllers");
const sendSMS = require("../../utils/send_sms");
const { sendFCMNotification } = require("../../utils/send_notification");
const { randomNumber } = require("../../utils/random_number");

const findOrderByID = async (id) => {
  try {
    const order = await Order.findOne({
      where: {
        id,
      },
      include: [
        User,
        { model: Shop, include: [User] },
        {
          model: OrderedProduct,
          include: [
            {
              model: Product,
              include: [ProductImage],
            },
          ],
        },
      ],
    });
    return order;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addOrder = async (req, res) => {
  try {
    const { ShopId, UserId, status, totalPrice } = req.body;

    const response = await Order.create({
      ShopId,
      UserId,
      status,
      totalPrice,
    });
    const shop = await Shop.findOne({
      where: {
        id: ShopId,
      },
      include: [User],
    });
    const from = await User.findOne({
      where: {
        id: UserId,
      },
    });
    await sendFCMNotification({
      title: "You have a new order",
      body: `${from.name} has just placed an order.`,
      token: shop.User.token,
      data: { type: "order", orderId: String(response.id), to: "shop" },
    });
    await Notification.create({
      title: "You have a new order",
      message: `You have a new order from ${from.name}.`,
      userId: shop.User.id,
    });
    await sendSMS(
      shop.phone,
      `Dear ${shop.User.name},\nYou have a new order in your shop, ${shop.name} from ${from.name}. Open the app to view it.\n\nThank you.`
    );

    console.log(response);
    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const getOrders = async (req, res) => {
  try {
    const response = await Order.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      include: [User, Shop],
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
const getUserOrders = async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.query;
    console.log(status);

    if (status == "DELIVERED") {
      status = ["DELIVERED", "CLOSED"];
    } else if (status == "NEW ORDER") {
      status = ["NEW ORDER", "IN PROGRESS", "CONFIRMED", "DELIVERED", "CLOSED"];
    } else {
      status = [status];
    }
    const response = await Order.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [["updatedAt", "DESC"]],
      where: {
        UserId: id,
        status: {
          [Op.in]: status,
        },
      },
      include: [
        {
          model: OrderedProduct,
          include: [
            {
              required: true,
              model: Product,
              include: [Shop],
            },
          ],
        },
        {
          model: User,
          required: true,
        },
        {
          model: Shop,
          required: true,
        },
      ],
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (e) {
    console.log(e);
    errorResponse(res, e); // Pass the error object directly
  }
};
const getShopOrders = async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.query;
    if (status == "DELIVERED") {
      status = ["DELIVERED", "CLOSED"];
    } else {
      status = [status];
    }
    const response = await Order.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [["updatedAt", "DESC"]],
      where: {
        status: {
          [Op.in]: status,
        },
      },
      include: [
        {
          model: OrderedProduct,
          include: [
            {
              model: Product,
              where: {
                ShopId: id,
              },
              include: [Shop],
              required: true,
            },
          ],
        },
        User,
      ],
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await findOrderByID(id);
    successResponse(res, order);
  } catch (error) {
    errorResponse(res, error);
  }
};
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({
      where: {
        id: req.user.id,
      },
    });

    const payload = req.body;
    const order = await findOrderByID(id);
    if (payload.status == "IN PROGRESS") {
      await sendFCMNotification({
        title: `${order.User.name} confirmed the price`,
        body: `${order.User.name} has just confirmed the price after negotiation`,
        token: order.Shop.User.token,
        data: { type: "order", orderId: String(order.id), to: "shop" },
      });
      await Notification.create({
        title: "Order price confirmed",
        message: `${order.User.name} has just confirmed the price after negotiation.`,
        userId: order.Shop.User.id,
      });
    }

    if (payload.status == "CONFIRMED") {
      await sendFCMNotification({
        title: `Seller has confirmed the order`,
        body: `${order.Shop.name} seller has just confirmed your order`,
        token: order.User.token,
        data: { type: "order", orderId: String(order.id), to: "user" },
      });
      await Notification.create({
        title: "Order confirmed",
        message: `${order.Shop.name} seller has just confirmed your order.`,
        userId: order.User.id,
      });
    }

    if (payload.status == "CANCELED") {
      await sendFCMNotification({
        title: `Order cancellation`,
        body: `${user.name} has just canceled an order`,
        token: user.token,
        data: { type: "order", orderId: String(order.id), to: "shop" },
      });
      await Notification.create({
        title: "Order canceled",
        message: `${user.name} has just canceled an order.`,
        userId: order.Shop.User.id,
      });
    }
    if (payload.status == "DELIVERED") {
      await sendFCMNotification({
        title: `Order is delivered successfully`,
        body: `Your order is marked as delivered`,
        token: order.User.token,
        data: { type: "order", orderId: String(order.id), to: "user" },
      });
      await Notification.create({
        title: "Order delivered",
        message: `Your order is marked as delivered.`,
        userId: order.User.id,
      });
      const code = randomNumber(6);
      await order.update({ otp: code });
      await sendSMS(
        order.User.phone,
        `Dear ${order.User.name},\nYour order from ${order.Shop.name} has been marked as delivered. Please use the OTP code ${code} to confirm delivery of your order.\n\nThank you.`
      );
    }
    if (payload.status == "CLOSED") {
      //confirm otp
      if (payload.otp !== order.otp) {
        res.status(401).send({ status: false, message: "Invalid OTP" });
      } else {
        await sendFCMNotification({
          title: `Customer confirmed delivery`,
          body: `Customer has just confirmed that they got their order`,
          token: order.Shop.User.token,
          data: { type: "order", orderId: String(order.id), to: "shop" },
        });
        await Notification.create({
          title: "Order closed",
          message: `Customer has just confirmed that they got their order.`,
          userId: order.Shop.User.id,
        });
        await order.update({ otp: null }); //clear otp

        // Create POS sale record
        try {
          const receiptNumber = `ORD-${Date.now()}`;
          const orderedProducts = order.OrderedProducts;

          // Calculate totals
          const subtotal = orderedProducts.reduce(
            (sum, item) =>
              sum + parseFloat(item.Product.sellingPrice) * item.quantity,
            0
          );
          const total = parseFloat(order.totalPrice);
          const discount = subtotal - total;

          // Create POS Sale
          const posSale = await POSSale.create({
            receiptNumber,
            ShopId: order.ShopId,
            UserId: order.Shop.UserId, // Shop owner as cashier
            subtotal,
            discount,
            tax: 0,
            total,
            paymentMethod: "CASH", // Default for online orders
            paymentStatus: "PAID",
            amountPaid: total,
            amountChange: 0,
            customerId: order.UserId,
            customerName: order.User.name,
            customerPhone: order.User.phone,
            notes: `Online order #${order.id}`,
            status: "COMPLETED",
          });

          // Create POS Sale Items and Inventory Transactions
          for (const orderedProduct of orderedProducts) {
            const product = orderedProduct.Product;
            const quantity = orderedProduct.quantity;
            const unitPrice = parseFloat(product.sellingPrice);
            const itemTotal = unitPrice * quantity;

            // Create POS Sale Item
            await POSSaleItem.create({
              POSSaleId: posSale.id,
              ProductId: product.id,
              productName: product.name,
              productSKU: product.productSKU,
              quantity,
              unitPrice,
              discount: 0,
              tax: 0,
              subtotal: itemTotal,
              total: itemTotal,
              cost: parseFloat(product.buyingPrice || 0),
            });

            // Create Inventory Transaction
            const currentQuantity = product.productQuantity || 0;
            const newQuantity = currentQuantity - quantity;

            await InventoryTransaction.create({
              ProductId: product.id,
              ShopId: order.ShopId,
              UserId: order.UserId,
              transactionType: "SALE",
              quantityChange: -quantity,
              quantityBefore: currentQuantity,
              quantityAfter: newQuantity,
              reference: `Order #${order.id}`,
              notes: `Online order completed`,
              unitCost: parseFloat(product.buyingPrice || 0),
              totalCost: parseFloat(product.buyingPrice || 0) * quantity,
            });

            // Update product quantity
            await product.update({ productQuantity: newQuantity });
          }

          console.log(
            `Created POS sale ${receiptNumber} for order ${order.id}`
          );
        } catch (error) {
          console.error(
            "Error creating POS sale and inventory records:",
            error
          );
          // Don't fail the order closure if POS/inventory recording fails
        }
      }
    }
    const response = await order.update(payload);
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await findOrderByID(id);

    const response = await order.destroy();
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  findOrderByID,
  getOrders,
  addOrder,
  deleteOrder,
  getShopOrders,
  getUserOrders,
  addOrder,
  getOrder,
  updateOrder,
};
