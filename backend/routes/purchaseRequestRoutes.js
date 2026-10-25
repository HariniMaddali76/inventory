const express = require("express");
const router = express.Router();

const purchaseRequestController = require("../controllers/purchaseRequestController");
const {
  authMiddleware,
  adminMiddleware
} = require("../middleware/authMiddleware");
router.post(
  "/",
  authMiddleware,
  purchaseRequestController.createPurchaseRequest
);

router.get(
  "/",
  authMiddleware,
  purchaseRequestController.getPurchaseRequests
);

router.patch(
  "/:id/status",
  authMiddleware,
  adminMiddleware,
  purchaseRequestController.updatePurchaseRequestStatus
);
router.patch(
  "/:id/received",
  authMiddleware,
  adminMiddleware,
  purchaseRequestController.markPurchaseRequestReceived
);
module.exports = router;