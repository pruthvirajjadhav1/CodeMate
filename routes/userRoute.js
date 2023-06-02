const express = require("express");
const multer = require("multer");
const {
  signup,
  login,
  uploadData,
  getExcelData,
  applyFormula,
  refreshToken,
} = require("../controller/userController");
const { isLoggedIn, customRole } = require("../middlewares/user");

const upload = multer();
const router = express.Router();

// User routes
router.route("/register").post(signup);

router.route("/login").post(login);

router
  .route("/userdashboard")
  .post(isLoggedIn, upload.single("file"), uploadData);

// Admin Routes
router
  .route("/admin/getdata")
  .get(isLoggedIn, customRole("admin"), getExcelData);

router
  .route("/admin/applyformula")
  .post(isLoggedIn, customRole("admin"), applyFormula);

// Token refresh route
router.route("/refresh-token").post(refreshToken);

module.exports = router;
