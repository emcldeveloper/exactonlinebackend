const errorResponse = (res, error) => {
  res.status(500).json({
    status: false,
    message: "Internal server error",
    error: error,
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
