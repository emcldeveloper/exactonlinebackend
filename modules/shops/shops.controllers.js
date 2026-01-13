const { Op, fn, Sequelize } = require("sequelize");
const {
  Shop,
  ShopCalender,
  ShopSubscription,
  ShopDocument,
  ShopView,
  Subscription,
  ShopFollower,
  ShopUser,
  User,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");
const { Fn } = require("sequelize/lib/utils");
const moment = require("moment");
const { subscribe } = require("./shops.routes");
const sendSMS = require("../../utils/send_sms");
const { randomNumber } = require("../../utils/random_number");
const addPrefixToPhoneNumber = require("../../utils/add_number_prefix");

const findShopByID = async (id) => {
  try {
    const shop = await Shop.findOne({
      where: {
        id,
      },
      include: [ShopCalender, ShopSubscription, ShopView],
    });
    return shop;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addShop = async (req, res) => {
  try {
    let { registeredBy, name, phone, address, description, UserId } = req.body;
    console.log(req.body);
    const response = await Shop.create({
      registeredBy,
      name,
      phone,
      address,
      description,
      UserId: UserId,
    });
    //find first subscription and add it to shop
    const subscription = await Subscription.findOne({
      where: {
        id: {
          [Op.ne]: 0,
        },
      },
    });
    await ShopSubscription.create({
      ShopId: response.id,
      SubscriptionId: subscription.id,
    });
    await sendSMS(
      "0715800430",
      `Hello Admin,\n A new shop has been created with name: ${response.name} and needs verificaion to proceed, please help. \n\nThank you`
    );
    await sendSMS(
      "0677975251",
      `Hello Admin,\n A new shop has been created with name: ${response.name} and needs verificaion to proceed, please help. \n\nThank you`
    );
    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const getShops = async (req, res) => {
  try {
    const response = await Shop.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      include: [ShopDocument, ShopFollower],
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

const getUserShops = async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the user's phone number
    const user = await User.findByPk(id);
    if (!user) {
      return errorResponse(res, { message: "User not found" }, 404);
    }

    console.log("Getting shops for user:", { id, phone: user.phone });

    // Get shops where user is the owner
    const ownedShops = await Shop.findAll({
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
        UserId: id,
      },
      include: [ShopCalender, ShopSubscription],
    });

    console.log("Owned shops found:", ownedShops.length);

    // Get shops where user is an invited shop user (active status)
    const invitedShops = await Shop.findAll({
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      include: [
        {
          model: ShopUser,
          where: {
            phone: user.phone,
            status: "active",
          },
          required: true,
          as: "ShopUsers",
        },
        ShopCalender,
        ShopSubscription,
      ],
    });

    console.log("Invited shops found:", invitedShops.length);

    // Combine and deduplicate shops
    const allShopsMap = new Map();

    ownedShops.forEach((shop) => {
      const shopData = shop.toJSON();
      allShopsMap.set(shop.id, {
        ...shopData,
        userRole: "owner",
        permissions: {
          hasPOSAccess: true,
          hasInventoryAccess: true,
          isOwner: true,
        },
      });
    });

    invitedShops.forEach((shop) => {
      const shopData = shop.toJSON();
      const shopUser = shopData.ShopUsers[0];
      if (!allShopsMap.has(shop.id)) {
        allShopsMap.set(shop.id, {
          ...shopData,
          userRole: "staff",
          permissions: {
            hasPOSAccess: shopUser.hasPOSAccess,
            hasInventoryAccess: shopUser.hasInventoryAccess,
            isOwner: false,
          },
        });
      }
    });

    const allShops = Array.from(allShopsMap.values());

    console.log("Total shops after combining:", allShops.length);

    // Apply pagination
    const startIndex = req.offset || 0;
    const endIndex = startIndex + (req.limit || 10);
    const paginatedShops = allShops.slice(startIndex, endIndex);

    successResponse(res, {
      count: allShops.length,
      page: req.page,
      rows: paginatedShops,
    });
  } catch (error) {
    console.error("Error in getUserShops:", error);
    errorResponse(res, error);
  }
};
const getUserShopFollowings = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Shop.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      attributes: {
        include: [
          [
            Sequelize.literal(
              `(SELECT COUNT(*) 
              FROM "ShopFollowers"
              WHERE "ShopFollowers"."ShopId" = "Shop"."id")`
            ),
            "followers", // Alias for the count of followers
          ],
        ],
      },
      include: [
        {
          model: ShopFollower,
          attributes: [],
          where: {
            UserId: id,
          },
          required: true, // Ensures that only shops with followings are returned
        },
      ],
      group: ["Shop.id"], // Group by Shop ID to get followers per shop
    });

    // Fix for count: it should be a single number, not an array
    const count = response.count; // You can use this value directly, it's the total number of shops
    const rows = response.rows.map((shop) => ({
      ...shop.dataValues,
      followers: parseInt(shop.dataValues.followers, 10), // Parse followers as integer
    }));

    successResponse(res, {
      count, // Total number of shops
      page: req.page,
      rows, // Properly formatted rows
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

const getShop = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(id);
    const shop = await Shop.findOne({
      where: {
        id,
      },

      attributes: {
        include: [
          [
            Sequelize.literal(
              `(EXISTS (
                SELECT 1
                FROM "ShopSubscriptions"
                WHERE "ShopSubscriptions"."ShopId" = "Shop"."id"
                AND "ShopSubscriptions"."expireDate" > NOW() 
              ))`
            ),
            "isSubscribed",
          ],
          [
            Sequelize.literal(
              `(SELECT COUNT(*) 
              FROM "ShopFollowers"
              WHERE "ShopFollowers"."ShopId" = "Shop"."id")`
            ),
            "followers", // Alias for the count of followers
          ],
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ProductStats"
                JOIN "Products" ON "Products"."id" = "ProductStats"."ProductId"
                WHERE "Products"."ShopId" = "Shop"."id"
                AND "ProductStats"."type" = 'view'
              )
            `),
            "impressions",
          ],
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ProductStats"
                JOIN "Products" ON "Products"."id" = "ProductStats"."ProductId"
                WHERE "Products"."ShopId" = "Shop"."id"
                AND "ProductStats"."type" = 'share'
              )
            `),
            "shares",
          ],
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ProductStats"
                JOIN "Products" ON "Products"."id" = "ProductStats"."ProductId"
                WHERE "Products"."ShopId" = "Shop"."id"
                AND "ProductStats"."type" = 'call'
              )
            `),
            "calls",
          ],
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ShopViews"
                WHERE "ShopViews"."ShopId" = "Shop"."id"
              )
            `),
            "profileViews",
          ],
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ReelStats"
                JOIN "Reels" ON "Reels"."id" = "ReelStats"."ReelId"
                WHERE "Reels"."ShopId" = "Shop"."id"
                AND "ReelStats"."type" = 'like'
              )
            `),
            "reelLikes",
          ],
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
        ShopCalender,
        {
          model: ShopSubscription,
          include: [Subscription],
          where: {
            expireDate: {
              [Op.gt]: Date.now(),
            },
          },
          required: false,
        },
        ShopView,
      ],
    });
    successResponse(res, shop);
  } catch (error) {
    errorResponse(res, error);
  }
};
const resetShopPassword = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await findShopByID(id);
    if (!shop) {
      throw new Error("Shop not found");
    }

    const password = randomNumber();
    const response = await shop.update({
      password,
    });
    await sendSMS(
      shop.phone,
      `Hello ${shop.name},\n Your shop password has been reset to ${password}. Please use this password to log in and consider changing it after logging in for security purposes.\n\nThank you`
    );
    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id, req.body);
    const shop = await findShopByID(id);

    let url = await getUrl(req);
    console.log(url, req.body);
    if (url) {
      req.body.shopImage = url;
    }
    const response = await shop.update({
      ...req.body,
    });
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

const deleteShop = async (req, res) => {
  try {
    const { id } = req.params;
    const shop = await findShopByID(id);
    const response = await shop.destroy();
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  findShopByID,
  getShops,
  addShop,
  deleteShop,
  getUserShopFollowings,
  addShop,
  resetShopPassword,
  getShop,
  getUserShops,
  updateShop,
};
