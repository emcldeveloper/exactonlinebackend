const { Router } = require("express");
const { validateJWT } = require("../../utils/validateJWT");
const { uploadFile, uploadMultipleFiles } = require("./upload.controllers");
const upload = require("../../utils/upload");

const router = Router();

router.post("/file", validateJWT, upload.single("file"), uploadFile);
router.post(
  "/files",
  validateJWT,
  upload.array("files", 10),
  uploadMultipleFiles,
);

module.exports = router;
