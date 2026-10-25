const express = require("express");
const router = express.Router();

const salesController = require("../controllers/salesController");

// Create a sale
router.post("/", salesController.createSale);

// Get all sales
router.get("/", salesController.getSales);

// Get sale by ID
router.get("/:id", salesController.getSaleById);

module.exports = router;