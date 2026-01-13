const { Router } = require("express");
const { validateJWT } = require("../../utils/validateJWT");
const {
  getUsers,
  getMyInfo,
  getUserInfo,
  updateUser,
  deleteUser,
  addUser,
  verifyCode,
  sendVerificationCode,
  login,
  addAdmin,
  searchUsersByPhone,
} = require("./users.controllers");
const { getPagination } = require("../../utils/getPagination");
const upload = require("../../utils/upload");

const router = Router();

router.post("/", addUser);
router.post("/admin", addAdmin);
router.post("/auth/send-code", sendVerificationCode);
router.post("/auth/verify-code", verifyCode);
router.post("/auth/login", login);
router.get("/", validateJWT, getPagination, getUsers);
router.get("/search", validateJWT, searchUsersByPhone);
router.get("/me", validateJWT, getMyInfo);
router.get("/:id", validateJWT, getUserInfo);
router.patch("/:id", upload.single("file"), validateJWT, updateUser);
router.delete("/:id", validateJWT, deleteUser);

module.exports = router;
