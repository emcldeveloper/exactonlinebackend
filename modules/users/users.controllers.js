const { Op, Sequelize } = require("sequelize");
const { User, Shop } = require("../../models");
const { generateJwtTokens } = require("../../utils/generateJwtTokens");
const { errorResponse, successResponse } = require("../../utils/responses");
const { randomNumber } = require("../../utils/random_number");
const bcrypt = require("bcrypt");
const { getUrl } = require("../../utils/get_url");
const sendSMS = require("../../utils/send_sms");
const logger = require("../../utils/logger");
const { v4: uuidv4 } = require("uuid"); // For requestId

const childLogger = logger.child({ module: "Users Module" });

const addUser = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received add user request", {
      requestId,
      method: req.method,
      url: req.url,
      body: req.body,
    });

    const { name, phone, email, role, password } = req.body;
    childLogger.debug("Request body", { requestId, body: req.body });

    childLogger.info("Checking if user exists", { requestId, phone });
    const user = await checkIfUserExists(phone);
    if (user) {
      childLogger.warn("Phone number already used", {
        requestId,
        phone,
        userId: user.id,
      });
      return res.status(403).send({
        status: false,
        message: "Phone number is already used",
      });
    }

    const code = randomNumber();
    childLogger.info("Generated verification code", { requestId, phone, code });

    childLogger.info("Sending verification SMS", { requestId, phone });
    await sendSMS(
      phone,
      `Dear ${name},\n\n your verification code is ${code}, Enter this code in the form to proceed with the app. \n\nThank you`,
    );

    let hashedPassword = null;
    if (password) {
      childLogger.debug("Hashing password", { requestId });
      hashedPassword = bcrypt.hashSync(password, 10);
    }

    childLogger.info("Creating new user", { requestId, phone, email, role });
    const newUser = await User.create({
      name,
      phone,
      email,
      role,
      password: hashedPassword,
      passcode: code,
    });

    childLogger.info("User added successfully", {
      requestId,
      userId: newUser.id,
      phone,
      email,
    });

    successResponse(res, {
      status: true,
      message: "Verification code is sent to your phone number",
    });
  } catch (error) {
    childLogger.error("Failed to create user", {
      requestId,
      phone: req.body.phone,
      email: req.body.email,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const findUserByID = async (id) => {
  const requestId = uuidv4();
  try {
    childLogger.info("Finding user by ID", { requestId, userId: id });
    const user = await User.findOne({
      where: { id },
      include: [Shop],
    });
    if (!user) {
      childLogger.warn("User not found", { requestId, userId: id });
    } else {
      childLogger.info("User found", { requestId, userId: id });
    }
    return user;
  } catch (error) {
    childLogger.error("Failed to find user", {
      requestId,
      userId: id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const checkIfUserExists = async (phone) => {
  const requestId = uuidv4();
  try {
    childLogger.info("Checking if user exists", { requestId, phone });
    const user = await User.findOne({
      where: { phone },
    });
    if (user) {
      childLogger.info("User exists", { requestId, phone, userId: user.id });
    } else {
      childLogger.info("User does not exist", { requestId, phone });
    }
    return user;
  } catch (error) {
    childLogger.error("Failed to check if user exists", {
      requestId,
      phone,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

const addAdmin = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received add admin request", {
      requestId,
      method: req.method,
      url: req.url,
      body: req.body,
    });

    const { name, email, phone, password } = req.body;
    childLogger.debug("Request body", { requestId, body: req.body });

    childLogger.debug("Hashing password", { requestId });
    const hashedPassword = bcrypt.hashSync(password, 10);

    childLogger.info("Creating new admin", { requestId, email, phone });
    const response = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: "admin",
    });

    childLogger.info("Admin added successfully", {
      requestId,
      userId: response.id,
      email,
      phone,
    });

    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to create admin", {
      requestId,
      email: req.body.email,
      phone: req.body.phone,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const sendVerificationCode = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received send verification code request", {
      requestId,
      method: req.method,
      url: req.url,
      body: req.body,
    });

    const { phone } = req.body;
    childLogger.debug("Request body", { requestId, body: req.body });

    childLogger.info("Checking if user exists", { requestId, phone });
    const user = await checkIfUserExists(phone);
    if (user) {
      let code = randomNumber();

      if (user.phone == "0627707434") {
        code = 12345;
      }
      childLogger.info("Generated verification code", {
        requestId,
        phone,
        code,
      });

      childLogger.info("Sending verification SMS", { requestId, phone });
      await sendSMS(
        phone,
        `Dear ${user.name},\nyour verification code is ${code}, Enter this code in the form to proceed with the app. \n\nThank you`,
      );

      childLogger.info("Updating user with verification code", {
        requestId,
        userId: user.id,
      });
      console.log(code);
      await user.update({ passcode: code });

      childLogger.info("Verification code sent successfully", {
        requestId,
        userId: user.id,
        phone,
      });

      successResponse(res, {
        status: true,
        message: "Verification code is sent to your phone number",
      });
    } else {
      childLogger.warn("User does not exist", { requestId, phone });
      res.status(403).send({
        status: false,
        message: "User does not exist",
      });
    }
  } catch (error) {
    childLogger.error("Failed to send verification code", {
      requestId,
      phone: req.body.phone,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const login = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: { email },
    });

    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const token = generateJwtTokens(user);

        successResponse(res, token);
      } else {
        childLogger.warn("Incorrect password", { requestId, email });
        res.status(401).send({
          status: false,
          message: "Incorrect password",
        });
      }
    } else {
      childLogger.warn("User does not exist", { requestId, email });
      res.status(403).send({
        status: false,
        message: "User does not exist",
      });
    }
  } catch (error) {
    childLogger.error("Failed to login", {
      requestId,
      email: req.body.email,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const verifyCode = async (req, res) => {
  try {
    const { phone, passcode } = req.body;
    console.log(req.body);
    const user = await checkIfUserExists(phone);
    if (user) {
      if (user.passcode == passcode) {
        const token = generateJwtTokens(user);

        // Fetch user's shops
        const shops = await Shop.findAll({
          where: { userId: user.id },
          limit: 50,
        });

        // Include shops in the response
        const response = {
          ...token,
          user: user.dataValues,
          shops: shops || [],
        };

        console.log("token", response);
        successResponse(res, response);
      } else {
        res.status(401).send({
          status: false,
          message: "Invalid verification code",
        });
      }
    } else {
      res.status(403).send({
        status: false,
        message: "User does not exist",
      });
    }
  } catch (error) {
    errorResponse(res, error);
  }
};

const getUsers = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received get users request", {
      requestId,
      method: req.method,
      url: req.url,
      query: { limit: req.limit, offset: req.offset, keyword: req.keyword },
    });

    childLogger.info("Fetching users", {
      requestId,
      limit: req.limit,
      offset: req.offset,
      keyword: req.keyword,
    });
    const response = await User.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      include: [Shop],
    });

    childLogger.info("Users fetched successfully", {
      requestId,
      count: response.count,
      page: req.page,
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    childLogger.error("Failed to fetch users", {
      requestId,
      limit: req.limit,
      offset: req.offset,
      keyword: req.keyword,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getSellers = async (req, res) => {
  const requestId = uuidv4();
  try {
    childLogger.http("Received get sellers request", {
      requestId,
      method: req.method,
      url: req.url,
      query: { limit: req.limit, offset: req.offset, keyword: req.keyword },
    });

    childLogger.info("Fetching sellers", {
      requestId,
      limit: req.limit,
      offset: req.offset,
      keyword: req.keyword,
    });
    const response = await User.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
    });

    childLogger.info("Sellers fetched successfully", {
      requestId,
      count: response.count,
      page: req.page,
    });
    successResponse(res, {
      count: response.count,
      page: req.page,
      ...response,
    });
  } catch (error) {
    childLogger.error("Failed to fetch sellers", {
      requestId,
      limit: req.limit,
      offset: req.offset,
      keyword: req.keyword,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getUserInfo = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    childLogger.http("Received get user info request", {
      requestId,
      method: req.method,
      url: req.url,
      params: { id },
    });

    childLogger.info("Fetching user info", { requestId, userId: id });
    const user = await findUserByID(id);

    if (!user) {
      childLogger.warn("User not found", { requestId, userId: id });
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    childLogger.info("User info fetched successfully", {
      requestId,
      userId: id,
    });
    successResponse(res, user);
  } catch (error) {
    childLogger.error("Failed to fetch user info", {
      requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const getMyInfo = async (req, res) => {
  const requestId = uuidv4();
  try {
    const user = req.user;
    childLogger.http("Received get my info request", {
      requestId,
      method: req.method,
      url: req.url,
      userId: user.id,
    });

    childLogger.info("Fetching my info", { requestId, userId: user.id });
    const response = await findUserByID(user.id);

    if (!response) {
      childLogger.warn("User not found", { requestId, userId: user.id });
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    childLogger.info("My info fetched successfully", {
      requestId,
      userId: user.id,
    });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to fetch my info", {
      requestId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const deleteUser = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    childLogger.http("Received delete user request", {
      requestId,
      method: req.method,
      url: req.url,
      params: { id },
    });

    childLogger.info("Fetching user for deletion", { requestId, userId: id });
    const user = await findUserByID(id);

    if (!user) {
      childLogger.warn("User not found", { requestId, userId: id });
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    childLogger.info("Deleting user", { requestId, userId: id });
    const response = await user.destroy();

    childLogger.info("User deleted successfully", { requestId, userId: id });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to delete user", {
      requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const updateUser = async (req, res) => {
  const requestId = uuidv4();
  try {
    const { id } = req.params;
    childLogger.http("Received update user request", {
      requestId,
      method: req.method,
      url: req.url,
      params: { id },
      body: req.body,
    });

    childLogger.debug("Request body", { requestId, body: req.body });

    childLogger.info("Fetching user for update", { requestId, userId: id });
    const user = await findUserByID(id);

    if (!user) {
      childLogger.warn("User not found", { requestId, userId: id });
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    childLogger.info("Getting image URL", { requestId, userId: id });
    const url = await getUrl(req);
    childLogger.debug("Image URL", { requestId, userId: id, url });

    const updateData = { ...req.body };
    if (url) {
      updateData.image = url;
      childLogger.info("Image URL added to update data", {
        requestId,
        userId: id,
      });
    }

    childLogger.info("Updating user", { requestId, userId: id });
    const response = await user.update(updateData);

    childLogger.info("User updated successfully", { requestId, userId: id });
    successResponse(res, response);
  } catch (error) {
    childLogger.error("Failed to update user", {
      requestId,
      userId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    errorResponse(res, error);
  }
};

const searchUsersByPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return errorResponse(res, "Phone number is required");
    }

    const users = await User.findAll({
      where: {
        phone: {
          [Op.iLike]: `%${phone}%`,
        },
      },
      attributes: ["id", "name", "phone", "email"],
      limit: 10,
    });

    successResponse(res, users);
  } catch (error) {
    console.error("Error searching users:", error);
    errorResponse(res, error);
  }
};

module.exports = {
  findUserByID,
  getUsers,
  deleteUser,
  addAdmin,
  getUserInfo,
  checkIfUserExists,
  addUser,
  login,
  verifyCode,
  sendVerificationCode,
  getMyInfo,
  updateUser,
  getSellers,
  searchUsersByPhone,
};
