const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded", 400);
    }

    const fileUrl = getUrl(req, req.file.path);

    successResponse(res, {
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    errorResponse(res, error);
  }
};

const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, "No files uploaded", 400);
    }

    const files = req.files.map((file) => ({
      url: getUrl(req, file.path),
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));

    successResponse(res, { files });
  } catch (error) {
    console.error("Upload error:", error);
    errorResponse(res, error);
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
};
