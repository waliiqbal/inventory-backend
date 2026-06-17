const mongoose = require("mongoose");

const salesPaymentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: false,
  },

  userType: {
    type: String,
    enum: ["walkingCustomer", "specificCustomer"],
    required: true,
  },

  clientName: {
    type: String,
    required: false, // snapshot only
  },

  ref_no: {
    type: String,
    required: false,
    index: true,
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
    enum: ["cash", "bank", "online", "other", "cheque"],
    default: "cash",
  },

  description: {
    type: String,
    default: "Payment received",
  },

}, { timestamps: true });

salesPaymentSchema.index({ userId: 1, date: 1 });
salesPaymentSchema.index({ ref_no: 1, date: 1 });
salesPaymentSchema.index({ phoneNumber: 1, date: 1 });
salesPaymentSchema.index({ billNo: 1 });

module.exports = { salesPaymentSchema };
