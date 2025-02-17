const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true // Ensure date is mandatory
  },
  quantity: { 
    type: String, 
    
    required: true // Ensure quantity is mandatory
  },
  quality: { 
    type: String, 
    required: true // Ensure quality is mandatory
  },
  pureBags: { 
    type: Number, 
    required: false  // Ensure weightPure is mandatory
  },
  mixingBags: { 
    type: Number, 
    required: false // Ensure weightMixing is mandatory
  },
  mixingBagsWeight: { 
    type: Number, 
    required: false // Ensure weightMixing is mandatory
  },

  totalBags: { 
    type: Number, 
    required: false // Ensure weightMixing is mandatory
  },

  weightPure: { 
    type: Number, 
    required: false // Ensure weightMixing is mandatory
  },

  weightMixing: { 
    type: Number, 
    required: false // Ensure weightMixing is mandatory
  },
  grossWeight: { 
    type: Number,
    required: false // Calculated automatically if middleware is added
  },
  receivedFrom: { 
    type: String, 
    required: true // Ensure receivedFrom is mandatory
  },
  billNo: { 
    type: String, 
    required: false // Ensure billNo is mandatory
  },
  status: {  // Added status field to manage approval
    type: String,
    default: "pending", // By default, status will be 'pending'
    
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

userName: {
  type: String,
  required: false
}

  
}, { 
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = { materialSchema };
