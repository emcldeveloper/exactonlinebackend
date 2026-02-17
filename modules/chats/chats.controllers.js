const { Op } = require("sequelize");
const {
  Chat,
  Shop,
  User,
  Topic,
  Message,
  Sequelize,
  Product,
  ProductImage,
  Service,
  ServiceImage,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");

const findChatByID = async (id) => {
  try {
    const chat = await Chat.findOne({
      where: {
        id,
      },
      include: [Shop, User],
    });
    return chat;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addChat = async (req, res, next) => {
  try {
    let { ShopId, UserId } = req.body;

    let chat = await Chat.findOne({
      where: {
        ShopId,
        UserId,
      },
      include: [Shop, User],
    });

    // If no chat was found, you can handle it by creating a new one (optional)
    if (!chat) {
      chat = await Chat.create({
        ShopId,
        UserId,
      });
      chat = await findChatByID(chat.id);
    }
    req.body.ChatId = chat.id;
    next();
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getChats = async (req, res) => {
  try {
    const response = await Chat.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
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
const getUserChats = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Chat.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [
        // Reference the alias defined in attributes
        [Sequelize.col('"lastMessageDatetime"'), "DESC", "NULLS LAST"],
      ],
      attributes: {
        include: [
          [
            Sequelize.literal(`(
              SELECT COUNT(*)
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              AND "Messages"."delivered" = false
              AND "Messages"."from" = 'shop'
            )`),
            "unreadMessages",
          ],
          [
            Sequelize.literal(`(
              SELECT "message"
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              ORDER BY "Messages"."createdAt" DESC
              LIMIT 1
            )`),
            "lastMessage",
          ],
          [
            Sequelize.literal(`(
              SELECT "createdAt"
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              ORDER BY "Messages"."createdAt" DESC
              LIMIT 1
            )`),
            "lastMessageDatetime",
          ],
        ],
      },
      where: {
        UserId: id,
      },
      include: [
        {
          model: User,
          required: true,
        },
        {
          model: Shop,
          required: true,
        },
        {
          model: Topic,
          include: [
            {
              model: Message,
              limit: 1,
              order: [["createdAt", "DESC"]],
              attributes: ["message"],
            },
            {
              model: Product,
              include: [
                {
                  model: ProductImage,
                  limit: 1,
                },
              ],
            },
            {
              model: Service,
              include: [
                {
                  model: ServiceImage,
                  limit: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    successResponse(res, {
      count: response.count,
      page: req.page,
      rows: response.rows,
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

const getShopChats = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    const response = await Chat.findAndCountAll({
      order: [
        // Reference the alias defined in attributes
        [Sequelize.col('"lastMessageDatetime"'), "DESC", "NULLS LAST"],
      ],
      limit: req.limit,
      offset: req.offset,
      where: {
        ShopId: id,
      },
      attributes: {
        include: [
          [
            Sequelize.literal(`(
              SELECT COUNT(*)
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              AND "Messages"."delivered" = false
              AND "Messages"."from" = 'user'
            )`),
            "unreadMessages",
          ],
          [
            Sequelize.literal(`(
              SELECT "message"
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              ORDER BY "Messages"."createdAt" DESC
              LIMIT 1
            )`),
            "lastMessage",
          ],
          [
            Sequelize.literal(`(
              SELECT "createdAt"
              FROM "Messages"
              WHERE "Messages"."TopicId" IN (
                SELECT "id"
                FROM "Topics"
                WHERE "Topics"."ChatId" = "Chat"."id"
              )
              ORDER BY "Messages"."createdAt" DESC
              LIMIT 1
            )`),
            "lastMessageDatetime",
          ],
        ],
      },
      include: [
        {
          model: User,
          required: true,
        },
        {
          model: Shop,
          required: true,
        },
        {
          model: Topic,
          include: [
            {
              model: Message,
              limit: 1,
              order: [["createdAt", "DESC"]],
              attributes: ["message"],
            },
          ],
        },
      ],
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
const getChat = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await findChatByID(id);
    successResponse(res, chat);
  } catch (error) {
    errorResponse(res, error);
  }
};
const updateChat = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await findChatByID(id);
    const response = await chat.update({
      ...req.body,
    });
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await findChatByID(id);
    const response = await chat.destroy();
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  findChatByID,
  getChats,
  addChat,
  getUserChats,
  getShopChats,
  deleteChat,
  addChat,
  getChat,
  updateChat,
};
