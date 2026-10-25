const express = require("express");
const router = express.Router();

const reorderController = require("../controllers/reorderController");

router.get("/", reorderController.checkReorderNeeded);

module.exports = router;