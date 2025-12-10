const { ShopUser, Shop } = require("../../models");
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
    if (!name || !phone || !shopId) {
      return errorResponse(res, "Name, phone, and shopId are required");
    }

    // Check if user already exists for this shop
    const existingUser = await ShopUser.findOne({
      where: { phone, ShopId: shopId },
    });

    if (existingUser) {
      return errorResponse(
        res,
        "A user with this phone number already exists for this shop"
      );
    }

    // Create the shop user
    const shopUser = await ShopUser.create({
      name,
      phone,
      email,
      hasPOSAccess: hasPOSAccess || false,
      hasInventoryAccess: hasInventoryAccess || false,
      ShopId: shopId,
      status: "pending",
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

      const message = `Hello ${name}!\n\nYou've been invited to join ${shopName} on ExactOnline with ${accessText} access.\n\nDownload the Exact Online app play store or app store \n\nThank you!`;

      await sendSMS(phone, message);
      console.log(`Invitation SMS sent to ${phone}`);
    } catch (smsError) {
      console.error("Error sending invitation SMS:", smsError);
      // Don't fail the invitation if SMS fails
    }

    successResponse(res, shopUser);
  } catch (error) {
    console.error("Error inviting shop user:", error);
    errorResponse(res, error);
  }
};

// Update shop user details
const updateShopUser = async (req, res) => {
  try {
    const { shopId, userId } = req.params;
    const { name, phone, email, hasPOSAccess, hasInventoryAccess, status } =
      req.body;

    const shopUser = await ShopUser.findOne({
      where: { id: userId, ShopId: shopId },
    });

    if (!shopUser) {
      return errorResponse(res, "Shop user not found");
    }

    // Update fields if provided
    if (name !== undefined) shopUser.name = name;
    if (phone !== undefined) shopUser.phone = phone;
    if (email !== undefined) shopUser.email = email;
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

    successResponse(res, shopUser);
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
    });

    if (!shopUser) {
      return errorResponse(res, "Shop user not found");
    }

    // Update invitation timestamp
    shopUser.invitedAt = new Date();
    await shopUser.save();

    // In a real implementation, you would send an SMS/email here

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
