const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const customerWeightSchema = new mongoose.Schema({

    product: {
        type: String,
        enum: ['poleythene', 'hydensity'], // Define allowed values
        required: true // Mark as required if needed
      },
      month: {
        type: String,
        required: true, // This field is required
      },
      totalCustomerWeightPure: {
        type: Number,
        required: true, // This field is required
      },
      totalCustomerWeightMixing: {
        type: Number,
        required: true, // This field is required
      },
      closingMonth: {
        type: Date,
        required: true,
      },
      openingWeightPure: {
        type: Number,
        required: true, // This field is required
      },
      openingWeightMixing: {
        type: Number,
        required: true, // This field is required
      },
      remainingWeightPure: {
        type: Number,
        required: true, // This field is required
      },
      remainingWeightMixing: {
        type: Number,
        required: true, // This field is required
      },

      totalMaterialWeightMixing: {
        type: Number,
        required: true, // This field is required
      },
      totalMaterialWeightPure: {
        type: Number,
        required: true, // This field is required
      },
    });

    module.exports = { customerWeightSchema };