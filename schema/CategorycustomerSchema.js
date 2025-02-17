const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CategoryCustomerSchema = new mongoose.Schema({

  clientName: {
        type: String,
        required: true 
      },
      type: {
        type: String,
        enum: ['walkingCustomer', 'specificCustomer'],
        default: 'specificCustomer',
        required: false 
      },
      phoneNumber: {
        type: String,
        required: false 
      },
     
    }, { 
      timestamps: true 
  });

    module.exports ={ CategoryCustomerSchema };