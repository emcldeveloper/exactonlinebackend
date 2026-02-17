const { Op, Sequelize } = require("sequelize");
const {
  Service,
  ServiceImage,
  ShopFollower,
  Shop,
  User,
} = require("../../models");
const { errorResponse, successResponse } = require("../../utils/responses");
const { invalidateServiceCaches } = require("../../utils/cache");

const findServiceByID = async (id) => {
  try {
    const service = await Service.findOne({
      where: {
        id,
      },
      include: [ServiceImage, Shop],
    });
    return service;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
const addService = async (req, res) => {
  try {
    let {
      name,
      price,
      serviceLink,
      description,
      CategoryId,
      ShopId,
      providerLinks,
      providerPhones,
      providerEmails,
      providerDocuments,
      providerAddress,
      yearsOfExperience,
      certifications,
      workingHours,
      serviceArea,
    } = req.body;

    const response = await Service.create({
      name,
      price,
      serviceLink,
      description,
      CategoryId,
      ShopId,
      providerLinks: providerLinks || [],
      providerPhones: providerPhones || [],
      providerEmails: providerEmails || [],
      providerDocuments: providerDocuments || [],
      providerAddress,
      yearsOfExperience,
      certifications: certifications || [],
      workingHours,
      serviceArea,
    });

    // Invalidate relevant caches
    await invalidateServiceCaches(response.id, ShopId, CategoryId);

    successResponse(res, response);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};
const getServices = async (req, res) => {
  try {
    const { category } = req.query;
    console.log(req.keyword);
    let filter = {
      name: {
        [Op.iLike]: `%${req.keyword ?? ""}%`,
      },
    };
    if (category && category != "All") {
      filter.CategoryId = category;
    }

    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: filter,
      include: [ServiceImage, Shop],
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
const getNewArrivalServices = async (req, res) => {
  try {
    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      order: [["createdAt", "DESC"]],
      include: [ServiceImage, Shop],
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
const getServiceSearch = async (req, res) => {
  try {
    const { keyword } = req.params;
    console.log(keyword);
    const response = await Service.findAll({
      where: {
        name: {
          [Op.iLike]: `%${keyword}%`,
        },
      },
    });
    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};
const getServicesForYou = async (req, res) => {
  try {
    const { id } = req.user;
    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      include: [ServiceImage, Shop],
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
const getPopularServices = async (req, res) => {
  try {
    const { id } = req.user;
    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
      },
      include: [ServiceImage, Shop],
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

const getShopServices = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
        ShopId: id,
      },
      include: [
        {
          model: ServiceImage,
          required: true,
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

const getRelatedServices = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await Service.findAndCountAll({
      limit: req.limit,
      offset: req.offset,
      where: {
        name: {
          [Op.like]: `%${req.keyword}%`,
        },
        id: {
          [Op.ne]: id,
        },
      },
      include: [ServiceImage],
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

const getService = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    let includes = [];
    if (user) {
      includes.push({
        model: ShopFollower,
        where: { UserId: user.id },
        required: false,
      });
    }
    let options = {
      where: {
        id,
      },
      include: [
        ServiceImage,
        {
          model: Shop,
          attributes: {
            include: user
              ? [
                  [
                    Sequelize.literal(`EXISTS (
                        SELECT 1
                        FROM "ShopFollowers"
                        WHERE "ShopFollowers"."UserId" = '${user.id}'
                        AND "ShopFollowers"."ShopId" = "Shop"."id")`),
                    "following",
                  ],
                ]
              : [[Sequelize.literal("false"), "following"]],
          },
          include: includes,
        },
      ],
    };
    const service = await Service.findOne(options);
    successResponse(res, service);
  } catch (error) {
    console.log(error);
    errorResponse(res, error);
  }
};

const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await findServiceByID(id);

    // Store values before update for cache invalidation
    const shopId = service.ShopId;
    const categoryId = service.CategoryId;

    const response = await service.update({
      ...req.body,
    });

    // Invalidate relevant caches
    await invalidateServiceCaches(id, shopId, categoryId);

    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await findServiceByID(id);

    // Store values before deletion for cache invalidation
    const shopId = service.ShopId;
    const categoryId = service.CategoryId;

    const response = await service.destroy();

    // Invalidate relevant caches
    await invalidateServiceCaches(id, shopId, categoryId);

    successResponse(res, response);
  } catch (error) {
    errorResponse(res, error);
  }
};

module.exports = {
  findServiceByID,
  getServices,
  addService,
  deleteService,
  getShopServices,
  getNewArrivalServices,
  getServicesForYou,
  getServiceSearch,
  addService,
  getRelatedServices,
  getPopularServices,
  getService,
  updateService,
};
