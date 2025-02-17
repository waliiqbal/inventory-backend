const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const billSchema = new mongoose.Schema({

   
billNo: {
    type: String,
    required: true,
},

month: {
    type: String,
    required: true, 
  },

 phoneNumber: {
    type: String,
    required: false, 
  },

 userId: {
    type: String,
    required: false, 
  },

  userType: {
    type: String,
    enum: ['walkingCustomer', 'specificCustomer'],
    required: false 
  },

}, { 
    timestamps: true 
});

  module.exports = { billSchema };






