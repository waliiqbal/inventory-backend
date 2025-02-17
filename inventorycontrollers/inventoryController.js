const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {jwtAuthMiddleware,} = require('./../jwt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cron = require('node-cron');




const { userSchema } = require('../schema/userSchema');
const { materialSchema } = require('../schema/materialSchema');
const { CustomerSchema } = require('../schema/CustomerSchema');
const { CategoryCustomerSchema } = require('../schema/CategorycustomerSchema');
const { billSchema } = require('../schema/billSchema');
const { customerWeightSchema } = require('../schema/customerWeightSchema');
const { matchesGlob } = require('path/posix');
const Customerdata = mongoose.model("Customer", CustomerSchema); 
const billdata = mongoose.model("bill", billSchema);
const CustomerWeightdata = mongoose.model("customerWeight", customerWeightSchema); 
const materialdata = mongoose.model("material", materialSchema); 
const userData = mongoose.model('user', userSchema);
const CategoryCustomerdata = mongoose.model("CategoryCustomer", CategoryCustomerSchema); 



const createUser = async (req, res) => {
  console.log(req.body);
  try {
    // Get user data from request body
    const { username, email, password, userRole } = req.body;

    // Check if email already exists
    const existingUser = await userData.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password before saving
    const saltRounds = 10; // Number of salt rounds for hashing
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user with the hashed password
    const newUser = new userData({
      username,
      email,
      password: hashedPassword, // Store hashed password
      userRole
    });

    // Save the user to the database
    await newUser.save();

    // Send a success response
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.log(error);
    // Handle any errors
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await userData.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // **Payload**: Information to store in the token
    const payload = {
      userId: user._id,
      email: user.email,
      userRole: user.userRole, // Example: 'admin' or 'user'
    };

    // Generate JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h', // Token validity
    });

    // Respond with token
    res.status(200).json(
      
      {
        data: {message: 'Login successful',
          accessToken: token}
      
    });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
 
const Creatematerial = async (req, res) => {
  try {
    const { 
      date, 
      pureBags, 
      mixingBags,
      mixingBagsWeight, 
      totalBags, 
      quality, 
      quantity, 
      receivedFrom, 
      billNo,
      status, 
      product,
      userId,
      userType,
      userName,
      phoneNumber,
    } = req.body;

    // Calculate weights based on the given logic
    const weightPure = pureBags ? pureBags * 25 : 0; // Multiply pureBags by 25
    const weightMixing = mixingBags ? mixingBags * mixingBagsWeight : 0; // Multiply mixingBags by 25
    const grossWeight = totalBags ?  weightPure +  weightMixing   : 0; 

    
    const newMaterial = new materialdata({
      date,
      pureBags,
      mixingBags,
      mixingBagsWeight,
      totalBags,
      quality,
      quantity,
      receivedFrom,
      billNo,
      status,
      product,
      userId,
      userType,
      phoneNumber,
      userName,
      weightPure,   // Add calculated weightPure
      weightMixing, // Add calculated weightMixing
      grossWeight,  // Add calculated grossWeight
    });

    
    await newMaterial.save();

   
    res.status(201).json({ 
      message: 'Material created successfully', 
      material: newMaterial 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating material' });
  }
};

    


const getCustomer = async (req, res) => {
  try {
    const { month, product, search, userId, userType, page = 1, limit = 10 } = req.query;

    // Validate required parameters
    if (!month || !product) {
      return res.status(400).json({ message: "Month and product are required query parameters." });
    }

    // Parse and validate month format
    const [year, monthValue] = month.split("-");
    if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
      return res.status(400).json({ message: "Invalid month format. Use YYYY-MM format." });
    }

    // Create start and end dates for the current month
    const startDate = new Date(`${year}-${monthValue}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Calculate the previous month
    const previousMonthDate = new Date(startDate);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth() + 1;
    console.log("pre",previousMonthDate);
    // Prepare the query object
    const query = {
      product,
      date: { $gte: startDate, $lt: endDate },
    };

    // Apply userType and search filters
    query.userType = userType || "walkingCustomer";
    if (search) {
      query.clientName = { $regex: search, $options: "i" };
    }
    if (userId && userType === "specificCustomer") {
      query.userId = userId;
    }

    // Pagination setup
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Fetch paginated customer data
    const customers = await Customerdata.find(query).sort({ _id: -1 }).skip(skip).limit(pageSize);

    // Fetch total document count for pagination meta-data
    const totalDocs = await Customerdata.countDocuments(query);

    // Fetch the data for the previous month from CustomerWeightdata
    if (userId && userType === "specificCustomer") {
      // Fetch weights for the specific customer
      const weights = await calculateCustomerWeights(month, product, userId);
      return res.status(200).json({
        message: "Customer and weights fetched successfully.",
        data: {
          data: customers, // Paginated customer data
          weight: weights, // Calculated weights
          page: {
            page: pageNumber, // Current page
            limit: pageSize, // Items per page
            totalDocs: totalDocs, // Total number of documents
          },
        },
      });
    } else {
      // Fetch opening and closing weights for general customer
      const lastMonthDataCustomer = await CustomerWeightdata.findOne({
        product,
        closingMonth: { $gte: previousMonthDate, $lt: startDate }
      });

      const openingWeightMixing = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightMixing : 0;
      const openingWeightPure = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightPure : 0;

      const closingWeightMixing = lastMonthDataCustomer ? lastMonthDataCustomer.totalCustomerWeightMixing : 0;
      const closingWeightPure = lastMonthDataCustomer ? lastMonthDataCustomer.totalCustomerWeightPure : 0;
        
      const totalCustomer = await Customerdata.aggregate([
        { $match: { product,  userType: "walkingCustomer", date: { $gte: startDate, $lt: endDate } } },
        {
          $group: {
            _id: null,
            totalCustomerMixing: { $sum: "$weightMixing" },
            totalCustomerPure: { $sum: "$weightPure" },
          },
        },
      ]);

      const totalCustomerMixing = totalCustomer.length > 0 ? totalCustomer[0].totalCustomerMixing : 0;
      const totalCustomerPure = totalCustomer.length > 0 ? totalCustomer[0].totalCustomerPure : 0;

      return res.status(200).json({
        message: "Customer and weights fetched successfully.",
        data: {
          data: customers, // Paginated customer data
          weight: {
            openingWeight: {
              weightMixing: openingWeightMixing,
              weightPure: openingWeightPure,
            },
            closingWeight: {
              weightMixing: closingWeightMixing,
              weightPure: closingWeightPure,
            },

            totalWeight: {
              totalMixing: totalCustomerMixing,
              totalPure: totalCustomerPure,
            },
          },
          page: {
            page: pageNumber, // Current page
            limit: pageSize, // Items per page
            totalDocs: totalDocs, // Total number of documents
          },
        },
      });
    }
  } catch (error) {
    console.error("Error in getCustomer API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};


const calculateCustomerWeights = async (month, product, userId) => {
  try {
    const [year, monthValue] = month.split("-");
    const startDate = new Date(`${year}-${monthValue}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const previousMonthDate = new Date(startDate);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1); // Set to previous month

    const previousMonthStart = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
    const previousMonthEnd = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 1);

    console.log("Previous Month Start:", previousMonthStart); // Debug log
    console.log("Previous Month End:", previousMonthEnd);     // Debug log

    // Update to include userId in the aggregation queries
    const customerdata = await Customerdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: startDate, $lt: endDate } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    const closingWeightMixing = customerdata[0]?.totalWeightMixing || 0;
    const closingWeightPure = customerdata[0]?.totalWeightPure || 0;

    // Material data for the previous month, filtered by userId
    const materialDataPreviousMonth = await materialdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: previousMonthStart, $lt: previousMonthEnd } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    console.log("Material Data (Previous Month):", materialDataPreviousMonth);

    // Fetch customer data for the previous month, filtered by userId
    const pastCustomerDataPreviousMonth = await Customerdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: previousMonthStart, $lt: previousMonthEnd } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    console.log("Past Customer Data (Previous Month):", pastCustomerDataPreviousMonth);

    const openingWeightMixing =
      (materialDataPreviousMonth[0]?.totalWeightMixing || 0) - (pastCustomerDataPreviousMonth[0]?.totalWeightMixing || 0);

    const openingWeightPure =
      (materialDataPreviousMonth[0]?.totalWeightPure || 0) - (pastCustomerDataPreviousMonth[0]?.totalWeightPure || 0);

    console.log("Opening Weight Mixing:", openingWeightMixing);
    console.log("Opening Weight Pure:", openingWeightPure);

    return {
      openingWeight: {
        weightMixing: openingWeightMixing,
        weightPure: openingWeightPure,
      },
      closingWeight: {
        weightMixing: closingWeightMixing,
        weightPure: closingWeightPure,
      },
    };
  } catch (error) {
    console.error("Error in calculatecustomerlWeights function:", error);
    throw new Error("Unable to calculate customer weights.");
  }
};
 


    
  

  const getMaterial = async (req, res) => {
  try {
    const { month, product, search, userId, userType, page = 1, limit = 10 } = req.query;

    if (!month || !product) {
      return res.status(400).json({ message: "Month and product are required query parameters." });
    }

    const [year, monthValue] = month.split("-");
    if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
      return res.status(400).json({ message: "Invalid month format. Use YYYY-MM format." });
    }

    const startDate = new Date(`${year}-${monthValue}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const previousMonthDate = new Date(startDate);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth() + 1;
    console.log("pre",previousMonthDate);
    
    const query = { product, date: { $gte: startDate, $lt: endDate } };
    query.userType = userType || "walkingCustomer";
    if (search) {
      query.receivedFrom = { $regex: search, $options: "i" };
    }
    if (userId && userType === "specificCustomer") {
      query.userId = userId;
    }

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const materials = await materialdata.find(query).sort({ _id: -1 }).skip(skip).limit(pageSize);
    const totalDocs = await materialdata.countDocuments(query);

    if (userId && userType === "specificCustomer") {
      const weights = await calculateMaterialWeights(month, product, userId);
      return res.status(200).json({
        message: "Materials and weights fetched successfully.",
        data: {
          data: materials,
          weight: weights ,
          page: {
            page: pageNumber,
            limit: pageSize,
            totalDocs: totalDocs,
          },
        },
      });
    } else {
      console.log("date kia bni",startDate, endDate);
      const lastMonthDataCustomer = await CustomerWeightdata.findOne({
        product,
        closingMonth: { $gte: previousMonthDate, $lt: startDate }
      });

      const openingWeightMixing = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightMixing : 0;
      const openingWeightPure = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightPure : 0;
      const closingWeightMixing = lastMonthDataCustomer ? lastMonthDataCustomer.totalMaterialWeightMixing : 0;
      const closingWeightPure = lastMonthDataCustomer ? lastMonthDataCustomer.totalMaterialWeightPure : 0;


     

      const totalMaterial = await materialdata.aggregate([
        { $match: { product, userType: "walkingCustomer", date: { $gte: startDate, $lt: endDate } } },
        {
          $group: {
            _id: null,
            totalMaterialMixing: { $sum: "$weightMixing" },
            totalMaterialPure: { $sum: "$weightPure" },
          },
        },
      ]);

      const totalMaterialMixing = totalMaterial.length > 0 ? totalMaterial[0].totalMaterialMixing : 0;
      const totalMaterialPure = totalMaterial.length > 0 ? totalMaterial[0].totalMaterialPure : 0;

      return res.status(200).json({
        message: "Materials and weights fetched successfully.",
        data: {
          data: materials,
          lastMonthDataCustomer,
          weight: {
            openingWeight: {
              weightMixing: openingWeightMixing,
              weightPure: openingWeightPure,
            },
            closingWeight: {
              weightMixing: closingWeightMixing,
              weightPure: closingWeightPure,
            },
            totalWeight: {
              totalMixing: totalMaterialMixing,
              totalPure: totalMaterialPure,
            },
          },
          page: {
            page: pageNumber,
            limit: pageSize,
            totalDocs: totalDocs,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error in getMaterial API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};


const calculateMaterialWeights = async (month, product, userId) => {
  try {
    const [year, monthValue] = month.split("-");
    const startDate = new Date(`${year}-${monthValue}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const previousMonthDate = new Date(startDate);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1); // Set to previous month

    const previousMonthStart = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
    const previousMonthEnd = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 1);

    console.log("Previous Month Start:", previousMonthStart); // Debug log
    console.log("Previous Month End:", previousMonthEnd);     // Debug log

    // Update to include userId in the aggregation queries
    const materialData = await materialdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: startDate, $lt: endDate } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    const closingWeightMixing = materialData[0]?.totalWeightMixing || 0;
    const closingWeightPure = materialData[0]?.totalWeightPure || 0;

    // Material data for the previous month, filtered by userId
    const materialDataPreviousMonth = await materialdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: previousMonthStart, $lt: previousMonthEnd } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    console.log("Material Data (Previous Month):", materialDataPreviousMonth);

    // Fetch customer data for the previous month, filtered by userId
    const pastCustomerDataPreviousMonth = await Customerdata.aggregate([
      { 
        $match: { 
          product, 
          userId, // Add userId filter
          userType: "specificCustomer",
          date: { $gte: previousMonthStart, $lt: previousMonthEnd } 
        }
      },
      {
        $group: {
          _id: null,
          totalWeightMixing: { $sum: "$weightMixing" },
          totalWeightPure: { $sum: "$weightPure" },
        },
      },
    ]);

    console.log("Past Customer Data (Previous Month):", pastCustomerDataPreviousMonth);

    const openingWeightMixing =
      (materialDataPreviousMonth[0]?.totalWeightMixing || 0) - (pastCustomerDataPreviousMonth[0]?.totalWeightMixing || 0);

    const openingWeightPure =
      (materialDataPreviousMonth[0]?.totalWeightPure || 0) - (pastCustomerDataPreviousMonth[0]?.totalWeightPure || 0);

    console.log("Opening Weight Mixing:", openingWeightMixing);
    console.log("Opening Weight Pure:", openingWeightPure);

    return {
      
      openingWeight: {
        weightMixing: openingWeightMixing,
        weightPure: openingWeightPure,
      },
      closingWeight: {
        weightMixing: closingWeightMixing,
        weightPure: closingWeightPure,
      },
    };
  } catch (error) {
    console.error("Error in calculateMaterialWeights function:", error);
    throw new Error("Unable to calculate material weights.");
  }
};




const getMaterialbyId = async (req, res) => {
  try {
  
    const { id } = req.params;

    const material = await materialdata
      .findOne({_id: id}) 
      
  
    return res.json({
      success: true,
      data: material,
     
    });
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ success: false, error: 'Error retrieving materials' });
  }
};

const getCustomerbyId = async (req, res) => {
  try {
  
    const { id } = req.params;

    const material = await 
    Customerdata.findOne({_id: id}) 
      
  
    return res.json({
      success: true,
      data: material,
     
    });
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ success: false, error: 'Error retrieving materials' });
  }
};

const updateMaterialStatusById = async (req, res) => {
  try {
    const { id } = req.params; 

 
    const updatedMaterial = await materialdata.findOneAndUpdate(
      { _id: id }, 
      { $set: { status: "approved" } }, 
      { new: true } 
    );

  
    if (!updatedMaterial) {
      return res.json({
        success: false,
        data: null, 
      });
    }

  
    return res.json({
      success: true,
      msg: "sucessfully updated",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Error updating material status",
    });
  }
};

const updateCustomerStatusById = async (req, res) => {
  try {
    const { id } = req.params; 

 
    const updatedCustomer = await Customerdata.findOneAndUpdate(
      { _id: id }, 
      { $set: { status: "approved" } }, 
      { new: true } 
    );

  
    if (!updatedCustomer) {
      return res.json({
        success: false,
        data: null, 
      });
    }

  
    return res.json({
      success: true,
      msg: "sucessfully updated",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Error updating material status",
    });
  }
};




const editMaterial = async (req, res) => {
  try {
    const { date, quantity, quality, weightPure, weightMixing, grossWeight, receivedFrom, billNo, status, product, _id, userId ,userType, userName, phoneNumber } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Material ID is required' });
    }

    const updatedMaterial = await materialdata.findByIdAndUpdate(
      _id,
      { date, quantity, quality, weightPure, weightMixing, grossWeight, receivedFrom, billNo, status, product,userId , userType, userName, phoneNumber },
      { new: true, runValidators: true }
    );

    if (!updatedMaterial) {
      return res.status(404).json({ error: 'material not found' });
    }

    res.status(200).json({ message: 'material updated successfully', material: updatedMaterial });
  } catch (error) {
    res.status(500).json({ error: 'Error updating material' });
  }
};


const deleteMaterial = async (req, res) => {
  try {
 
    const { id } = req.params;

 
    if (!id) {
      return res.status(400).json({ error: 'Material ID is required' });
    }

    
    const deletedMaterial = await materialdata.findByIdAndDelete(id);


    if (!deletedMaterial) {
      return res.status(404).json({ error: 'Material not found' });
    }

 
    res.status(200).json({ message: 'Material deleted successfully', material: deletedMaterial });
  } catch (error) {
    console.error(error); 
    res.status(500).json({ error: 'Error deleting material' });
  }
};

const createCustomer = async (req, res) => {
  try {
    let { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product, userId, userType, phoneNumber } = req.body;

    if (!date || !clientName || !quality || !dcNumber  || !rate || !amount || !product) {
      return res.status(400).json({ error: 'All fields are required: date, clientName, quality, dcNumber, weightPure, weightMixing, rate, amount, billNo' });
    }

    let makeDate = new Date(date).toISOString().slice(0, 7);

    let newBill = {
      month: makeDate,
      userType: userType,
    };

    if (userType === "walkingCustomer") {
      newBill.phoneNumber = phoneNumber;
    }

    if (userType === "specificCustomer") {
      newBill.userId = userId;
    }

    let getBill = await billdata.findOne(newBill);

    if (getBill) {
      billNo = getBill.billNo;
    } else {
      function generateUniqueBillNo() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#';
        let billNo = '';
        for (let i = 0; i < 5; i++) { 
          const randomIndex = Math.floor(Math.random() * characters.length);
          billNo += characters[randomIndex];
        }
        return billNo;
      }

      billNo = generateUniqueBillNo();
      newBill.billNo = billNo;
      
      const createdBill = new billdata(newBill);
      await createdBill.save();
    }

    const newCustomer = new Customerdata({
      date,
      clientName,
      quality,
      dcNumber,
      weightPure,
      weightMixing,
      grossWeight,
      rate,
      amount,
      billNo: billNo || newBill.billNo,
      status,
      product,
      userId,
      userType,
      phoneNumber,
    });

    await newCustomer.save();

    res.status(201).json({ message: 'Customer created successfully', customer: newCustomer });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating customer' });
  }
};


const editCustomer = async (req, res) => {
  try {
    const { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product, _id } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const updatedCustomer = await Customerdata.findByIdAndUpdate(
      _id,
      { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer updated successfully', customer: updatedCustomer });
  } catch (error) {
    res.status(500).json({ error: 'Error updating customer' });
  }
};



const deleteCustomer = async (req, res) => {
  try {
  
    const { id } = req.params;

  
    if (!id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }


    const deletedCustomer = await Customerdata.findByIdAndDelete(id);

   
    if (!deletedCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    
    res.status(200).json({ message: 'Customer deleted successfully', customer: deletedCustomer });
  } catch (error) {
    console.error(error); 
    res.status(500).json({ error: 'Error deleting customer' });
  }
};


const CreateCategoryCustomer = async (req, res) => {
try {
  const { clientName, type, phoneNumber } = req.body;


  const newCustomer = new CategoryCustomerdata({ clientName, type, phoneNumber });

 
  await newCustomer.save();
  res.status(201).json({ message: 'Customer created successfully', CategoryCustomer: newCustomer });
} catch (error) {
  res.status(500).json({ error: error.message });
}
};

const getCategoryCustomer = async (req, res) => {
try {
  const {clientName, page = 1, limit = 10 } = req.query;

  const filter = clientName ? {clientName: { $regex: clientName, $options: 'i' } } : {};

  const CategoryCustomer = await CategoryCustomerdata.find(filter)
    .skip((page - 1) * parseInt(limit))
    .limit(parseInt(limit)).sort({ createdAt: -1 });

  const totalCategoryCustomer = await CategoryCustomerdata.countDocuments(filter);

  res.status(200).json({
    totalCategoryCustomer,
    totalPages: Math.ceil(totalCategoryCustomer / limit),
    currentPage: parseInt(page),
    data: {data: CategoryCustomer}
  });
} catch (error) {
  res.status(500).json({ error: error.message });
}
};

const deleteCategoryCustomer = async (req, res) => {
  try {
  
    const { _id } = req.params;

  
    if (!_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }


    const deletedCategoryCustomer = await CategoryCustomerdata.findByIdAndDelete(_id);

   
    if (!deletedCategoryCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    
    res.status(200).json({ message: 'Customer deleted successfully', CategoryCustomer: deletedCategoryCustomer });
  } catch (error) {
    console.error(error); 
    res.status(500).json({ error: 'Error deleting customer' });
  }
};

const EditCategoryCustomer = async (req, res) => {
  try {
    const { _id, clientName, type, phoneNumber } = req.body;

    if (!_id) {
      return res.status(400).json({ message: 'ID is required' });
    }

    const updatedCategoryCustomer = await CategoryCustomerdata.findByIdAndUpdate(
      _id,
      { clientName, type, phoneNumber },
      { new: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer updated successfully', CategoryCustomer: updatedCategoryCustomer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getwalkingcustomer = async (req, res) => {
  try {
    const { month } = req.query; 



    
    const result = await Customerdata.aggregate([
        {
            $match: {
                userType: "walkingCustomer", // Fixed userType
                $expr: {
                    $eq: [{ $substr: ["$date", 0, 7] }, month] // Extract month from date
                }
            }
        },
        {
            $group: {
                _id: "$phoneNumber", 
                clientName: { $first: "$clientName" }
            }
        },
        {
            $project: {
                _id: 0,             
                phoneNumber: "$_id", 
                clientName: 1         
            }
        }
    ]);

    
    return res.status(200).json({
        data: {
            data: result
        }
    });
} catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ message: "Server Error" });
}
};

const getCustomerdetails = async (req, res) => {
  try {
    const { month, userType, userId, phoneNumber } = req.query;

    let query = {};

    // Query setup based on userType
    if (userType === "specificCustomer") {
      query.userId = userId;
    } else if (userType === "walkingCustomer") {
      query.phoneNumber = phoneNumber;
    }

    // Month filtering
    if (month) {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(`${month}-01`);
      endDate.setMonth(endDate.getMonth() + 1);

      query.date = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    // Fetch detailed customer data
    const customerData = await Customerdata.find(query, {
      date: 1,
      quality: 1,
      dcNumber: 1,
      rate: 1,
      amount: 1,
    });

    // Fetch unique bill numbers
    const uniqueBillNumbers = await Customerdata.distinct("billNo", query);

    // Response
    res.status(200).json({
      data: {
        data: customerData, // Detailed customer data
        billNo: uniqueBillNumbers,  // Unique bill numbers
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error });
  }
};

cron.schedule("0 0 1 * *", async () => {
  try {
    const currentMonthDate = new Date();
    const currentMonth = currentMonthDate.getMonth(); // 0-based index (0 = Jan)
    const currentYear = currentMonthDate.getFullYear();

    // **System February 2025 se chal raha hai**
    if (currentYear === 2025 && currentMonth === 0) { // January me na chale
      console.log("Cron February 2025 se chalegi.");
      return;
    }

    // Previous Month Calculate
    const previousMonthDate = new Date(currentYear, currentMonth - 1);
    const previousMonth = previousMonthDate.getMonth();
    const previousYear = previousMonthDate.getFullYear();

    const previousMonthStart = new Date(previousYear, previousMonth, 1);
    const previousMonthEnd = new Date(previousYear, previousMonth + 1, 1);

    console.log("Previous Month Start:", previousMonthStart);
    console.log("Previous Month End:", previousMonthEnd);

    // **Unique Product Types (Customer + Material)**
    const productTypesCustomer = await Customerdata.distinct("product");
    const productTypesMaterial = await materialdata.distinct("product");

    // Merge both product types into a unique list
    const productTypes = [...new Set([...productTypesCustomer, ...productTypesMaterial])];

    console.log("All Unique Product Types:", productTypes);

    // Process each product type
    for (const product of productTypes) {
      // Customer Data Aggregation
      const customerData = await Customerdata.aggregate([
        { $match: { product, userType: "walkingCustomer", date: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
        {
          $group: {
            _id: null,
            totalWeightMixing: { $sum: "$weightMixing" },
            totalWeightPure: { $sum: "$weightPure" },
          },
        },
      ]);
      const totalCustomerWeightMixing = customerData[0]?.totalWeightMixing || 0;
      const totalCustomerWeightPure = customerData[0]?.totalWeightPure || 0;

      // Material Data Aggregation
      const materialData = await materialdata.aggregate([
        { $match: { product, userType: "walkingCustomer", date: { $gte: previousMonthStart, $lt: previousMonthEnd } } },
        {
          $group: {
            _id: null,
            totalWeightMixing: { $sum: "$weightMixing" },
            totalWeightPure: { $sum: "$weightPure" },
          },
        },
      ]);
      const totalMaterialWeightMixing = materialData[0]?.totalWeightMixing || 0;
      const totalMaterialWeightPure = materialData[0]?.totalWeightPure || 0;

      // **Fetch Previous Month Opening Balance from 2 months ago**
      const twoMonthsBackDate = new Date(currentYear, currentMonth - 2); // Go 2 months back
      const twoMonthsBackMonth = twoMonthsBackDate.getMonth();
      const twoMonthsBackYear = twoMonthsBackDate.getFullYear();

      const lastMonthDataCustomer = await CustomerWeightdata.findOne({
        product,
        month: `${twoMonthsBackYear}-${String(twoMonthsBackMonth + 1).padStart(2, "0")}`, // 2 months back (1-based format)
      });

      const openingWeightMixing = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightMixing : 0;
      const openingWeightPure = lastMonthDataCustomer ? lastMonthDataCustomer.remainingWeightPure : 0;

      // **Remaining Weight Calculation for Customer**
      const remainingWeightPure =
        totalMaterialWeightPure - totalCustomerWeightPure + openingWeightPure;

      const remainingWeightMixing =
        totalMaterialWeightMixing - totalCustomerWeightMixing + openingWeightMixing;

      // Save to WeightManagementCustomer Document
      await CustomerWeightdata.create({
        product,
        month: `${previousYear}-${String(previousMonth + 1).padStart(2, "0")}`, // Save with 1-based month format
        totalCustomerWeightPure,
        totalCustomerWeightMixing,
        openingWeightPure,
        openingWeightMixing,
        remainingWeightPure,
        remainingWeightMixing,
        totalMaterialWeightMixing,
        totalMaterialWeightPure,
      });

      console.log(`Saved data for product: ${product}`);
    }
  } catch (error) {
    console.error("Error during cron job:", error);
  }
});







module.exports = { createUser, getCustomerbyId, getCustomer, getMaterialbyId,getMaterial, loginUser,Creatematerial,editMaterial, deleteMaterial, createCustomer, editCustomer, deleteCustomer,updateMaterialStatusById, updateCustomerStatusById, CreateCategoryCustomer, getCategoryCustomer, deleteCategoryCustomer, EditCategoryCustomer, getwalkingcustomer, getCustomerdetails };
