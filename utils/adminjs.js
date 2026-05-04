const db = require("../models");
const logger = require("./logger");

const childLogger = logger.child({ module: "AdminJS" });

const getSequelizeResources = () =>
  Object.values(db).filter(
    (resource) =>
      resource &&
      typeof resource === "function" &&
      typeof resource.getTableName === "function" &&
      resource.rawAttributes,
  );

const initializeAdminPanel = async (app) => {
  const [{ default: AdminJS }, adminExpressModule, adminSequelizeModule] =
    await Promise.all([
      import("adminjs"),
      import("@adminjs/express"),
      import("@adminjs/sequelize"),
    ]);

  const AdminJSExpress = adminExpressModule.default || adminExpressModule;
  const AdminJSSequelize = adminSequelizeModule.default || adminSequelizeModule;

  AdminJS.registerAdapter({
    Database: AdminJSSequelize.Database,
    Resource: AdminJSSequelize.Resource,
  });

  const resources = getSequelizeResources();

  const adminJs = new AdminJS({
    rootPath: "/admin",
    resources,
    branding: {
      companyName: "Exact Online Backend",
      softwareBrothers: false,
    },
  });

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    adminJs,
    {
      authenticate: async (email, password) => {
        if (
          email === process.env.ADMINJS_USERNAME &&
          password === process.env.ADMINJS_PASSWORD
        ) {
          return { email };
        }
        return null;
      },
      cookieName: "adminjs",
      cookiePassword: process.env.ADMINJS_SESSION_SECRET,
    },
    null,
    {
      secret: process.env.ADMINJS_SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
      name: "adminjs",
    },
  );

  app.use(adminJs.options.rootPath, adminRouter);

  childLogger.info("AdminJS initialized", {
    rootPath: adminJs.options.rootPath,
    resources: resources.length,
    authEnabled: true,
  });

  return adminJs;
};

module.exports = { initializeAdminPanel };
