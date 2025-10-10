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
    rate: {    
        type: Number,  
        required: true,   
    },
    amount: {  
        type: Number,  
        required: true,  
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
        required: true 
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

      ratio: {
        type: String,
        required: false 
      },
      additionalRate: {
        type: Boolean,
        required: false 
      },
      
extraRate: {    
    type: Number,  
    required: true,   
    default: 0,
},

extraAmount: {    
    type: Number,  
    required: true,   
    default: 0,
},

totalAmount: {    
    type: Number,  
    required: true,   
    default: 0,
},


 description: {
        type: String,
        required: false 
      },
}, { 
    timestamps: true 
});

module.exports = { CustomerSchema };
