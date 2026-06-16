const mongoose = require("mongoose");

const purchasePaymentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: false,
  },

  userType: {
    type: String,
    enum: ["walkingCustomer", "specificCustomer"],
    required: false,
  },

  vendorName: {
    type: String,
    required: true,
    trim: true,
  },

  receivedFrom: {
    type: String,
    required: false,
    trim: true,
  },

  phoneNumber: {
    type: String,
    required: false,
  },

  billNo: {
    type: String,
    required: false,
  },

  folio: {
    type: String,
    required: false,
  },

  product: {
    type: String,
    enum: ["poleythene", "hydensity"],
    required: false,
  },

  date: {
    type: Date,
    required: true,
  },

  dueOnDate: {
    type: Date,
    required: false,
  },

  amount: {
    type: Number,
    required: true,
    min: 1,
  },

  paymentMethod: {
    type: String,
    enum: ["cash", "bank", "online", "cheque", "other"],
    default: "cash",
  },

  description: {
    type: String,
    default: "Payment sent to vendor",
  },
}, { timestamps: true });

purchasePaymentSchema.index({ userId: 1, date: 1 });
purchasePaymentSchema.index({ vendorName: 1, date: 1 });
purchasePaymentSchema.index({ phoneNumber: 1, date: 1 });
purchasePaymentSchema.index({ billNo: 1 });
purchasePaymentSchema.index({ product: 1, date: 1 });

module.exports = { purchasePaymentSchema };
