const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CustomerSchema = new mongoose.Schema({
    date: { 
        type: Date, 
        required: true 
    },
    clientName: {
        type: String,
        required: true,
    },
    quality: {
        type: String,
        required: true,
    },
    dcNumber: {
        type: String,
        required: true,
    },
    weightPure: {  
        type: Number, 
        required: true,
    },
    weightMixing: { 
        type: Number,  
        required: true,
    },
    grossWeight: {
        type: Number,
        required: true 
    },
    rate: {    // Added the rate field
        type: Number,  // Changed to Number
        required: true,   // You can change this to 'false' if it's optional
    },
    amount: {  // Added the amount field
        type: Number,  // Changed to Number
        required: true,   // You can change this to 'false' if it's optional
    },
    billNo: {
        type: String,
        required: false,
    },
    status: {  
        type: String,
        default: "pending",
        
    },
    product: {
        type: String,
        enum: ['poleythene', 'hydensity'], // Define allowed values
        required: true // Mark as required if needed
      },
      userId: {
        type: String,
        required: false 
      },
      userType: {
        type: String,
        enum: ['walkingCustomer', 'specificCustomer'],
        required: false 
      },

      phoneNumber: {
        type: String,
        required: false 
      },
      
}, { 
    timestamps: true 
});

module.exports = { CustomerSchema };
