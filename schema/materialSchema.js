const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true 
  },
  quantity: { 
    type: String, 
    
    required: true 
  },
  quality: { 
    type: String, 
    required: true 
  },
  pureBags: { 
    type: Number, 
  },
  mixingBags: { 
    type: Number, 
    required: false 
  },
  mixingBagsWeight: { 
    type: Number, 
    required: false
  },

  masterbatchBags: { 
    type: Number, 
    required: false 
  },
  masterbatchBagsWeight: { 
    type: Number, 
    required: false
  },

  CalpetBags: { 
    type: Number, 
    required: false 
  },
  CalpetBagsWeight: { 
    type: Number, 
    required: false
  },

  lottereneBags: { 
    type: Number, 
    required: false 
  },
  lottereneBagsWeight: { 
    type: Number, 
    required: false
  },

  RecycleLLDBags: { 
    type: Number, 
    required: false 
  },
  RecycleLLDBagsWeight: { 
    type: Number, 
    required: false
  },

  PlainBags: { 
    type: Number, 
    required: false 
  },
  PlainBagsWeight: { 
    type: Number, 
    required: false
  },

  totalBags: { 
    type: Number, 
    required: false 
  },

  weightPure: { 
    type: Number, 
    required: false 
  },

  weightMixing: { 
    type: Number, 
    required: false 
  },

  weightRecycleLLD: { 
    type: Number, 
    required: false 
  },

  weightPlain: { 
    type: Number, 
    required: false 
  },

  weightlotterene: { 
    type: Number, 
    required: false 
  },

  weightmasterbatch: { 
    type: Number, 
    required: false 
  },

  weightCalpet: { 
    type: Number, 
    required: false 
  },


  grossWeight: { 
    type: Number,
    required: false 
  },

  rate: { 
    type: Number,
    required: false 
  },


  additional_cargo_rate: { 
    type: Number,
    required: false 
  },

  receivedFrom: { 
    type: String, 
    required: true 
  },
  vendorRef: {
    type: String,
    required: false
  },
  billNo: { 
    type: String, 
    required: false 
  },
  status: {  
    type: String,
    default: "pending", 
    
},
product: {
  type: String,
  enum: ['poleythene', 'hydensity'], 
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

userName: {
  type: String,
  required: false
},

isNorani: {
  type: Boolean,
  default: false,
  required: false
},

  
}, { 
  timestamps: true 
});

module.exports = { materialSchema };
