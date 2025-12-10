const { Router } = require("express");
const { validateJWT } = require("../../utils/validateJWT");
const {
  getShopUsers,
  inviteShopUser,
  updateShopUser,
  removeShopUser,
  resendInvitation,
} = require("./shopUsers.controllers");

const router = Router();

// Get all users for a shop
router.get("/shops/:shopId/users", validateJWT, getShopUsers);

// Invite a new user (also handles /user-invitations endpoint)
router.post("/user-invitations", validateJWT, inviteShopUser);
router.post("/shops/:shopId/users", validateJWT, inviteShopUser);

// Update shop user
router.patch("/shops/:shopId/users/:userId", validateJWT, updateShopUser);

// Remove shop user
router.delete("/shops/:shopId/users/:userId", validateJWT, removeShopUser);

// Resend invitation
router.post(
  "/shops/:shopId/users/:userId/resend",
  validateJWT,
  resendInvitation
);

module.exports = router;
