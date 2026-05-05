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
const { console } = require('inspector');
const Customerdata = mongoose.model("Customer", CustomerSchema); 
const billdata = mongoose.model("bill", billSchema);
const CustomerWeightdata = mongoose.model("customerWeight", customerWeightSchema); 
const materialdata = mongoose.model("material", materialSchema); 
const userData = mongoose.model('user', userSchema);
const CategoryCustomerdata = mongoose.model("CategoryCustomer", CategoryCustomerSchema); 
//form sales leider
const { salesPaymentSchema } = require("../schema/salesPayment");
const SalesPaymentData = mongoose.model("SalesPayment", salesPaymentSchema);



const createUser = async (req, res) => {
  console.log(req.body);
  try {
  
    const { username, email, password, userRole } = req.body;

  
    const existingUser = await userData.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

  
    const saltRounds = 10; 
    const hashedPassword = await bcrypt.hash(password, saltRounds);

   
    const newUser = new userData({
      username,
      email,
      password: hashedPassword, 
      userRole
    });


    await newUser.save();

  
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

   
    const user = await userData.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

   
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

 
    const payload = {
      userId: user._id,
      email: user.email,
      userRole: user.userRole,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h', 
    });

  
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
      isNorani,
      rate,

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
      isNorani,
      rate,
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
 
    const query = {
      product,
      date: { $gte: startDate, $lt: endDate },
    };

 
    query.userType = userType || "walkingCustomer";
    if (search) {
      query.clientName = { $regex: search, $options: "i" };
    }
    if (userId && userType === "specificCustomer") {
      query.userId = userId;
    }

  
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

  
    const customers = await Customerdata.find(query).skip(skip).limit(pageSize);

    const totalDocs = await Customerdata.countDocuments(query);

      const weights = await getMonthlyPurchaseAndSale(month, userType, product, userId);

      return res.status(200).json({
        message: "Customer and weights fetched successfully.",
        data: {
          data: customers, 
          weight: weights, 
          page: {
            page: pageNumber, 
            limit: pageSize, 
            totalDocs: totalDocs, 
          },
        },
      });
    
    }catch (error) {
    console.error("Error in getCustomer API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};


  const getMaterial = async (req, res) => {
  try {
    console.log("Database connected...");
    const { month, product, search, userId, userType, page = 1, limit = 10 } = req.query;
    console.error("Logging directly to terminal:", month, product, search, userId, userType);

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

    const materials = await materialdata.find(query).skip(skip).limit(pageSize);
    const totalDocs = await materialdata.countDocuments(query);

      const weight = await getMonthlyPurchaseAndSale(month, userType, product, userId);

      return res.status(200).json({
        message: "Materials and weights fetched successfully.",
        data: {
          data: materials,
          weight: weight,
          page: {
            page: pageNumber,
            limit: pageSize,
            totalDocs: totalDocs,
          },
        },
      });
    
    }catch (error) {
    console.error("Error in getMaterial API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};


const getCombinedData = async (req, res) => {
  try {
     const { month, product, search, userId, userType, page = 1, limit = 10 } = req.query;

    if (!month || !product) {
      return res.status(400).json({ message: "Month and product are required query parameters." });
    }

    // Parse year and month as numbers
    const [year, monthValue] = month.split("-").map(Number);
    if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
      return res.status(400).json({ message: "Invalid month format. Use YYYY-MM format." });
    }

    // Construct start and end dates using UTC to ensure consistency
    const startDate = new Date(Date.UTC(year, monthValue - 1, 1));
    const endDate = new Date(Date.UTC(year, monthValue, 1));


    // Construct common query
    const commonQuery = {
      product,
      date: { $gte: startDate, $lt: endDate },
      userType: userType || "walkingCustomer",
    };

    if (search) {
      commonQuery.$or = [
        { receivedFrom: { $regex: search, $options: "i" } },
        { clientName: { $regex: search, $options: "i" } },
      ];
    }

    if (userId && userType === "specificCustomer") {
      commonQuery.userId = userId;
    }

    // Pagination
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Fetch material data (Purchase)
    const purchaseData = await materialdata.find(commonQuery).lean();

    // Add identifier to distinguish
    const purchaseMapped = purchaseData.map(item => ({
      ...item,
      type: "purchase",
      name: item.receivedFrom || "N/A"
    }));

    // Fetch customer data (Sale)
    const saleData = await Customerdata.find(commonQuery).lean();

    const saleMapped = saleData.map(item => ({
      ...item,
      type: "sale",
      name: item.clientName || "N/A"
    }));

    // Combine and sort both
    // Combine and sort both (Ascending by date)
    const combined = [...purchaseMapped, ...saleMapped].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Pagination on combined data
    const paginatedData = combined.slice(skip, skip + pageSize);

    const weights = await getMonthlyPurchaseAndSale(month, userType, product, userId);

    res.status(200).json({
      message: "Combined purchase and sale data fetched successfully.",
      data: {
        data: paginatedData,
        weight: weights,
        testingDta: {startDate, endDate },
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs: combined.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in getCombinedData API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
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

const getcategoryCustomerbyId = async (req, res) => {
  try {
  
    const { id } = req.params;

    const categoryCustomer = await 
    CategoryCustomerdata.findOne({_id: id}) 
      
  
    return res.json({
      success: true,
      data: categoryCustomer,
     
    });
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ success: false, error: 'Error retrieving category customer' });
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
    const { date, quantity, quality, weightPure, weightMixing, mixingBagsWeight, grossWeight, receivedFrom, billNo, status, product, _id, userId ,userType, userName, rate, isNorani  } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Material ID is required' });
    }

    const updatedMaterial = await materialdata.findByIdAndUpdate(
      _id,
      { date, quantity, quality, weightPure, weightMixing, grossWeight, mixingBagsWeight, receivedFrom, billNo, status, product,userId , userType, userName,rate,isNorani},
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
    let { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product, userId, userType, phoneNumber, ratio,additionalRate, extraRate, extraAmount, totalAmount, description  } = req.body;

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
      if (billNo !== getBill.billNo) {
    return res.status(404).json({
    success: false,
     message: `The bill number you provided (${getBill.billNo}) does not exist.`,
  });
}
      billNo = getBill.billNo;
    } else {
      
      billNo = billNo;
      newBill.billNo = billNo;
      
      const createdBill = new billdata(newBill);
      await createdBill.save();
    }

    if (extraRate > 0) {
  additionalRate = true;
} else {
  additionalRate = false;
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
      ratio,
      additionalRate,
      extraRate,
      extraAmount,
      totalAmount,
      description,
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
    const { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product, ratio, phoneNumber, _id, additionalRate, extraRate , extraAmount, totalAmount, description } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    let customerData = await Customerdata.findOne({_id: _id })
    if(!customerData){
      return "not found"
    }

    await billdata.findOneAndUpdate({billNo: customerData.billNo }, {billNo: billNo});

    
    
    //billNo tem remove 

    const updatedCustomer = await Customerdata.findByIdAndUpdate(
      _id,
      { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, status, product, ratio, phoneNumber, additionalRate, extraRate , extraAmount, totalAmount, description },
      { new: true, runValidators: true }
    );

    await Customerdata.updateMany({billNo: customerData.billNo }, {billNo: billNo});


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
    const { search, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const filter = search
  ? { clientName: { $regex: search, $options: 'i' } }
  : {};
    const categoryCustomers = await CategoryCustomerdata.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const totalDocs = await CategoryCustomerdata.countDocuments(filter);

    return res.status(200).json({
      message: "Category customers fetched successfully.",
      data: {
        data: categoryCustomers,
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs: totalDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error in getCategoryCustomer API:", error);
    res.status(500).json({ message: "Internal server error.", error: error.message });
  }
};

const deleteCategoryCustomer = async (req, res) => {
  try {
  
    const { id } = req.params;

  
    if (!id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }


    const deletedCategoryCustomer = await CategoryCustomerdata.findByIdAndDelete(id);

   
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
      return res.status(400).json({ message: "ID is required" });
    }

    const updatedCategoryCustomer = await CategoryCustomerdata.findByIdAndUpdate(
      _id,
      { clientName, type, phoneNumber },
      { new: true }
    );

    if (!updatedCategoryCustomer) { // ✅ Corrected variable name
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({ 
      message: "Customer updated successfully", 
      CategoryCustomer: updatedCategoryCustomer 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getwalkingcustomer = async (req, res) => {
  try {
    const { month, search, page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    const matchCondition = { userType: "walkingCustomer" };

    if (month) {
      matchCondition.$expr = { $eq: [{ $substr: ["$date", 0, 7] }, month] };
    }

    if (search) {
      matchCondition.clientName = { $regex: search, $options: "i" };
    }

    const totalDocs = await Customerdata.countDocuments(matchCondition);

    const walkingCustomer = await Customerdata.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: "$billNo",
          clientName: { $first: "$clientName" }
        }
      },
      {
        $project: {
          _id: 0,
          phoneNumber: "$_id",
          clientName: 1
        }
      },
      { $skip: (pageNumber - 1) * pageSize },
      { $limit: pageSize }
    ]);

    return res.status(200).json({
      message: "Category customers fetched successfully.",
      data: {
        data: walkingCustomer,
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs: totalDocs
        }
      }
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};


const getCustomerdetails = async (req, res) => {
  try {
    const { month, userType, userId, phoneNumber, billNo, product, page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    let query = {};

    if (userType === "specificCustomer") {
      if (billNo) {
        query.$or = [
          { userId: userId },
          { billNo: billNo }
        ];
      } else {
        query.userId = userId;
      }
    } else if (userType === "walkingCustomer") {
      query.billNo = phoneNumber;
      query.userType = "walkingCustomer";
    }

    if (month) {
      const [year, monthValue] = month.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, monthValue - 1, 1));
      const endDate = new Date(Date.UTC(year, monthValue, 1));

      query.date = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const totalDocs = await Customerdata.countDocuments(query);

    const customerData = await Customerdata.find(query, {
      date: 1,
      quality: 1,
      dcNumber: 1,
      rate: 1,
      amount: 1,
      weightPure: 1,
      weightMixing: 1,
      grossWeight: 1,
      additionalRate: 1,
      extraRate: 1,
      extraAmount: 1,
      totalAmount: 1,
      description: 1,
    })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    const billSummary = await Customerdata.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$billNo",
          totalRate: {
            $sum: {
              $add: [
                "$rate",
                { $ifNull: ["$extraRate", 0] }
              ]
            }
          },
          totalAmount: {
            $sum: {
              $add: [
                "$amount",
                { $ifNull: ["$extraAmount", 0] }
              ]
            }
          },
          totalgrossWeight: { $sum: "$grossWeight" },
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          billNo: "$_id",
          _id: 0,
          totalRate: 1,
          totalAmount: 1,
          totalgrossWeight: 1,
          amount: 1,
        },
      },
    ]);

    // ✅ Agar userType specificCustomer hai, to Materialdata ka record dhoondo
    let materialInfo = [];
    if (userType === "specificCustomer" && userId && month) {
      const [year, monthValue] = month.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, monthValue - 1, 1));
      const endDate = new Date(Date.UTC(year, monthValue, 1));

      materialInfo = await materialdata.find({
        userId: userId,
        date: {
          $gte: startDate,
          $lt: endDate,
        },
        isNorani: true,
      });

      if (Array.isArray(materialInfo) && materialInfo.length > 0 && billSummary.length > 0) {
        materialInfo = materialInfo.map(item => {
          const { grossWeight, rate } = item;
          const amount = grossWeight * rate;

          // ✅ Inject 3 company fields into each materialInfo item
          return {
            ...item.toObject?.() || item, // handle Mongoose documents safely
            grossWeightCompany: grossWeight,
            rateCompany: rate,
            amountCompany: amount,
          };
        });
      }
    }

    const weights = await getMonthlyPurchaseAndSaleForExtrudingBilling(month, userType, userId);

    res.status(200).json({
      message: "Customer details fetched successfully.",
      data: {
        data: customerData,
        billNo: billSummary,
        materialInfo: materialInfo,
        weight: weights,
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs: totalDocs,
        },
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error });
  }
};


const getOpeningBalance = async (matchConditions, firstDayOfGivenMonth) => {
  const openingMatchConditions = { ...matchConditions, date: { $lt: firstDayOfGivenMonth } };


  const purchase = await materialdata.aggregate([
    {
      $match: openingMatchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" }
      }
    }
  ]);


  const sale = await Customerdata.aggregate([
    {
      $match: openingMatchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" }
      }
    }
  ]);

    const  purchaseWeightMixing = purchase[0]?.totalWeightMixing || 0;
    const purchaseWeightPure = purchase[0]?.totalWeightPure || 0;

    const saleWeightMixing = sale[0]?.totalWeightMixing || 0;
    const saleWeightPure = sale[0]?.totalWeightPure || 0;

    
    const openingBalanceWeightMixing = purchaseWeightMixing - saleWeightMixing;
    const openingBalanceWeightPure = purchaseWeightPure - saleWeightPure;

    return { openingBalanceWeightMixing, openingBalanceWeightPure };
    
    
};



const getMonthlyPurchaseAndSale = async (date, userType, product, userId ) => {

  // Parse year and month as numbers
    const [year, monthValue] = date.split("-").map(Number);
    
    if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
      return res.status(400).json({ message: "Invalid month format. Use YYYY-MM format." });
    }

    // Construct start and end dates using UTC to ensure consistency
    const startDate = new Date(Date.UTC(year, monthValue - 1, 1));
    const endDate = new Date(Date.UTC(year, monthValue, 1));

  // Define match conditions dynamically
  let matchConditions = {
    product,
    userType,
    date: { $gte: startDate, $lt: endDate } 
  }

  // Add userId filter only if userType is "specificCustomer"
  if (userType === "specificCustomer") {
    matchConditions.userId = userId;
  }
  console.log("okm", matchConditions)

  
  const purchase = await materialdata.aggregate([
    {
      $match: matchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" },
        totalPureBags: { $sum: "$pureBags" },
        totalMixingBags: { $sum: "$mixingBags"}
      }
    }
  ]);


  
  const sale = await Customerdata.aggregate([
    {
      $match: matchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" }
      }
    }
  ]);
  
 
  

  const { openingBalanceWeightMixing, openingBalanceWeightPure } = await getOpeningBalance(matchConditions, startDate);
  

    console.log("ilk", openingBalanceWeightMixing, openingBalanceWeightPure)

    const purchaseWeightMixing = purchase[0]?.totalWeightMixing || 0;
    const purchaseWeightPure = purchase[0]?.totalWeightPure || 0;

    const Mixingbags = purchase[0]?.totalMixingBags || 0;
    const Purebags = purchase[0]?. totalPureBags || 0;
   


    const saleWeightMixing = sale[0]?.totalWeightMixing || 0;
    const saleWeightPure = sale[0]?.totalWeightPure || 0;

    const totalPurchaseWeightMixing = purchaseWeightMixing + openingBalanceWeightMixing;
    const totalPurchaseWeightPure = purchaseWeightPure + openingBalanceWeightPure;

    
    const closingWeightMixing = totalPurchaseWeightMixing - saleWeightMixing;
    const closingWeightPure = totalPurchaseWeightPure - saleWeightPure;

    return { openingBalanceWeightMixing, openingBalanceWeightPure, purchaseWeightMixing, purchaseWeightPure, saleWeightMixing, saleWeightPure, totalPurchaseWeightMixing, totalPurchaseWeightPure, closingWeightMixing, closingWeightPure, Mixingbags, Purebags  }




}

const getMonthlyPurchaseAndSaleForExtrudingBilling = async (date, userType, userId ) => {

  // Parse year and month as numbers
    const [year, monthValue] = date.split("-").map(Number);
    
    if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
      return res.status(400).json({ message: "Invalid month format. Use YYYY-MM format." });
    }

    // Construct start and end dates using UTC to ensure consistency
    const startDate = new Date(Date.UTC(year, monthValue - 1, 1));
    const endDate = new Date(Date.UTC(year, monthValue, 1));

  // Define match conditions dynamically
  let matchConditions = {
    userType,
    date: { $gte: startDate, $lt: endDate } 
  }

  // Add userId filter only if userType is "specificCustomer"
  if (userType === "specificCustomer") {
    matchConditions.userId = userId;
  }
  console.log("okm", matchConditions)

  
  const purchase = await materialdata.aggregate([
    {
      $match: matchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" },
        totalPureBags: { $sum: "$pureBags" },
        totalMixingBags: { $sum: "$mixingBags"}
      }
    }
  ]);


  
  const sale = await Customerdata.aggregate([
    {
      $match: matchConditions
    },
    {
      $group: {
        _id: null,
        totalWeightMixing: { $sum: "$weightMixing" },
        totalWeightPure: { $sum: "$weightPure" }
      }
    }
  ]);
  
 
  

  const { openingBalanceWeightMixing, openingBalanceWeightPure } = await getOpeningBalance(matchConditions, startDate);
  

    console.log("ilk", openingBalanceWeightMixing, openingBalanceWeightPure)

    const purchaseWeightMixing = purchase[0]?.totalWeightMixing || 0;
    const purchaseWeightPure = purchase[0]?.totalWeightPure || 0;

    const Mixingbags = purchase[0]?.totalMixingBags || 0;
    const Purebags = purchase[0]?. totalPureBags || 0;
   


    const saleWeightMixing = sale[0]?.totalWeightMixing || 0;
    const saleWeightPure = sale[0]?.totalWeightPure || 0;

    const totalPurchaseWeightMixing = purchaseWeightMixing + openingBalanceWeightMixing;
    const totalPurchaseWeightPure = purchaseWeightPure + openingBalanceWeightPure;

    
    const closingWeightMixing = totalPurchaseWeightMixing - saleWeightMixing;
    const closingWeightPure = totalPurchaseWeightPure - saleWeightPure;

    return { openingBalanceWeightMixing, openingBalanceWeightPure, purchaseWeightMixing, purchaseWeightPure, saleWeightMixing, saleWeightPure, totalPurchaseWeightMixing, totalPurchaseWeightPure, closingWeightMixing, closingWeightPure, Mixingbags, Purebags  }




}


const receiveSalesPayment = async (req, res) => {
  try {
    const {
      userId,
      userType,
      clientName,
      phoneNumber,
      billNo,
      folio,
      date,
      amount,
      paymentMethod,
      description,
    } = req.body;

    if (!userType || !date || !amount) {
      return res.status(400).json({
        success: false,
        message: "userType, date and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    if (userType === "specificCustomer" && !userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required for specific customer",
      });
    }

    if (userType === "walkingCustomer" && !phoneNumber && !billNo) {
      return res.status(400).json({
        success: false,
        message: "phoneNumber or billNo is required for walking customer",
      });
    }

    const payment = new SalesPaymentData({
      userId,
      userType,
      clientName,
      phoneNumber,
      billNo,
      folio,
      date,
      amount,
      paymentMethod: paymentMethod || "cash",
      description: description || "Payment received",
    });

    await payment.save();

    return res.status(201).json({
      success: true,
      message: "Payment received successfully",
      data: payment,
    });

  } catch (error) {
    console.error("receiveSalesPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Error receiving payment",
      error: error.message,
    });
  }
};

const getSalesLedgerYearly = async (req, res) => {
  try {
    const { year, userType, userId, phoneNumber, billNo } = req.query;

    if (!year || !userType) {
      return res.status(400).json({
        success: false,
        message: "year and userType are required",
      });
    }

    const startDate = new Date(Date.UTC(Number(year), 0, 1));
    const endDate = new Date(Date.UTC(Number(year) + 1, 0, 1));

    const customerQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    const paymentQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    if (userType === "specificCustomer") {
      customerQuery.userId = userId;
      paymentQuery.userId = userId;
    }

    if (userType === "walkingCustomer") {
      if (billNo) {
        customerQuery.billNo = billNo;
        paymentQuery.billNo = billNo;
      }

      if (phoneNumber) {
        paymentQuery.phoneNumber = phoneNumber;
      }
    }

    const monthlyBills = await Customerdata.aggregate([
      { $match: customerQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          debit: {
            $sum: {
              $ifNull: ["$totalAmount", "$amount"],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: 1,
            },
          },
          description: {
            $concat: [
              "Monthly bill total - ",
              { $toString: "$_id.month" },
              "/",
              { $toString: "$_id.year" },
            ],
          },
          folio: "",
          debit: { $round: ["$debit", 2] },
          credit: { $literal: 0 },
        },
      },
    ]);

    const payments = await SalesPaymentData.find(paymentQuery).lean();

    const paymentEntries = payments.map((item) => ({
      date: item.date,
      description: item.description || "Payment received",
      folio: item.folio || "",
      debit: 0,
      credit: Number(item.amount || 0),
    }));

    const entries = [...monthlyBills, ...paymentEntries].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let balance = 0;

    const ledger = entries.map((item) => {
      balance += Number(item.debit || 0) - Number(item.credit || 0);

      return {
        ...item,
        balance: Number(balance.toFixed(2)),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Sales ledger fetched successfully",
      data: ledger,
    });
  } catch (error) {
    console.error("getSalesLedgerYearly error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching sales ledger",
      error: error.message,
    });
  }
};

const walkingCustomer = async (req, res) => {
  try {
    const { search, page = 1, limit = 1000 } = req.query;

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const matchQuery = {
      userType: "walkingCustomer",
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: "" },
      ],
    };

    if (search) {
      matchQuery.clientName = { $regex: search, $options: "i" };
    }

    const walkingCustomers = await Customerdata.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$clientName",
          clientName: { $first: "$clientName" },
          billNo: { $first: "$billNo" },
          
        },
      },
      { $sort: { latestDate: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $project: {
          _id: 0,
          clientName: 1,
          billNo: 1,
          
        },
      },
    ]);

    const totalResult = await Customerdata.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$clientName",
        },
      },
      {
        $count: "totalDocs",
      },
    ]);

    const totalDocs = totalResult[0]?.totalDocs || 0;

    return res.status(200).json({
      message: "Walking customers fetched successfully.",
      data: {
        data: walkingCustomers,
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error in getWalkingCustomer API:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};






module.exports = { createUser, getCustomerbyId, getCustomer, getMaterialbyId,getMaterial, loginUser,Creatematerial,editMaterial, deleteMaterial, createCustomer, editCustomer, deleteCustomer,updateMaterialStatusById, updateCustomerStatusById, CreateCategoryCustomer, getCategoryCustomer, deleteCategoryCustomer, EditCategoryCustomer, getwalkingcustomer, getCustomerdetails, getcategoryCustomerbyId, getCombinedData, receiveSalesPayment, getSalesLedgerYearly, walkingCustomer };
