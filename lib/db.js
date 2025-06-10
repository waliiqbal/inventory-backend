const url = require("url");
const mongoose = require("mongoose");
const path = require("path");

const connectDB = async () => {
  try {
     await mongoose.connect("mongodb+srv://shakeeljaved1:dRceN24HdGyum0NR@cluster0.m4vheb1.mongodb.net/Inventrymanagement?retryWrites=true&w=majority", {
    // await mongoose.connect("mongodb+srv://waliiqbal2020:QwXfF6vnGHPDih1W@cluster0.gqktgu9.mongodb.net/practice?retryWrites=true&w=majority", {
    });
    console.log("Database connected...");
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  connectDB,
};
