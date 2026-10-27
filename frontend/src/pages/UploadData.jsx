
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Database,
  LoaderCircle,
} from "lucide-react";
import api from "../services/api";

const REQUIRED_COLUMNS = [
  "Product",
  "SKU",
  "Current Stock",
  "Unit Price",
];

export default function UploadData() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = rows.filter((row) => row._valid);
  const invalidRows = rows.filter((row) => !row._valid);

  function resetData() {
    setFileName("");
    setRows([]);
    setErrors([]);
    setMessage("");
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    resetData();
    setFileName(file.name);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (!workbook.SheetNames.length) {
        setErrors(["The uploaded file has no worksheets."]);
        return;
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!data.length) {
        setErrors(["The uploaded file is empty."]);
        return;
      }

      const columns = Object.keys(data[0]);
      const missing = REQUIRED_COLUMNS.filter(
        (column) => !columns.includes(column)
      );

      if (missing.length) {
        setErrors([
          `Missing columns: ${missing.join(", ")}`,
          `Required columns: ${REQUIRED_COLUMNS.join(", ")}`,
        ]);
        return;
      }

      if (data.length > 5000) {
        setErrors(["Maximum 5000 rows are allowed per upload."]);
        return;
      }

      const seenSkus = new Set();

      const checkedRows = data.map((row, index) => {
        const rowErrors = [];

        const product = String(row.Product ?? "").trim();
        const sku = String(row.SKU ?? "").trim();
        const stockText = String(row["Current Stock"] ?? "").trim();
        const priceText = String(row["Unit Price"] ?? "").trim();
        const category = String(row.Category ?? "").trim();
        const supplier = String(row.Supplier ?? "").trim();
        const reorderText = String(row["Reorder Level"] ?? "").trim();

        const stock = Number(stockText);
        const price = Number(priceText);
        const reorderLevel =
          reorderText === "" ? 10 : Number(reorderText);

        if (!product) rowErrors.push("Product name is required");
        if (!sku) {
          rowErrors.push("SKU is required");
        } else if (seenSkus.has(sku.toLowerCase())) {
          rowErrors.push("Duplicate SKU in this file");
        } else {
          seenSkus.add(sku.toLowerCase());
        }

        if (
          stockText === "" ||
          !Number.isInteger(stock) ||
          stock < 0
        ) {
          rowErrors.push("Current Stock must be a non-negative whole number");
        }

        if (
          priceText === "" ||
          !Number.isFinite(price) ||
          price < 0
        ) {
          rowErrors.push("Unit Price must be a non-negative number");
        }

        if (
          !Number.isInteger(reorderLevel) ||
          reorderLevel < 0
        ) {
          rowErrors.push("Reorder Level must be a non-negative whole number");
        }

        return {
          Product: product,
          SKU: sku,
          "Current Stock": stock,
          "Unit Price": price,
          Category: category || "General",
          Supplier: supplier,
          "Reorder Level": reorderLevel,
          _rowNumber: index + 2,
          _errors: rowErrors,
          _valid: rowErrors.length === 0,
        };
      });

      setRows(checkedRows);
      setMessage(
        `File read successfully. ${checkedRows.length} rows found.`
      );
    } catch (error) {
      console.error("File reading error:", error);
      setErrors(["Unable to read this file. Please check the CSV or Excel format."]);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleImport() {
    if (importing || !validRows.length) return;

    setImporting(true);
    setErrors([]);
    setMessage("Uploading inventory data to the backend...");

    try {
      // Convert frontend column names to the backend's expected field names.
      const backendRows = validRows.map((row) => ({
        name: row.Product,
        sku: row.SKU,
        currentStock: row["Current Stock"],
        unitPrice: row["Unit Price"],
        category: row.Category,
        supplier: row.Supplier,
        reorderLevel: row["Reorder Level"],
      }));

      // The backend accepts CSV or XLSX files in a multipart request.
      const worksheet = XLSX.utils.json_to_sheet(backendRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

      const fileBytes = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const fileBlob = new Blob([fileBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();
      formData.append("file", fileBlob, "inventory.xlsx");

      // api should use the existing backend base URL and JWT setup.
      const response = await api.post("/upload", formData);

      if (response.data?.success !== true) {
        throw new Error(
          response.data?.message || "Inventory upload failed."
        );
      }

      setMessage(
        `${response.data.message || "Import successful"} — ${response.data.count ?? validRows.length} products saved to the database.`
      );

      // Clear the preview after a successful database import.
      setFileName("");
      setRows([]);
    } catch (error) {
      console.error("Inventory upload error:", error);

      const serverMessage =
        error.response?.data?.message ||
        error.message ||
        "Could not upload inventory data.";

      const duplicateSkus = error.response?.data?.duplicateSkus;

      setErrors([
        serverMessage,
        ...(duplicateSkus?.length
          ? [`Existing SKUs: ${duplicateSkus.join(", ")}`]
          : []),
      ]);

      setMessage("");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Upload Inventory Data
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV or Excel file, validate records and save them to MongoDB.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <Upload className="text-blue-600" size={28} />
        </div>

        <h2 className="text-lg font-semibold text-slate-800">
          Choose a CSV or Excel file
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Required: Product, SKU, Current Stock, Unit Price
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Optional: Category, Supplier, Reorder Level
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700">
          <FileSpreadsheet size={18} />
          Select File
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFile}
            disabled={loading || importing}
            className="hidden"
          />
        </label>

        {fileName && (
          <p className="mt-3 text-sm text-slate-600">
            Selected: {fileName}
          </p>
        )}

        {loading && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-600">
            <LoaderCircle size={16} className="animate-spin" />
            Reading file...
          </p>
        )}
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
        >
          <CheckCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Status</p>
            <p className="mt-1">{message}</p>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-700">
            <XCircle size={20} />
            Upload Errors
          </h2>
          {errors.map((error, index) => (
            <p key={index} className="mb-1 text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total Rows" value={rows.length} />
            <SummaryCard label="Valid Rows" value={validRows.length} />
            <SummaryCard label="Rows with Errors" value={invalidRows.length} />
          </div>

          {invalidRows.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white p-5">
              <h2 className="mb-3 font-semibold text-red-700">
                Rows with Errors
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="p-3">Row</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.map((row) => (
                      <tr key={row._rowNumber} className="border-t">
                        <td className="p-3">{row._rowNumber}</td>
                        <td className="p-3">{row.Product || "—"}</td>
                        <td className="p-3 text-red-600">
                          {row._errors.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-semibold text-slate-800">Data Preview</h2>
                <p className="text-sm text-slate-500">
                  Review the rows before importing.
                </p>
              </div>
              <Database className="text-blue-600" size={22} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Row</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Unit Price</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._rowNumber} className="border-t">
                      <td className="p-3">{row._rowNumber}</td>
                      <td className="p-3">{row.Product || "—"}</td>
                      <td className="p-3">{row.SKU || "—"}</td>
                      <td className="p-3">{row["Current Stock"]}</td>
                      <td className="p-3">{row["Unit Price"]}</td>
                      <td className="p-3">
                        {row._valid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                            <CheckCircle size={14} /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            <XCircle size={14} /> Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              {importing
                ? "Uploading to database..."
                : `Import ${validRows.length} Valid Rows`}
            </button>

            <button
              type="button"
              onClick={resetData}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
        <FileSpreadsheet size={20} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
