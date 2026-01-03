const express = require("express");
const router = express.Router();
const {
  addInventoryTransaction,
  getInventoryTransactions,
  addInventoryBatch,
  getInventoryBatches,
  getProductByBatchNumber,
  getInventoryAlerts,
  updateInventoryAlert,
  getInventorySettings,
  updateInventorySettings,
  getInventoryStats,
  bulkUpdateInventory,
} = require("./inventory.controllers");

// Inventory Transactions
router.post("/transactions", addInventoryTransaction);
router.get("/transactions", getInventoryTransactions);

// Inventory Batches
router.post("/batches", addInventoryBatch);
router.get("/batches", getInventoryBatches);
router.get("/batch/:batchNumber/product", getProductByBatchNumber);

// Inventory Alerts
router.get("/alerts", getInventoryAlerts);
router.patch("/alerts/:id", updateInventoryAlert);

// Inventory Settings
router.get("/settings/:ProductId", getInventorySettings);
router.put("/settings/:ProductId", updateInventorySettings);

// Inventory Statistics
router.get("/stats/:ShopId", getInventoryStats);

// Bulk Operations
router.post("/bulk-update", bulkUpdateInventory);

module.exports = router;
