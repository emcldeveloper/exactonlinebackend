require("dotenv").config();
const winston = require("winston");

const consoleLogFormat = winston.format.printf(
  ({ timestamp, level, message, stack, ...meta }) => {
    const metadata = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const errorStack = stack ? `\n${stack}` : "";
    return `${timestamp} ${level}: ${message}${metadata}${errorStack}`;
  },
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    consoleLogFormat,
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
