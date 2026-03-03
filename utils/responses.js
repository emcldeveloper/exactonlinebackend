const errorResponse = (res, error) => {
  const errorMessage = error.message || "Internal server error";
  const errorDetails = {
    message: errorMessage,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      name: error.name,
    }),
  };

  res.status(500).json({
    status: false,
    message: "Internal server error",
    error: errorDetails,
  });
  console.log(error);
};

const successResponse = (res, response, message = null, statusCode = 200) => {
  const responseData = {
    status: true,
    body: response,
  };

  if (message) {
    responseData.message = message;
  }

  res.status(statusCode).json(responseData);
};

module.exports = { errorResponse, successResponse };
