const express = require("express");
const router = express.Router();

const forecastController = require("../controllers/forecastController");

router.post("/", forecastController.forecastSales);

module.exports = router;