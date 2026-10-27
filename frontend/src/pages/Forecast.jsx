
import { useEffect, useState } from "react";
import {
  TrendingUp,
  Brain,
  RefreshCw,
  AlertCircle,
  Package,
  ShoppingCart,
  CheckCircle,
} from "lucide-react";
import api from "../services/api";

export default function Forecast() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestCreated, setRequestCreated] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await api.get("/inventory");
        const result = response.data;

        const productList = Array.isArray(result)
          ? result
          : result.data || result.products || [];

        setProducts(productList);

        if (productList.length > 0) {
          setProductId(String(productList[0]._id || productList[0].id));
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to load inventory products."
        );
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const selectedProduct = products.find(
    (product) =>
      String(product._id || product.id) === String(productId)
  );

  const generateForecast = async () => {
    if (!productId) {
      setError("Please select a product first.");
      return;
    }

    setLoading(true);
    setError("");
    setRequestMessage("");
    setRequestCreated(false);
    setForecastData(null);

    try {
      const response = await api.post("/forecast", {
        productId,
        createPurchaseRequest: false,
      });

      if (response.data.success === false) {
        throw new Error(
          response.data.message || "Forecast generation failed."
        );
      }

      setForecastData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to generate forecast."
      );
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseRequest = async () => {
    if (!productId || !forecastData) {
      setError("Generate a forecast before creating a purchase request.");
      return;
    }

    const suggestedQuantity = Number(
      forecastData.orderCalculation?.suggestedQuantity ?? 0
    );

    if (suggestedQuantity <= 0) {
      setError("No additional stock is required for this product.");
      return;
    }

    setCreatingRequest(true);
    setError("");
    setRequestMessage("");

    try {
      // Use the existing backend forecast endpoint to create the request.
      const response = await api.post("/forecast", {
        productId,
        createPurchaseRequest: true,
      });

      const result = response.data;

      if (result.success === false) {
        throw new Error(
          result.message || "Purchase request could not be created."
        );
      }

      setForecastData(result);

      if (result.purchaseRequestCreated) {
        setRequestCreated(true);
        setRequestMessage(
          `Purchase request created successfully. Quantity: ${
            result.purchaseRequest?.quantity ?? suggestedQuantity
          }. Check the Approvals page for its status.`
        );
      } else {
        setRequestMessage(
          result.message ||
            "The backend did not confirm that a new request was created. Check Purchase Requests before trying again."
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create purchase request."
      );
    } finally {
      setCreatingRequest(false);
    }
  };

  const suggestedQuantity = Number(
    forecastData?.orderCalculation?.suggestedQuantity ?? 0
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
            <TrendingUp className="text-blue-600" />
            AI Demand Forecast
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Predict future product demand and create purchase requests.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="forecast-product"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Select Product
          </label>

          <select
            id="forecast-product"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setForecastData(null);
              setError("");
              setRequestMessage("");
              setRequestCreated(false);
            }}
            disabled={loadingProducts || products.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">
              {loadingProducts
                ? "Loading products..."
                : products.length === 0
                  ? "No products available"
                  : "Select a product"}
            </option>

            {products.map((product) => (
              <option
                key={product._id || product.id}
                value={product._id || product.id}
              >
                {product.name || product.productName} ({product.sku || "No SKU"})
                {" — Stock: "}
                {product.currentStock ?? product.stock ?? 0}
              </option>
            ))}
          </select>

          {selectedProduct && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Current Stock</p>
                <p className="text-xl font-bold text-slate-800">
                  {selectedProduct.currentStock ?? selectedProduct.stock ?? 0}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Unit Price</p>
                <p className="text-xl font-bold text-slate-800">
                  ₹{selectedProduct.unitPrice ?? 0}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Reorder Level</p>
                <p className="text-xl font-bold text-slate-800">
                  {selectedProduct.reorderLevel ?? 10}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={generateForecast}
            disabled={loading || loadingProducts || !productId}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Brain size={18} />
            )}
            {loading ? "Generating..." : "Generate Forecast"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">Error</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        )}

        {requestMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            <CheckCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">
                {requestCreated ? "Request Created" : "Request Update"}
              </p>
              <p className="mt-1 text-sm">{requestMessage}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <RefreshCw
              className="mx-auto animate-spin text-blue-600"
              size={36}
            />
            <p className="mt-4 text-slate-600">
              Generating demand prediction...
            </p>
          </div>
        )}

        {forecastData && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <Package className="mb-3 text-blue-600" size={25} />
                <p className="text-sm text-slate-500">Product</p>
                <p className="mt-1 text-xl font-bold text-slate-800">
                  {forecastData.productName ||
                    selectedProduct?.name ||
                    selectedProduct?.productName ||
                    "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <TrendingUp className="mb-3 text-green-600" size={25} />
                <p className="text-sm text-slate-500">
                  Predicted Weekly Demand
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-800">
                  {forecastData.forecastDemand ??
                    forecastData.predictedNextPeriodDemand ??
                    "—"}
                </p>
              </div>
            </div>

            {forecastData.orderCalculation && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  Suggested Reorder Analysis
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Current Stock", forecastData.orderCalculation.currentStock],
                    ["Demand During Lead Time", forecastData.orderCalculation.demandDuringLeadTime],
                    ["Safety Stock", forecastData.orderCalculation.safetyStock],
                    ["Incoming Stock", forecastData.orderCalculation.incomingStock],
                    ["Supplier Lead Time (days)", forecastData.orderCalculation.leadTimeDays],
                    ["Suggested Order Quantity", forecastData.orderCalculation.suggestedQuantity],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-2 text-xl font-bold text-slate-800">
                        {value ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {forecastData.message}
                </p>

                {suggestedQuantity > 0 && !requestCreated && (
                  <button
                    onClick={createPurchaseRequest}
                    disabled={creatingRequest}
                    className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingRequest ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <ShoppingCart size={18} />
                    )}
                    {creatingRequest
                      ? "Creating Request..."
                      : "Create Purchase Request"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
