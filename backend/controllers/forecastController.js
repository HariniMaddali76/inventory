const mongoose = require("mongoose");
const Sale = require("../models/sales");
const Product = require("../models/product");
const PurchaseRequest = require("../models/purchaseRequest");

const forecastSales = async (req, res) => {
  try {
    const { productId, createPurchaseRequest = false } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid productId",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const salesRecords = await Sale.find({
      product: productId,
    }).sort({ saleDate: 1 });

    if (salesRecords.length < 5) {
      return res.status(400).json({
        success: false,
        message: "At least 5 sales records are required",
        availableRecords: salesRecords.length,
      });
    }

    const sales = salesRecords.map((record) => record.quantity);

    const mlServiceUrl =
      process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

    const response = await fetch(`${mlServiceUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sales }),
      signal: AbortSignal.timeout(10000),
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    const prediction = Number(result.predictedNextPeriodDemand);

    if (!Number.isFinite(prediction) || prediction < 0) {
      return res.status(502).json({
        success: false,
        message: "ML service returned an invalid prediction",
      });
    }

    const forecastDemand = Math.ceil(prediction);

    // Forecast-only mode is the default.
    if (createPurchaseRequest !== true) {
      return res.status(200).json({
        success: true,
        productId,
        productName: product.name,
        currentStock: product.currentStock,
        forecastDemand,
        purchaseRequestCreated: false,
        message: "Demand forecast generated successfully",
        ...result,
      });
    }

    // Avoid duplicate pending requests.
    const existingRequest = await PurchaseRequest.findOne({
      product: product._id,
      status: "Pending",
    });

    if (existingRequest) {
      return res.status(200).json({
        success: true,
        productId,
        forecastDemand,
        purchaseRequestCreated: false,
        existingRequestId: existingRequest._id,
        message: "A pending purchase request already exists",
        ...result,
      });
    }

    // Basic target-stock calculation using the forecast.
    // This is a one-period estimate, not lead-time-aware planning.
    const quantity = Math.max(0, forecastDemand - product.currentStock);

    if (quantity === 0) {
      return res.status(200).json({
        success: true,
        productId,
        forecastDemand,
        currentStock: product.currentStock,
        purchaseRequestCreated: false,
        message: "Current stock covers the forecast demand",
        ...result,
      });
    }

    const purchaseRequest = await PurchaseRequest.create({
      product: product._id,
      quantity,
      unitPrice: product.unitPrice,
      totalAmount: quantity * product.unitPrice,
      supplier: product.supplier,
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      productId,
      productName: product.name,
      currentStock: product.currentStock,
      forecastDemand,
      purchaseRequestCreated: true,
      purchaseRequest: {
        requestId: purchaseRequest._id,
        quantity: purchaseRequest.quantity,
        unitPrice: purchaseRequest.unitPrice,
        totalAmount: purchaseRequest.totalAmount,
        supplier: purchaseRequest.supplier,
        status: purchaseRequest.status,
      },
      ...result,
    });
  } catch (error) {
    console.error("Forecast error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Could not generate forecast or purchase request",
    });
  }
};

module.exports = { forecastSales };