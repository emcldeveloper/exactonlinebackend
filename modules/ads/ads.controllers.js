const { Op } = require("sequelize");
const { Ad } = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { getUrl } = require("../../utils/get_url");

const findAdByID = async (id) => {
  try {
    const ad = await Ad.findOne({
      where: {
        id,
      },
    });
    return ad;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addAd = async (req, res) => {
  try {
    let { AdDimensionId, budget, ShopId, startDate, endDate } = req.body;
    const image = await getUrl(req);
    const response = await Ad.create({
      image,
      AdDimensionId,
      budget,
      ShopId,
      startDate,
      endDate,
    });
    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const getShopAds = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Ad.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        title: {
          [Op.like]: `%${req.keyword}%`,
        },
        ShopId,
      },
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

const getAds = async (req, res) => {
  try {
    const response = await Ad.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        title: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
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

const getAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await findAdByID(id);
    successResponse(res, ad);
  } catch (error) {
    errorResponse(res, error);
  }
};
const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await findAdByID(id);
    const response = await ad.update({
      ...req.body,
    });
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await findAdByID(id);
    const response = await ad.destroy();
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  findAdByID,
  getAds,
  addAd,
  deleteAd,
  getShopAds,
  addAd,
  getAd,
  updateAd,
};
