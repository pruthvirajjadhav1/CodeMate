const User = require("../models/user");
const jwt = require("jsonwebtoken");

exports.isLoggedIn = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return next(new Error("Login first to reach the access page", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    console.log(err);
  }
};

exports.customRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new Error("You are not allowed to this resource.", 403));
    }
    next();
  };
};

// In this middleware we can get the userdata
