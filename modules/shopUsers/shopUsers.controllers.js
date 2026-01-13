const { ShopUser, Shop, User } = require("../../models");
const { successResponse, errorResponse } = require("../../utils/responses");
const sendSMS = require("../../utils/send_sms");

// Get all users for a specific shop
const getShopUsers = async (req, res) => {
  try {
    const { shopId } = req.params;

    const users = await ShopUser.findAll({
      where: { ShopId: shopId },
      include: [
        {
          model: Shop,
          attributes: ["id", "name"],
        },
        {
          model: User,
          attributes: ["id", "name", "phone", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    successResponse(res, users);
  } catch (error) {
    console.error("Error getting shop users:", error);
    errorResponse(res, error);
  }
};

// Invite a new user to the shop
const inviteShopUser = async (req, res) => {
  try {
    const { name, phone, email, hasPOSAccess, hasInventoryAccess, shopId } =
      req.body;

    // Validate required fields
    if (!phone || !shopId) {
      return errorResponse(res, "phone and shopId are required");
    }

    if (!name) {
      return errorResponse(res, "name is required");
    }

    // Search for existing user by phone
    let user = await User.findOne({
      where: { phone: phone },
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await User.create({
        name: name,
        phone: phone,
        email: email || null,
        // Set default values for required fields
        password: Math.random().toString(36).substring(7), // Random password, user will need to reset
        isEmailVerified: false,
        isPhoneVerified: false,
      });
      console.log(`Created new user: ${user.id} for phone ${phone}`);
    }

    // Check if user already exists for this shop
    const existingShopUser = await ShopUser.findOne({
      where: { UserId: user.id, ShopId: shopId },
    });

    if (existingShopUser) {
      return errorResponse(res, "This user is already a member of this shop");
    }

    // Create the shop user
    const shopUser = await ShopUser.create({
      UserId: user.id,
      hasPOSAccess: hasPOSAccess || false,
      hasInventoryAccess: hasInventoryAccess || false,
      ShopId: shopId,
      status: "active",
      activatedAt: new Date(),
    });

    // Get shop details for the invitation message
    const shop = await Shop.findByPk(shopId);
    const shopName = shop ? shop.name : "the shop";

    // Send invitation SMS
    try {
      const accessTypes = [];
      if (hasPOSAccess) accessTypes.push("POS");
      if (hasInventoryAccess) accessTypes.push("Inventory");
      const accessText =
        accessTypes.length > 0 ? accessTypes.join(" & ") : "system";

      const message = `Hello ${user.name}!\n\nYou've been added to ${shopName} on ExactOnline with ${accessText} access.\n\nYou can now access this shop in the Exact Online app.\n\nThank you!`;

      await sendSMS(user.phone, message);
      console.log(`Notification SMS sent to ${user.phone}`);
    } catch (smsError) {
      console.error("Error sending notification SMS:", smsError);
      // Don't fail the invitation if SMS fails
    }

    // Return the shop user with user details
    const shopUserWithDetails = await ShopUser.findByPk(shopUser.id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "phone", "email"],
        },
      ],
    });

    successResponse(res, shopUserWithDetails);
  } catch (error) {
    console.error("Error inviting shop user:", error);
    errorResponse(res, error);
  }
};

// Update shop user details
const updateShopUser = async (req, res) => {
  try {
    const { shopId, userId } = req.params;
    const { hasPOSAccess, hasInventoryAccess, status } = req.body;

    const shopUser = await ShopUser.findOne({
      where: { id: userId, ShopId: shopId },
    });

    if (!shopUser) {
      return errorResponse(res, "Shop user not found");
    }

    // Update fields if provided
    if (hasPOSAccess !== undefined) shopUser.hasPOSAccess = hasPOSAccess;
    if (hasInventoryAccess !== undefined)
      shopUser.hasInventoryAccess = hasInventoryAccess;
    if (status !== undefined) {
      shopUser.status = status;
      if (status === "active" && !shopUser.activatedAt) {
        shopUser.activatedAt = new Date();
      }
    }

    await shopUser.save();

    // Return with user details
    const shopUserWithDetails = await ShopUser.findByPk(shopUser.id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "phone", "email"],
        },
      ],
    });

    successResponse(res, shopUserWithDetails);
  } catch (error) {
    console.error("Error updating shop user:", error);
    errorResponse(res, error);
  }
};

// Remove a user from the shop
const removeShopUser = async (req, res) => {
  try {
    const { shopId, userId } = req.params;

    const shopUser = await ShopUser.findOne({
      where: { id: userId, ShopId: shopId },
    });

    if (!shopUser) {
      return errorResponse(res, "Shop user not found");
    }

    await shopUser.destroy();

    successResponse(res, { message: "Shop user removed successfully" });
  } catch (error) {
    console.error("Error removing shop user:", error);
    errorResponse(res, error);
  }
};

// Resend invitation
const resendInvitation = async (req, res) => {
  try {
    const { shopId, userId } = req.params;

    const shopUser = await ShopUser.findOne({
      where: { id: userId, ShopId: shopId },
      include: [
        {
          model: User,
          attributes: ["id", "name", "phone"],
        },
      ],
    });

    if (!shopUser) {
      return errorResponse(res, "Shop user not found");
    }

    // Update invitation timestamp
    shopUser.invitedAt = new Date();
    await shopUser.save();

    // Get shop details
    const shop = await Shop.findByPk(shopId);
    const shopName = shop ? shop.name : "the shop";

    // Send SMS notification
    try {
      const accessTypes = [];
      if (shopUser.hasPOSAccess) accessTypes.push("POS");
      if (shopUser.hasInventoryAccess) accessTypes.push("Inventory");
      const accessText =
        accessTypes.length > 0 ? accessTypes.join(" & ") : "system";

      const message = `Hello ${shopUser.User.name}!\n\nReminder: You have access to ${shopName} on ExactOnline with ${accessText} access.\n\nOpen the Exact Online app to get started.\n\nThank you!`;

      await sendSMS(shopUser.User.phone, message);
      console.log(`Reminder SMS sent to ${shopUser.User.phone}`);
    } catch (smsError) {
      console.error("Error sending reminder SMS:", smsError);
    }

    successResponse(res, shopUser);
  } catch (error) {
    console.error("Error resending invitation:", error);
    errorResponse(res, error);
  }
};

module.exports = {
  getShopUsers,
  inviteShopUser,
  updateShopUser,
  removeShopUser,
  resendInvitation,
};
