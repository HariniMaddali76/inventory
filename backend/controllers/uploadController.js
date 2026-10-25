const XLSX = require("xlsx");
const Product = require("../models/product");

exports.uploadInventoryFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or Excel file"
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer"
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file has no worksheet"
      });
    }

    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: "" }
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file contains no data"
      });
    }

    const requiredFields = [
      "name",
      "sku",
      "currentStock",
      "unitPrice"
    ];

    const products = rows.map((row, index) => {
      for (const field of requiredFields) {
        if (
          row[field] === "" ||
          row[field] === undefined ||
          row[field] === null
        ) {
          throw new Error(
            `Row ${index + 2}: Missing ${field}`
          );
        }
      }

      const currentStock = Number(row.currentStock);
      const unitPrice = Number(row.unitPrice);
      const reorderLevel =
        row.reorderLevel === "" ||
        row.reorderLevel === undefined
          ? 10
          : Number(row.reorderLevel);

      if (
        !Number.isFinite(currentStock) ||
        !Number.isInteger(currentStock) ||
        currentStock < 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(reorderLevel) ||
        !Number.isInteger(reorderLevel) ||
        reorderLevel < 0
      ) {
        throw new Error(
          `Row ${index + 2}: Invalid stock, price, or reorder level`
        );
      }

      return {
        name: String(row.name).trim(),
        sku: String(row.sku).trim(),
        category: row.category
          ? String(row.category).trim()
          : "General",
        currentStock,
        reorderLevel,
        unitPrice,
        supplier: row.supplier
          ? String(row.supplier).trim()
          : ""
      };
    });

    const skus = products.map((p) => p.sku);

    if (skus.some((sku) => !sku)) {
      return res.status(400).json({
        success: false,
        message: "SKU cannot be empty"
      });
    }

    if (new Set(skus).size !== skus.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate SKU found in the uploaded file"
      });
    }

    const existing = await Product.find({
      sku: { $in: skus }
    }).select("sku");

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Some SKUs already exist",
        duplicateSkus: existing.map((p) => p.sku)
      });
    }

    const savedProducts = await Product.insertMany(products);

    return res.status(201).json({
      success: true,
      message: "Inventory file imported successfully",
      count: savedProducts.length,
      data: savedProducts
    });
  } catch (error) {
    console.error("Inventory upload error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to import inventory file"
    });
  }
};