const User = require("../models/user");
const cookieToken = require("../utils/cookieToken");
const serviceAccount = require("../path/to/serviceAccountKey.json");

const admin = require("firebase-admin");
const crypto = require("crypto");
const ExcelJS = require("exceljs");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DB_FIREBASE_URL,
});

const db = admin.firestore();

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !name || !password) {
      return next(new Error("Name, Email, and password is required"));
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    cookieToken(user, res);
  } catch (err) {
    console.log(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    // check if the user is giving both
    if (!email || !password) {
      return next(new Error("Please provide email and password"));
    }

    const user = await User.findOne({ email }).select("+password");

    // check if user is in DB
    if (!user) {
      return next(new Error("This user is not in the DB kindely signup"));
    }

    const isPasswordCorrect = await user.isValidatedPassword(password);

    // check if password is correct
    if (!isPasswordCorrect) {
      return next(new Error("Password is incorrect"));
    }

    cookieToken(user, res);
  } catch (err) {
    console.log(err);
  }
};

exports.uploadData = async (req, res, next) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Check the file format
    if (
      req.file.mimetype !== "application/vnd.ms-excel" &&
      req.file.mimetype !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    // Generate a unique filename
    const filename = `${Date.now()}_${req.file.originalname}`;

    // Create a file reference in Firebase storage
    const file = bucket.file(filename);

    // Create the upload stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Handle any errors during the upload
    stream.on("error", (err) => {
      console.error("Error uploading file:", err);
      res.status(500).json({ error: "Failed to upload file" });
    });

    // Handle the successful upload
    stream.on("finish", async () => {
      // Store the file information in Firebase Realtime Database or Firestore
      const userId = req.user._id;
      const fileData = {
        filename: filename,
        userId: userId,
        uploadedAt: new Date().toISOString(),
      };

      // Store the file data in Firestore
      await db.collection("files").doc(filename).set(fileData);

      res.status(200).json({ message: "File uploaded successfully" });
    });

    // Start the upload
    stream.end(req.file.buffer);
  } catch (err) {
    console.log(err);
  }
};

exports.getExcelData = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Retrieve the file information from Firestore
    const fileSnapshot = await db
      .collection("files")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileData = fileSnapshot.docs[0].data();
    const filename = fileData.filename;

    const file = bucket.file(`${userId}/${filename}`);

    const tempFilePath = `/tmp/${filename}`;
    await file.download({ destination: tempFilePath });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);

    const worksheet = workbook.worksheets[0];

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell((cell, colNumber) => {
        rowData.push(cell.value);
      });
      rows.push(rowData);
    });

    res.status(200).json({ data: rows });
  } catch (err) {
    console.log(err);
  }
};

exports.applyFormula = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { selectedColumn, selectedRow, formula } = req.body;

    const fileSnapshot = await db
      .collection("files")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileData = fileSnapshot.docs[0].data();
    const filename = fileData.filename;

    const file = bucket.file(`${userId}/${filename}`);

    const tempFilePath = `/tmp/${filename}`;
    await file.download({ destination: tempFilePath });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);

    const worksheet = workbook.worksheets[0];

    const cell = worksheet.getCell(selectedColumn + selectedRow);
    cell.value = { formula: formula };

    await workbook.calcProperties.fullCalcOnLoad;

    const updatedFile = bucket.file(`${userId}/updated_${filename}`);
    await workbook.xlsx.writeFile(updatedFile.name);

    const downloadURL = await updatedFile.getSignedUrl({
      action: "read",
      expires: "01-01-2025",
    });

    res.status(200).json({ downloadURL });
  } catch (err) {
    console.log(err);
  }
};
