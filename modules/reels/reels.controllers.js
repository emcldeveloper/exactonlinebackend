const { Op } = require("sequelize");
const {
  Reel,
  User,
  Shop,
  Sequelize,
  ShopFollower,
  ReelStat,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");
const { getVideoMetadata } = require("../../utils/get_video_metadata");

const addReel = async (req, res) => {
  try {
    let { caption, ShopId } = req.body;
    const videoUrl = await getUrl(req);
    const metadata = await getVideoMetadata(req);
    console.log(metadata);
    const response = await Reel.create({
      videoUrl,
      caption,
      duration: metadata.duration,
      thumbnail: metadata.thumbnail,
      ShopId,
    });
    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const getReels = async (req, res) => {
  try {
    const response = await Reel.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [["createdAt", "DESC"]],
      where: {
        caption: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      attributes: {
        include: [
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ReelStats"
                WHERE "ReelStats"."ReelId" = "Reel"."id"
                AND "ReelStats"."type" = 'like'
              )
            `),
            "likes", // Alias for total likes
          ],
        ],
      },
      include: [Shop],
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

const getShopReels = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);

    const response = await Reel.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        caption: {
          [Op.like]: `%${req.keyword}%`,
        },
        ShopId: id,
      },
      attributes: {
        include: [
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ReelStats"
                WHERE "ReelStats"."ReelId" = "Reel"."id"
                AND "ReelStats"."type" = 'like'
              )
            `),
            "likes", // Alias for total likes
          ],
        ],
      },
      include: [
        {
          model: Shop,
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

const getReel = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Step 1: Get the specific reel by ID
    const mainReel = await Reel.findOne({
      where: { id },
      include: [
        {
          model: ReelStat,
          where: {
            UserId: user.id,
            type: "like",
          },
          required: false,
        },
        {
          model: Shop,
          attributes: {
            include: [
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
              [
                Sequelize.literal(`
                  (
                    SELECT COUNT(*)
                    FROM "ReelStats"
                    WHERE "ReelStats"."ReelId" = "Reel"."id"
                    AND "ReelStats"."type" = 'like'
                  )
                `),
                "likes",
              ],
              [
                Sequelize.literal(`
                  EXISTS (
                    SELECT 1
                    FROM "ReelStats"
                    WHERE "ReelStats"."UserId" = '${user.id}'
                    AND "ReelStats"."ReelId" = "Reel"."id"
                    AND "ReelStats"."type" = 'like'
                  )
                `),
                "liked",
              ],
            ],
          },
          include: [
            {
              model: ShopFollower,
              where: { UserId: user.id },
              required: false,
            },
          ],
        },
      ],
    });

    // Step 2: Get other reels, excluding the one with the same ID
    const otherReels = await Reel.findAll({
      where: {
        id: {
          [Sequelize.Op.ne]: id, // not equal to the given id
        },
      },
      include: [
        {
          model: ReelStat,
          where: {
            UserId: user.id,
            type: "like",
          },
          required: false,
        },
        {
          model: Shop,
          attributes: {
            include: [
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
              [
                Sequelize.literal(`
                  (
                    SELECT COUNT(*)
                    FROM "ReelStats"
                    WHERE "ReelStats"."ReelId" = "Reel"."id"
                    AND "ReelStats"."type" = 'like'
                  )
                `),
                "likes",
              ],
              [
                Sequelize.literal(`
                  EXISTS (
                    SELECT 1
                    FROM "ReelStats"
                    WHERE "ReelStats"."UserId" = '${user.id}'
                    AND "ReelStats"."ReelId" = "Reel"."id"
                    AND "ReelStats"."type" = 'like'
                  )
                `),
                "liked",
              ],
            ],
          },
          include: [
            {
              model: ShopFollower,
              where: { UserId: user.id },
              required: false,
            },
          ],
        },
      ],
    });

    // Step 3: Combine and send
    const reels = mainReel ? [mainReel, ...otherReels] : otherReels;
    successResponse(res, reels);
  } catch (error) {
    errorResponse(res, error);
  }
};
const updateReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await findReelByID(id);
    const response = await reel.update({
      ...req.body,
    });
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const deleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await Reel.findByPk(id);
    const response = await reel.destroy();
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get trending reels based on likes and recent activity
 */
const getTrendingReels = async (req, res) => {
  try {
    const response = await Reel.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      order: [
        [Sequelize.literal('"likes"'), "DESC"],
        ["createdAt", "DESC"],
      ],
      where: {
        caption: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      attributes: {
        include: [
          [
            Sequelize.literal(`
              (
                SELECT COUNT(*)
                FROM "ReelStats"
                WHERE "ReelStats"."ReelId" = "Reel"."id"
                AND "ReelStats"."type" = 'like'
              )
            `),
            "likes",
          ],
        ],
      },
      include: [Shop],
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

module.exports = {
  getReels,
  addReel,
  getShopReels,
  deleteReel,
  addReel,
  getReel,
  updateReel,
  getTrendingReels,
};
