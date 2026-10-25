const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();
const uploadController = require("../controllers/uploadController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if ([".csv", ".xlsx"].includes(ext)) {
      return cb(null, true);
    }

    const error = new Error(
      "Only CSV and .xlsx files are allowed"
    );
    error.status = 400;
    cb(error);
  },
});

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      const isMulterError = error instanceof multer.MulterError;

      return res.status(400).json({
        success: false,
        message: isMulterError
          ? error.code === "LIMIT_FILE_SIZE"
            ? "File size must not exceed 5 MB"
            : "Invalid file upload"
          : error.message,
      });
    }

    next();
  });
}, uploadController.uploadInventoryFile);

module.exports = router;