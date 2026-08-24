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
const { purchasePaymentSchema } = require("../schema/purchasePayment");
const PurchasePaymentData = mongoose.model("PurchasePayment", purchasePaymentSchema);

const escapeRegex = (text = "") =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const generateWalkingCustomerRefNo = async () => {
  const latestRef = await Customerdata.aggregate([
    {
      $match: {
        userType: "walkingCustomer",
        ref_no: { $regex: /^WC-\d+$/ },
      },
    },
    {
      $project: {
        refNumber: {
          $toInt: {
            $arrayElemAt: [{ $split: ["$ref_no", "-"] }, 1],
          },
        },
      },
    },
    { $sort: { refNumber: -1 } },
    { $limit: 1 },
  ]);

  let nextNumber = latestRef[0]?.refNumber || 0;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    nextNumber += 1;
    const refNo = `WC-${String(nextNumber).padStart(4, "0")}`;
    const refExists = await Customerdata.exists({ ref_no: refNo });

    if (!refExists) {
      return refNo;
    }
  }

  throw new Error("Unable to generate unique walking customer ref_no");
};

const generateWalkingVendorRef = async () => {
  const latestRef = await materialdata.aggregate([
    {
      $match: {
        userType: "walkingCustomer",
        vendorRef: { $regex: /^VR-\d+$/ },
      },
    },
    {
      $project: {
        refNumber: {
          $toInt: {
            $arrayElemAt: [{ $split: ["$vendorRef", "-"] }, 1],
          },
        },
      },
    },
    { $sort: { refNumber: -1 } },
    { $limit: 1 },
  ]);

  let nextNumber = latestRef[0]?.refNumber || 0;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    nextNumber += 1;
    const vendorRef = `VR-${String(nextNumber).padStart(4, "0")}`;
    const refExists = await materialdata.exists({ vendorRef });

    if (!refExists) {
      return vendorRef;
    }
  }

  throw new Error("Unable to generate unique walking vendor ref");
};


const allowedUserRoles = ["admin", "manager", "accounts"];

const getUserResponse = (user) => {
  const userObject = user.toObject ? user.toObject() : user;
  const { password, ...safeUser } = userObject;
  return safeUser;
};


const createUser = async (req, res) => {
  console.log(req.body);
  try {
  
    const { username, email, password, userRole } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email and password are required' });
    }

    const normalizedRole = userRole || 'admin';
    if (!allowedUserRoles.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Invalid user role' });
    }

    const totalUsers = await userData.countDocuments();
    if (totalUsers === 0 && normalizedRole !== 'admin') {
      return res.status(400).json({ message: 'First user must be admin' });
    }

    if (totalUsers > 0) {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Admin token is required to create users' });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (tokenError) {
        return res.status(401).json({ message: 'Invalid admin token' });
      }

      if (decoded.userRole !== 'admin') {
        return res.status(403).json({ message: 'Only admin can create users' });
      }
    }

  
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
      userRole: normalizedRole
    });


    await newUser.save();

  
    res.status(201).json({ message: 'User created successfully', user: getUserResponse(newUser) });
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

    if (user.isActive === false) {
      return res.status(403).json({ error: 'User is inactive' });
    }

   
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password' });
    }

 
    const payload = {
      userId: user._id,
      email: user.email,
      userRole: user.userRole,
      userName: user.username,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h', 
    });

  
    res.status(200).json(
      
      {
        data: {message: 'Login successful',
          accessToken: token,
          user: getUserResponse(user)}
      
    });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await userData.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "email and newPassword are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await userData.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: error.message,
    });
  }
};
 
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Har mixing variety ka weight = us ki bags * us ki per bag weight.
// Agar bags na aayein lekin weight seedha bheja gaya ho to wahi weight le lete hain,
// taake client sirf jitni varieties use kare utni bhej sake (jo na bheje wo 0 rehti hai).
const varietyWeight = (bags, bagWeight, directWeight) =>
  toNumber(bags) && toNumber(bagWeight)
    ? toNumber(bags) * toNumber(bagWeight)
    : toNumber(directWeight);

const isProvided = (value) => value !== undefined && value !== null && value !== "";

// Sale (Customer) side par bags nahi hote — frontend seedha har variety ka weight bhejta hai.
const SALE_VARIETY_WEIGHT_FIELDS = [
  "weightmasterbatch",
  "weightlotterene",
  "weightRecycleLLD",
  "weightPlain",
  "weightCalpet",
];

const buildSaleVarietyWeights = (body = {}) => {
  const weights = {};
  let total = 0;
  let anyProvided = false;

  SALE_VARIETY_WEIGHT_FIELDS.forEach((field) => {
    if (isProvided(body[field])) anyProvided = true;
    weights[field] = toNumber(body[field]);
    total += weights[field];
  });

  return { weights, total, anyProvided };
};

// weightMixing hamesha TOTAL rehta hai (mixing + saari varieties) taake stock
// reconciliation aur grossWeight purane hisaab se hi chalte rahen.
// Jab varieties aayi hoN to body ka weightMixing base nahi banta — wo pehle se total
// hota hai, usme varieties dobara jorne se double count ho jata (khaas kar edit par).
const resolveSaleWeights = (body = {}) => {
  const { weights, total, anyProvided } = buildSaleVarietyWeights(body);
  const weightMixing = (anyProvided ? 0 : toNumber(body.weightMixing)) + total;

  // grossWeight frontend jo bheje wahi rehta hai — amount usi par bana hota hai.
  // Sirf na bhejne par calculate karte hain.
  const grossWeight = isProvided(body.grossWeight)
    ? toNumber(body.grossWeight)
    : toNumber(body.weightPure) + weightMixing;

  return { varietyWeights: weights, weightMixing, grossWeight };
};

const Creatematerial = async (req, res) => {
  try {
    const {
      date,
      pureBags,
      mixingBags,
      mixingBagsWeight,
      masterbatchBags,
      masterbatchBagsWeight,
      CalpetBags,
      CalpetBagsWeight,
      lottereneBags,
      lottereneBagsWeight,
      RecycleLLDBags,
      RecycleLLDBagsWeight,
      PlainBags,
      PlainBagsWeight,
      totalBags,
      quality,
      quantity,
      receivedFrom,
      vendorRef,
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

    let resolvedVendorRef = vendorRef ? String(vendorRef).trim() : "";

    if (userType === "walkingCustomer" && !resolvedVendorRef) {
      const existingVendor = await materialdata.findOne({
        userType: "walkingCustomer",
        receivedFrom: {
          $regex: `^${escapeRegex(String(receivedFrom || "").trim())}$`,
          $options: "i",
        },
        vendorRef: { $exists: true, $nin: [null, ""] },
      }).sort({ createdAt: -1 }).lean();

      resolvedVendorRef = existingVendor?.vendorRef || await generateWalkingVendorRef();
    }

    // Calculate weights based on the given logic
    const weightPure = pureBags ? pureBags * 25 : 0; // Multiply pureBags by 25
    const mixingWeight = mixingBags ? mixingBags * mixingBagsWeight : 0; // Multiply mixingBags by 25

    // Har variety: bags aayin to bags se, warna jo weight seedha bheja gaya wahi
    const weightmasterbatch = varietyWeight(masterbatchBags, masterbatchBagsWeight, req.body.weightmasterbatch);
    const weightCalpet = varietyWeight(CalpetBags, CalpetBagsWeight, req.body.weightCalpet);
    const weightlotterene = varietyWeight(lottereneBags, lottereneBagsWeight, req.body.weightlotterene);
    const weightRecycleLLD = varietyWeight(RecycleLLDBags, RecycleLLDBagsWeight, req.body.weightRecycleLLD);
    const weightPlain = varietyWeight(PlainBags, PlainBagsWeight, req.body.weightPlain);

    // Extruding customers me mixing ka column nahi aata, uski jagah ye varieties aati hain.
    // Stock reconciliation abhi bhi Pure/Mixing par chalti hai, is liye weightMixing me
    // mixing + saari varieties ka TOTAL save hota hai.
    const weightMixing =
      mixingWeight +
      weightmasterbatch +
      weightCalpet +
      weightlotterene +
      weightRecycleLLD +
      weightPlain;

    const grossWeight = weightPure + weightMixing;


    const newMaterial = new materialdata({
      date,
      pureBags,
      mixingBags,
      mixingBagsWeight,
      masterbatchBags,
      masterbatchBagsWeight,
      CalpetBags,
      CalpetBagsWeight,
      lottereneBags,
      lottereneBagsWeight,
      RecycleLLDBags,
      RecycleLLDBagsWeight,
      PlainBags,
      PlainBagsWeight,
      totalBags,
      quality,
      quantity,
      receivedFrom,
      vendorRef: resolvedVendorRef || undefined,
      billNo,
      status,
      product,
      userId,
      userType,
      phoneNumber,
      userName,
      isNorani,
      rate,
      weightPure,        // Add calculated weightPure
      weightMixing,      // mixing + saari varieties ka total
      weightmasterbatch, // Add calculated weightmasterbatch
      weightCalpet,      // Add calculated weightCalpet
      weightlotterene,   // Add calculated weightlotterene
      weightRecycleLLD,  // Add calculated weightRecycleLLD
      weightPlain,       // Add calculated weightPlain
      grossWeight,       // Add calculated grossWeight
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


const editMaterial = async (req, res) => {
  try {
    const {
      date,
      quantity,
      quality,
      weightPure,
      weightMixing,
      grossWeight,
      pureBags,
      mixingBags,
      mixingBagsWeight,
      masterbatchBags,
      masterbatchBagsWeight,
      CalpetBags,
      CalpetBagsWeight,
      lottereneBags,
      lottereneBagsWeight,
      RecycleLLDBags,
      RecycleLLDBagsWeight,
      PlainBags,
      PlainBagsWeight,
      totalBags,
      receivedFrom,
      vendorRef,
      billNo,
      status,
      product,
      _id,
      userId,
      userType,
      userName,
      rate,
      isNorani
    } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'Material ID is required' });
    }

    const updateData = {
      date, quantity, quality, mixingBagsWeight,
      receivedFrom, vendorRef, billNo, status, product, userId, userType, userName, rate, isNorani
    };

    // Recalculate tab hota hai jab body me ya to bags aayi hoN ya kisi variety ka seedha weight.
    // Body ka weightMixing yahan jaan boojh kar istemal nahi hota — wo pehle se total hota hai,
    // usme varieties dobara jorne se double count ho jata.
    const mixingInputProvided = [
      pureBags, mixingBags,
      masterbatchBags, CalpetBags, lottereneBags, RecycleLLDBags, PlainBags,
      req.body.weightmasterbatch, req.body.weightCalpet, req.body.weightlotterene,
      req.body.weightRecycleLLD, req.body.weightPlain,
    ].some((value) => value !== undefined && value !== null && value !== "");

    if (mixingInputProvided) {
      // pureBags aayin to unse, warna jo weightPure bheja gaya wahi (0 nahi, warna pure udd jata)
      const updatedWeightPure = pureBags ? pureBags * 25 : toNumber(weightPure);
      const mixingWeight = mixingBags ? mixingBags * mixingBagsWeight : 0;

      // Har variety: bags aayin to bags se, warna jo weight seedha bheja gaya wahi
      const weightmasterbatch = varietyWeight(masterbatchBags, masterbatchBagsWeight, req.body.weightmasterbatch);
      const weightCalpet = varietyWeight(CalpetBags, CalpetBagsWeight, req.body.weightCalpet);
      const weightlotterene = varietyWeight(lottereneBags, lottereneBagsWeight, req.body.weightlotterene);
      const weightRecycleLLD = varietyWeight(RecycleLLDBags, RecycleLLDBagsWeight, req.body.weightRecycleLLD);
      const weightPlain = varietyWeight(PlainBags, PlainBagsWeight, req.body.weightPlain);

      // weightMixing = mixing + saari varieties ka TOTAL (stock reconciliation isi par chalti hai)
      const updatedWeightMixing =
        mixingWeight +
        weightmasterbatch +
        weightCalpet +
        weightlotterene +
        weightRecycleLLD +
        weightPlain;

      Object.assign(updateData, {
        pureBags,
        mixingBags,
        masterbatchBags,
        masterbatchBagsWeight,
        CalpetBags,
        CalpetBagsWeight,
        lottereneBags,
        lottereneBagsWeight,
        RecycleLLDBags,
        RecycleLLDBagsWeight,
        PlainBags,
        PlainBagsWeight,
        totalBags,
        weightPure: updatedWeightPure,
        weightMixing: updatedWeightMixing,
        weightmasterbatch,
        weightCalpet,
        weightlotterene,
        weightRecycleLLD,
        weightPlain,
        grossWeight: updatedWeightPure + updatedWeightMixing,
      });
    } else {
      // Purana behaviour: frontend jo weight bhejta hai wahi save hota hai
      Object.assign(updateData, { weightPure, weightMixing, grossWeight });
    }

    const updatedMaterial = await materialdata.findByIdAndUpdate(
      _id,
      updateData,
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
    let { date, clientName, quality, dcNumber, weightPure, weightMixing, grossWeight, rate, amount, billNo, status, product, userId, userType, phoneNumber, ratio,additionalRate, extraRate, extraAmount, totalAmount, description, ref_no  } = req.body;

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

    if (userType === "walkingCustomer") {
      if (ref_no) {
        ref_no = String(ref_no).trim();
      }

      if (!ref_no) {
        const existingWalkingCustomer = await Customerdata.findOne({
          userType: "walkingCustomer",
          clientName: {
            $regex: `^${escapeRegex(String(clientName).trim())}$`,
            $options: "i",
          },
          ref_no: { $exists: true, $nin: [null, ""] },
        }).sort({ createdAt: -1 }).lean();

        ref_no = existingWalkingCustomer?.ref_no || await generateWalkingCustomerRefNo();
      }
    }


    // Extruding customers me mixing ka column nahi aata, uski jagah per-variety weights aate hain
    const saleWeights = resolveSaleWeights(req.body);

    const newCustomer = new Customerdata({
      date,
      clientName,
      quality,
      dcNumber,
      weightPure,
      weightMixing: saleWeights.weightMixing,   // mixing + saari varieties ka total
      ...saleWeights.varietyWeights,            // har variety ka apna weight
      grossWeight: saleWeights.grossWeight,
      rate,
      amount,
      billNo: billNo || newBill.billNo,
      status,
      product,
      userId,
      userType,
      phoneNumber,
      ref_no,
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

    const saleWeights = resolveSaleWeights(req.body);

    const updatedCustomer = await Customerdata.findByIdAndUpdate(
      _id,
      {
        date, clientName, quality, dcNumber,
        weightPure,
        weightMixing: saleWeights.weightMixing,   // mixing + saari varieties ka total
        ...saleWeights.varietyWeights,            // har variety ka apna weight
        grossWeight: saleWeights.grossWeight,
        rate, amount, status, product, ratio, phoneNumber, additionalRate, extraRate , extraAmount, totalAmount, description
      },
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
    const { month, search, groupby_name, page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const groupByName = groupby_name !== undefined && !["false", "0", "no"].includes(
      String(groupby_name).toLowerCase()
    );
    const groupByField = groupByName ? "$clientName" : "$billNo";

    const matchCondition = { userType: "walkingCustomer" };

    if (month) {
      matchCondition.$expr = { $eq: [{ $substr: ["$date", 0, 7] }, month] };
    }

    if (search) {
      matchCondition.clientName = { $regex: search, $options: "i" };
    }

    const totalResult = await Customerdata.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: groupByField,
        },
      },
      {
        $count: "totalDocs",
      },
    ]);

    const totalDocs = totalResult[0]?.totalDocs || 0;

    const walkingCustomer = await Customerdata.aggregate([
      { $match: matchCondition },
      { $sort: { createdAt: -1, date: -1, _id: -1 } },
      {
        $group: {
          _id: groupByField,
          clientName: { $first: "$clientName" },
          phoneNumber: { $first: "$phoneNumber" },
          billNo: { $first: "$billNo" },
          ref_no: { $max: "$ref_no" },
          latestCreatedAt: { $max: "$createdAt" },
          latestDate: { $max: "$date" }
        }
      },
      { $sort: { latestCreatedAt: -1, latestDate: -1 } },
      {
        $project: {
          _id: 0,
          phoneNumber: {
            $cond: [groupByName, "$phoneNumber", "$_id"]
          },
          billNo: "$billNo",
          ref_no: {
            $ifNull: ["$ref_no", ""]
          },
          clientName: {
            $cond: [groupByName, "$_id", "$clientName"]
          },
          groupBy: {
            $literal: groupByName ? "clientName" : "billNo"
          }
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

const getReceivedFromVendorRef = async (req, res) => {
  try {
    const { userType = "walkingCustomer", search, page = 1, limit = 100 } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 100, 1);
    const skip = (pageNumber - 1) * pageSize;

    const matchCondition = {
      userType,
      receivedFrom: { $exists: true, $nin: [null, ""] },
    };

    if (search) {
      matchCondition.receivedFrom = { $regex: search, $options: "i" };
    }

    const totalResult = await materialdata.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: "$receivedFrom",
        },
      },
      {
        $count: "totalDocs",
      },
    ]);

    const totalDocs = totalResult[0]?.totalDocs || 0;

    const vendors = await materialdata.aggregate([
      { $match: matchCondition },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$receivedFrom",
          vendorRef: { $first: "$vendorRef" },
          entries: { $sum: 1 },
          latestCreatedAt: { $first: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          receivedFrom: "$_id",
          vendorRef: { $ifNull: ["$vendorRef", ""] },
        },
      },
      { $sort: { entries: -1, latestCreatedAt: -1, receivedFrom: 1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]);

    return res.status(200).json({
      message: "Vendors fetched successfully.",
      data: {
        data: vendors,
        page: {
          page: pageNumber,
          limit: pageSize,
          totalDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};


const getCustomerdetails = async (req, res) => {
  try {
    const {
      month,
      fromMonth,
      toMonth,
      startMonth,
      endMonth,
      monthFrom,
      monthTo,
      from_month,
      to_month,
      userType,
      userId,
      phoneNumber,
      billNo,
      ref_no,
      product,
      page = 1,
      limit = 10
    } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    let query = {};
    let startDate = null;
    let endDate = null;
    let selectedMonth = month;

    const parseMonthDate = (value) => {
      if (!value) return null;

      const [year, monthValue] = String(value).split("-").map(Number);
      if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
        return null;
      }

      return { year, monthValue };
    };

    const selectedFromMonth = fromMonth || startMonth || monthFrom || from_month;
    const selectedToMonth = toMonth || endMonth || monthTo || to_month;

    if (selectedFromMonth || selectedToMonth) {
      const fromInfo = parseMonthDate(selectedFromMonth || selectedToMonth);
      const toInfo = parseMonthDate(selectedToMonth || selectedFromMonth);

      if (!fromInfo || !toInfo) {
        return res.status(400).json({
          message: "Invalid month range format. Use YYYY-MM for fromMonth and toMonth.",
        });
      }

      startDate = new Date(Date.UTC(fromInfo.year, fromInfo.monthValue - 1, 1));
      endDate = new Date(Date.UTC(toInfo.year, toInfo.monthValue, 1));

      if (startDate >= endDate) {
        return res.status(400).json({
          message: "fromMonth must be before or equal to toMonth.",
        });
      }
    } else if (month) {
      const monthInfo = parseMonthDate(month);

      if (!monthInfo) {
        return res.status(400).json({
          message: "Invalid month format. Use YYYY-MM.",
        });
      }

      startDate = new Date(Date.UTC(monthInfo.year, monthInfo.monthValue - 1, 1));
      endDate = new Date(Date.UTC(monthInfo.year, monthInfo.monthValue, 1));
    }

    if (userType === "specificCustomer") {
      if (product === "mergeBill") {
        const mergeConditions = [];
        if (userId) mergeConditions.push({ userId });
        if (ref_no) mergeConditions.push({ ref_no });

        if (!mergeConditions.length) {
          return res.status(400).json({ message: "userId or ref_no is required for mergeBill." });
        }

        query.$or = mergeConditions;
        
      } else {
        query.userId = userId;
      }
    } else if (userType === "walkingCustomer") {
      if (product === "mergeBill") {
        const mergeConditions = [];
        if (userId) mergeConditions.push({ userId });
        if (ref_no) mergeConditions.push({ ref_no });

        if (!mergeConditions.length) {
          return res.status(400).json({ message: "userId or ref_no is required for mergeBill." });
        }

        query.$or = mergeConditions;
      } else {
        query.ref_no = ref_no;
      }
      
    
    }

    if (startDate && endDate) {
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
    if (userType === "specificCustomer" && userId && startDate && endDate) {
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

    const weights = selectedMonth
      ? await getMonthlyPurchaseAndSaleForExtrudingBilling(selectedMonth, userType, userId)
      : {};

    res.status(200).json({
      message: "Customer details fetched successfully.",
      data: {
        rxtra: query,
        period: {
          month: selectedMonth || null,
          fromMonth: selectedFromMonth || null,
          toMonth: selectedToMonth || null,
        },
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


// Weight summary me mixing ka breakdown dikhane ke liye.
// NOTE: weightMixing khud TOTAL hai (base mixing + saari varieties), is liye niche
// "mixingOther" bhi nikala jata hai = Mixing - varieties. Isse rows jama kar ke
// theek Mixing wala number banta hai, double count nahi hota.
const SUMMARY_VARIETIES = [
  { key: "weightmasterbatch", label: "Masterbatch", bags: "masterbatchBags" },
  { key: "weightlotterene",   label: "Lotterene",   bags: "lottereneBags" },
  { key: "weightRecycleLLD",  label: "Recycle LLD", bags: "RecycleLLDBags" },
  { key: "weightPlain",       label: "Plain",       bags: "PlainBags" },
  { key: "weightCalpet",      label: "Calpet",      bags: "CalpetBags" },
];

// $group stage me har variety ka sum add kar deta hai
const varietySumStage = ({ withBags = false } = {}) => {
  const stage = {};
  SUMMARY_VARIETIES.forEach(({ key, bags }) => {
    stage[`sum_${key}`] = { $sum: `$${key}` };
    if (withBags) stage[`bags_${key}`] = { $sum: `$${bags}` };
  });
  return stage;
};

const varietySum = (row, key) => Number(row?.[`sum_${key}`] || 0);
const varietyBags = (row, key) => Number(row?.[`bags_${key}`] || 0);
const round2 = (value) => Number(Number(value || 0).toFixed(2));

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
        totalWeightPure: { $sum: "$weightPure" },
        ...varietySumStage()
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
        totalWeightPure: { $sum: "$weightPure" },
        ...varietySumStage()
      }
    }
  ]);

    const  purchaseWeightMixing = purchase[0]?.totalWeightMixing || 0;
    const purchaseWeightPure = purchase[0]?.totalWeightPure || 0;

    const saleWeightMixing = sale[0]?.totalWeightMixing || 0;
    const saleWeightPure = sale[0]?.totalWeightPure || 0;

    
    const openingBalanceWeightMixing = purchaseWeightMixing - saleWeightMixing;
    const openingBalanceWeightPure = purchaseWeightPure - saleWeightPure;

    // Har variety ka opening = us ki purchase - us ki sale
    const openingVarieties = {};
    SUMMARY_VARIETIES.forEach(({ key }) => {
      openingVarieties[key] = varietySum(purchase[0], key) - varietySum(sale[0], key);
    });

    return { openingBalanceWeightMixing, openingBalanceWeightPure, openingVarieties };
    
    
};



// Dono weight summaries (getMaterial/getCustomer aur getCustomerdetails) ka asal hisaab.
// Pehle ye code do jagah copy tha aur ek update hone par doosri chhoot jati thi.
const buildWeightSummary = async (matchConditions, startDate) => {
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
        totalMixingBags: { $sum: "$mixingBags"},
        ...varietySumStage({ withBags: true })
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
        totalWeightPure: { $sum: "$weightPure" },
        ...varietySumStage()
      }
    }
  ]);

  const { openingBalanceWeightMixing, openingBalanceWeightPure, openingVarieties } =
    await getOpeningBalance(matchConditions, startDate);

  const purchaseWeightMixing = purchase[0]?.totalWeightMixing || 0;
  const purchaseWeightPure = purchase[0]?.totalWeightPure || 0;

  const Mixingbags = purchase[0]?.totalMixingBags || 0;
  const Purebags = purchase[0]?.totalPureBags || 0;

  const saleWeightMixing = sale[0]?.totalWeightMixing || 0;
  const saleWeightPure = sale[0]?.totalWeightPure || 0;

  const totalPurchaseWeightMixing = purchaseWeightMixing + openingBalanceWeightMixing;
  const totalPurchaseWeightPure = purchaseWeightPure + openingBalanceWeightPure;

  const closingWeightMixing = totalPurchaseWeightMixing - saleWeightMixing;
  const closingWeightPure = totalPurchaseWeightPure - saleWeightPure;

  // ---- mixing ka breakdown (dikhane ke liye) ----
  const varieties = SUMMARY_VARIETIES.map(({ key, label, bags }) => {
    const opening = Number(openingVarieties?.[key] || 0);
    const varietyPurchase = varietySum(purchase[0], key);
    const varietySale = varietySum(sale[0], key);
    const totalPurchase = opening + varietyPurchase;

    return {
      key,
      label,
      openingBalance: round2(opening),
      purchase: round2(varietyPurchase),
      sale: round2(varietySale),
      totalPurchase: round2(totalPurchase),
      closing: round2(totalPurchase - varietySale),
      purchaseBags: varietyBags(purchase[0], key),
      bagsField: bags,
    };
  });

  // weightMixing khud TOTAL hai (base mixing + varieties). Ye row wo hissa hai jo
  // kisi variety me nahi gaya — is se saari rows ka jama theek Mixing ke barabar aata hai.
  const sumOf = (field) => varieties.reduce((total, item) => total + item[field], 0);
  varieties.push({
    key: "mixingOther",
    label: "Mixing (baqi)",
    openingBalance: round2(openingBalanceWeightMixing - sumOf("openingBalance")),
    purchase: round2(purchaseWeightMixing - sumOf("purchase")),
    sale: round2(saleWeightMixing - sumOf("sale")),
    totalPurchase: round2(totalPurchaseWeightMixing - sumOf("totalPurchase")),
    closing: round2(closingWeightMixing - sumOf("closing")),
    purchaseBags: Mixingbags,
    bagsField: "mixingBags",
  });

  return { openingBalanceWeightMixing, openingBalanceWeightPure, purchaseWeightMixing, purchaseWeightPure, saleWeightMixing, saleWeightPure, totalPurchaseWeightMixing, totalPurchaseWeightPure, closingWeightMixing, closingWeightPure, Mixingbags, Purebags, varieties };
};

// month "YYYY-MM" se us mahine ki start/end date banata hai
const getMonthRange = (date) => {
  const [year, monthValue] = String(date).split("-").map(Number);

  if (!year || !monthValue || isNaN(year) || isNaN(monthValue) || monthValue > 12 || monthValue < 1) {
    return null;
  }

  return {
    startDate: new Date(Date.UTC(year, monthValue - 1, 1)),
    endDate: new Date(Date.UTC(year, monthValue, 1)),
  };
};

const getMonthlyPurchaseAndSale = async (date, userType, product, userId) => {
  const range = getMonthRange(date);
  if (!range) return {};

  const matchConditions = {
    product,
    userType,
    date: { $gte: range.startDate, $lt: range.endDate }
  };

  // Add userId filter only if userType is "specificCustomer"
  if (userType === "specificCustomer") {
    matchConditions.userId = userId;
  }

  return buildWeightSummary(matchConditions, range.startDate);
};

// Wahi hisaab, bas product ka filter nahi lagta (extruding billing ke liye)
const getMonthlyPurchaseAndSaleForExtrudingBilling = async (date, userType, userId) => {
  const range = getMonthRange(date);
  if (!range) return {};

  const matchConditions = {
    userType,
    date: { $gte: range.startDate, $lt: range.endDate }
  };

  if (userType === "specificCustomer") {
    matchConditions.userId = userId;
  }

  return buildWeightSummary(matchConditions, range.startDate);
};

const receiveSalesPayment = async (req, res) => {
  try {
    const {
      userId,
      userType,
      clientName,
      ref_no,
      phoneNumber,
      billNo,
      folio,
      date,
      dueOnDate,
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

    if (userType === "walkingCustomer" && !ref_no) {
      return res.status(400).json({
        success: false,
        message: "ref_no is required for walking customer",
      });
    }

    const payment = new SalesPaymentData({
      userId,
      userType,
      clientName,
      ref_no,
      phoneNumber,
      billNo,
      folio,
      date,
      dueOnDate,
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

const deleteSalesPayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment id is required",
      });
    }

    const deletedPayment = await SalesPaymentData.findByIdAndDelete(id);

    if (!deletedPayment) {
      return res.status(404).json({
        success: false,
        message: "Sales payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sales payment deleted successfully",
      data: deletedPayment,
    });
  } catch (error) {
    console.error("deleteSalesPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting sales payment",
      error: error.message,
    });
  }
};

const editSalesPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      userId,
      userType,
      clientName,
      ref_no,
      phoneNumber,
      billNo,
      folio,
      date,
      dueOnDate,
      amount,
      paymentMethod,
      description,
    } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment id is required",
      });
    }

    if (amount !== undefined && Number(amount) <= 0) {
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

    if (userType === "walkingCustomer" && !ref_no) {
      return res.status(400).json({
        success: false,
        message: "ref_no is required for walking customer",
      });
    }

    const updateData = {};
    if (userId !== undefined) updateData.userId = userId;
    if (userType !== undefined) updateData.userType = userType;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (ref_no !== undefined) updateData.ref_no = ref_no;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (billNo !== undefined) updateData.billNo = billNo;
    if (folio !== undefined) updateData.folio = folio;
    if (date !== undefined) updateData.date = date;
    if (dueOnDate !== undefined) updateData.dueOnDate = dueOnDate;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (description !== undefined) updateData.description = description;

    const updatedPayment = await SalesPaymentData.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({
        success: false,
        message: "Sales payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sales payment updated successfully",
      data: updatedPayment,
    });
  } catch (error) {
    console.error("editSalesPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating sales payment",
      error: error.message,
    });
  }
};

const getSalesLedgerYearly = async (req, res) => {
  try {
    const {
      year,
      month,
      product,
      customerProduct,
      fromMonth,
      toMonth,
      startMonth,
      endMonth,
      monthFrom,
      monthTo,
      from_month,
      to_month,
      userType,
      userId,
      phoneNumber,
      billNo,
      userName,
      ref_no,
    } = req.query;

    if (!userType) {
      return res.status(400).json({
        success: false,
        message: "userType is required",
      });
    }

    const yearNumber = year ? Number(year) : null;
    if (year && !Number.isInteger(yearNumber)) {
      return res.status(400).json({
        success: false,
        message: "year must be a valid number",
      });
    }

    const monthNames = {
      january: 1,
      february: 2,
      feb: 2,
      march: 3,
      mar: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      jun: 6,
      july: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      sept: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };

    const parseMonthYear = (value, defaultYear = null) => {
      if (!value) return null;

      const normalizedValue = String(value)
        .trim()
        .toLowerCase()
        .replace(/[/_]/g, "-")
        .replace(/\s+/g, "-");

      const parts = normalizedValue.split("-").filter(Boolean);
      let parsedYear = defaultYear;
      let monthValue = null;

      for (const part of parts) {
        if (/^\d{4}$/.test(part)) {
          parsedYear = Number(part);
          continue;
        }

        if (!monthValue) {
          monthValue = monthNames[part] || Number(part);
        }
      }

      if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
        return null;
      }

      if (!Number.isInteger(parsedYear)) {
        return null;
      }

      return {
        year: parsedYear,
        month: monthValue,
      };
    };

    const selectedFromMonth = fromMonth || startMonth || monthFrom || from_month;
    const selectedToMonth = toMonth || endMonth || monthTo || to_month;
    let startDate;
    let endDate;
    let startMonthInfo = null;
    let endMonthInfo = null;

    if (selectedFromMonth && selectedToMonth) {
      startMonthInfo = parseMonthYear(selectedFromMonth, yearNumber);
      endMonthInfo = parseMonthYear(selectedToMonth, yearNumber);
    } else if (selectedFromMonth || selectedToMonth) {
      const selectedMonthInfo = parseMonthYear(selectedFromMonth || selectedToMonth, yearNumber);
      if (selectedMonthInfo) {
        startMonthInfo = {
          year: selectedMonthInfo.year,
          month: 1,
        };
        endMonthInfo = selectedMonthInfo;
      }
    } else if (month) {
      const selectedMonthInfo = parseMonthYear(month, yearNumber);
      if (!selectedMonthInfo) {
        return res.status(400).json({
          success: false,
          message: "month must be a valid month number/name, or a month-year value like jan-2025",
        });
      }

      startMonthInfo = {
        year: selectedMonthInfo.year,
        month: 1,
      };
      endMonthInfo = selectedMonthInfo;
    } else if (Number.isInteger(yearNumber)) {
      startMonthInfo = {
        year: yearNumber,
        month: 1,
      };
      endMonthInfo = {
        year: yearNumber,
        month: 12,
      };
    }

    if (!startMonthInfo || !endMonthInfo) {
      return res.status(400).json({
        success: false,
        message: "year is required unless month range includes year, for example fromMonth=jan-2025&toMonth=march-2025",
      });
    }

    startDate = new Date(Date.UTC(startMonthInfo.year, startMonthInfo.month - 1, 1));
    endDate = new Date(Date.UTC(endMonthInfo.year, endMonthInfo.month, 1));

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: "from month must be before or equal to to month",
      });
    }

    const customerQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    const paymentQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    const normalizedCustomerProduct = customerProduct
      ? String(customerProduct).trim().toLowerCase()
      : "all";

    if (!["poleythene", "hydensity", "all"].includes(normalizedCustomerProduct)) {
      return res.status(400).json({
        success: false,
        message: "customerProduct must be poleythene, hydensity or all",
      });
    }

    if (normalizedCustomerProduct !== "all") {
      customerQuery.product = normalizedCustomerProduct;
    }

    const applyMergeBillQuery = (query) => {
      const mergeConditions = [];

      if (userId) {
        mergeConditions.push({ userId });
      }

      if (ref_no) {
        mergeConditions.push({ ref_no });
      }

      if (mergeConditions.length === 0) {
        return false;
      }

      delete query.userType;
      query.$or = mergeConditions;
      return true;
    };

    if (userType === "specificCustomer") {
      if (product === "mergeBill") {
        const hasMergeBillFilter = applyMergeBillQuery(customerQuery);
        applyMergeBillQuery(paymentQuery);

        if (!hasMergeBillFilter) {
          return res.status(400).json({
            success: false,
            message: "userId or ref_no is required for mergeBill ledger",
          });
        }
      } else if (userId) {
        customerQuery.userId = userId;
        paymentQuery.userId = userId;
      }
    }

    if (userType === "walkingCustomer") {
      // if (billNo) {
      //   customerQuery.billNo = billNo;
      //   paymentQuery.billNo = billNo;
      // }

      if (product === "mergeBill") {
        const hasMergeBillFilter = applyMergeBillQuery(customerQuery);
        applyMergeBillQuery(paymentQuery);

        if (!hasMergeBillFilter) {
          return res.status(400).json({
            success: false,
            message: "userId or ref_no is required for mergeBill ledger",
          });
        }
      } else if (ref_no) {
        customerQuery.ref_no = ref_no;
        paymentQuery.ref_no = ref_no;
      } 
    }

    if(userType === "all"){
     delete customerQuery.userType
     delete paymentQuery.userType
    }

    const openingCustomerQuery = {
      ...customerQuery,
      date: { $lt: startDate },
    };

    const openingPaymentQuery = {
      ...paymentQuery,
      date: { $lt: startDate },
    };

    const [openingBills, openingPayments] = await Promise.all([
      Customerdata.aggregate([
        { $match: openingCustomerQuery },
        {
          $group: {
            _id: null,
            debit: {
              $sum: {
                $ifNull: ["$totalAmount", "$amount"],
              },
            },
          },
        },
      ]),
      SalesPaymentData.aggregate([
        { $match: openingPaymentQuery },
        {
          $group: {
            _id: null,
            credit: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const openingDebit = Number(openingBills[0]?.debit || 0);
    const openingCredit = Number(openingPayments[0]?.credit || 0);
    const openingBalance = Number((openingDebit - openingCredit).toFixed(2));

    const monthlyBills = await Customerdata.aggregate([
      { $match: customerQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            userType: "$userType",
            userId: "$userId",
            ref_no: "$ref_no",
            clientName: "$clientName",
          },
          debit: {
            $sum: {
              $ifNull: ["$totalAmount", "$amount"],
            },
          },
          billNumbers: {
            $addToSet: "$billNo",
          },
          refNumbers: {
            $addToSet: "$ref_no",
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
          clientName: { $ifNull: ["$_id.clientName", ""] },
          userType: { $ifNull: ["$_id.userType", ""] },
          customerType: { $ifNull: ["$_id.userType", ""] },
          userId: { $ifNull: ["$_id.userId", ""] },
          billNo: {
            $reduce: {
              input: {
                $filter: {
                  input: "$billNumbers",
                  as: "billNumber",
                  cond: {
                    $and: [
                      { $ne: ["$$billNumber", null] },
                      { $ne: ["$$billNumber", ""] },
                    ],
                  },
                },
              },
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] },
                ],
              },
            },
          },
          paymentId: "",
          dueOnDate: "",
          ref_no: {
            $reduce: {
              input: {
                $filter: {
                  input: "$refNumbers",
                  as: "refNumber",
                  cond: {
                    $and: [
                      { $ne: ["$$refNumber", null] },
                      { $ne: ["$$refNumber", ""] },
                    ],
                  },
                },
              },
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] },
                ],
              },
            },
          },
          customer: {
            clientName: { $ifNull: ["$_id.clientName", ""] },
            userType: { $ifNull: ["$_id.userType", ""] },
            userId: { $ifNull: ["$_id.userId", ""] },
            ref_no: { $ifNull: ["$_id.ref_no", ""] },
          },
          debit: { $round: ["$debit", 2] },
          credit: { $literal: 0 },
          entryType: { $literal: "bill" },
        },
      },
    ]);

    const isAllCustomersLedger = !userId && !ref_no;
    let paymentEntries = [];

    if (isAllCustomersLedger) {
      paymentEntries = await SalesPaymentData.aggregate([
        { $match: paymentQuery },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              customerKey: {
                $cond: [
                  { $ne: [{ $ifNull: ["$userId", ""] }, ""] },
                  { $concat: ["user:", "$userId"] },
                  {
                    $cond: [
                      { $ne: [{ $ifNull: ["$ref_no", ""] }, ""] },
                      { $concat: ["ref:", "$ref_no"] },
                      {
                        $concat: [
                          "name:",
                          { $toLower: { $ifNull: ["$clientName", ""] } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            credit: { $sum: "$amount" },
            paymentCount: { $sum: 1 },
            billNumbers: { $addToSet: "$billNo" },
            folios: { $addToSet: "$folio" },
            clientName: { $first: "$clientName" },
            userType: { $first: "$userType" },
            userId: { $first: "$userId" },
            ref_no: { $first: "$ref_no" },
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
                "Monthly payment total - ",
                { $toString: "$paymentCount" },
                " payment(s) - ",
                { $toString: "$_id.month" },
                "/",
                { $toString: "$_id.year" },
              ],
            },
            folio: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$folios",
                    as: "folioValue",
                    cond: {
                      $and: [
                        { $ne: ["$$folioValue", null] },
                        { $ne: ["$$folioValue", ""] },
                      ],
                    },
                  },
                },
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this",
                    { $concat: ["$$value", ", ", "$$this"] },
                  ],
                },
              },
            },
            billNo: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$billNumbers",
                    as: "billNumber",
                    cond: {
                      $and: [
                        { $ne: ["$$billNumber", null] },
                        { $ne: ["$$billNumber", ""] },
                      ],
                    },
                  },
                },
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this",
                    { $concat: ["$$value", ", ", "$$this"] },
                  ],
                },
              },
            },
            paymentId: "",
            dueOnDate: "",
            clientName: { $ifNull: ["$clientName", ""] },
            userType: { $ifNull: ["$userType", ""] },
            customerType: { $ifNull: ["$userType", ""] },
            userId: { $ifNull: ["$userId", ""] },
            ref_no: { $ifNull: ["$ref_no", ""] },
            customer: {
              clientName: { $ifNull: ["$clientName", ""] },
              userType: { $ifNull: ["$userType", ""] },
              userId: { $ifNull: ["$userId", ""] },
              ref_no: { $ifNull: ["$ref_no", ""] },
            },
            paymentCount: 1,
            debit: { $literal: 0 },
            credit: { $round: ["$credit", 2] },
            entryType: { $literal: "payment" },
          },
        },
      ]);
    } else {
      const payments = await SalesPaymentData.find(paymentQuery).lean();

      paymentEntries = payments.map((item) => ({
        date: item.date,
        description: item.description || "Payment received",
        folio: item.folio || "",
        billNo: item.billNo || "",
        paymentId: item._id,
        dueOnDate: item.dueOnDate || "",
        clientName: item.clientName || "",
        userType: item.userType || "",
        customerType: item.userType || "",
        userId: item.userId || "",
        ref_no: item.ref_no || "",
        customer: {
          clientName: item.clientName || "",
          userType: item.userType || "",
          userId: item.userId || "",
          ref_no: item.ref_no || "",
        },
        paymentCount: 1,
        debit: 0,
        credit: Number(item.amount || 0),
        entryType: "payment",
      }));
    }

    const entries = [...monthlyBills, ...paymentEntries].sort(
      (a, b) => {
        const dateDifference = new Date(a.date) - new Date(b.date);
        if (dateDifference !== 0) return dateDifference;
        return String(a.entryType || "").localeCompare(String(b.entryType || ""));
      }
    );

    let balance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const openingEntry = {
      date: startDate,
      description: "Opening balance",
      folio: "",
      billNo: billNo || "",
      paymentId: "",
      dueOnDate: "",
      clientName: userName || "",
      userType,
      customerType: userType,
      userId: userId || "",
      ref_no: ref_no || "",
      customer: {
        clientName: userName || "",
        userType,
        userId: userId || "",
        ref_no: ref_no || "",
      },
      debit: 0,
      credit: 0,
      balance: openingBalance,
      entryType: "opening",
    };

    const ledger = entries.map((item) => {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);

      totalDebit += debit;
      totalCredit += credit;
      balance += debit - credit;

      return {
        ...item,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      };
    });

    const finalBalance = Number(balance.toFixed(2));
    const finalEntry = {
      date: endDate,
      description: "Final total",
      folio: "",
      billNo: billNo || "",
      paymentId: "",
      dueOnDate: "",
      clientName: userName || "",
      userType,
      customerType: userType,
      userId: userId || "",
      ref_no: ref_no || "",
      customer: {
        clientName: userName || "",
        userType,
        userId: userId || "",
        ref_no: ref_no || "",
      },
      debit: Number(totalDebit.toFixed(2)),
      credit: Number(totalCredit.toFixed(2)),
      balance: finalBalance,
      entryType: "total",
    };

    return res.status(200).json({
      success: true,
      message: "Sales ledger fetched successfully",
      data: [openingEntry, ...ledger, finalEntry],
      summary: {
        year: yearNumber || startMonthInfo.year,
        customerProduct: normalizedCustomerProduct,
        fromMonth: `${startMonthInfo.year}-${String(startMonthInfo.month).padStart(2, "0")}`,
        toMonth: `${endMonthInfo.year}-${String(endMonthInfo.month).padStart(2, "0")}`,
        openingBalance,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        closingBalance: finalBalance,
        finalBalance,
      },
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

const getSalesLedgerSummary = async (req, res) => {
  try {
    const {
      year,
      month,
      product,
      customerProduct,
      fromMonth,
      toMonth,
      startMonth,
      endMonth,
      monthFrom,
      monthTo,
      from_month,
      to_month,
      userType,
      userId,
      phoneNumber,
      billNo,
      userName,
      ref_no,
    } = req.query;

    if (!userType) {
      return res.status(400).json({
        success: false,
        message: "userType is required",
      });
    }

    const yearNumber = year ? Number(year) : null;
    if (year && !Number.isInteger(yearNumber)) {
      return res.status(400).json({
        success: false,
        message: "year must be a valid number",
      });
    }

    const monthNames = {
      january: 1,
      february: 2,
      feb: 2,
      march: 3,
      mar: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      jun: 6,
      july: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      sept: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };

    const parseMonthYear = (value, defaultYear = null) => {
      if (!value) return null;

      const normalizedValue = String(value)
        .trim()
        .toLowerCase()
        .replace(/[/_]/g, "-")
        .replace(/\s+/g, "-");

      const parts = normalizedValue.split("-").filter(Boolean);
      let parsedYear = defaultYear;
      let monthValue = null;

      for (const part of parts) {
        if (/^\d{4}$/.test(part)) {
          parsedYear = Number(part);
          continue;
        }

        if (!monthValue) {
          monthValue = monthNames[part] || Number(part);
        }
      }

      if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
        return null;
      }

      if (!Number.isInteger(parsedYear)) {
        return null;
      }

      return {
        year: parsedYear,
        month: monthValue,
      };
    };

    const selectedFromMonth = fromMonth || startMonth || monthFrom || from_month;
    const selectedToMonth = toMonth || endMonth || monthTo || to_month;
    let startDate;
    let endDate;
    let startMonthInfo = null;
    let endMonthInfo = null;

    if (selectedFromMonth && selectedToMonth) {
      startMonthInfo = parseMonthYear(selectedFromMonth, yearNumber);
      endMonthInfo = parseMonthYear(selectedToMonth, yearNumber);
    } else if (selectedFromMonth || selectedToMonth) {
      const selectedMonthInfo = parseMonthYear(selectedFromMonth || selectedToMonth, yearNumber);
      if (selectedMonthInfo) {
        startMonthInfo = {
          year: selectedMonthInfo.year,
          month: 1,
        };
        endMonthInfo = selectedMonthInfo;
      }
    } else if (month) {
      const selectedMonthInfo = parseMonthYear(month, yearNumber);
      if (!selectedMonthInfo) {
        return res.status(400).json({
          success: false,
          message: "month must be a valid month number/name, or a month-year value like jan-2025",
        });
      }

      startMonthInfo = {
        year: selectedMonthInfo.year,
        month: 1,
      };
      endMonthInfo = selectedMonthInfo;
    } else if (Number.isInteger(yearNumber)) {
      startMonthInfo = {
        year: yearNumber,
        month: 1,
      };
      endMonthInfo = {
        year: yearNumber,
        month: 12,
      };
    }

    if (!startMonthInfo || !endMonthInfo) {
      return res.status(400).json({
        success: false,
        message: "year is required unless month range includes year, for example fromMonth=jan-2025&toMonth=march-2025",
      });
    }

    startDate = new Date(Date.UTC(startMonthInfo.year, startMonthInfo.month - 1, 1));
    endDate = new Date(Date.UTC(endMonthInfo.year, endMonthInfo.month, 1));

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: "from month must be before or equal to to month",
      });
    }

    const customerQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    const paymentQuery = {
      userType,
      date: { $gte: startDate, $lt: endDate },
    };

    const normalizedCustomerProduct = customerProduct
      ? String(customerProduct).trim().toLowerCase()
      : "all";

    if (!["poleythene", "hydensity", "all"].includes(normalizedCustomerProduct)) {
      return res.status(400).json({
        success: false,
        message: "customerProduct must be poleythene, hydensity or all",
      });
    }

    if (normalizedCustomerProduct !== "all") {
      customerQuery.product = normalizedCustomerProduct;
    }

    const applyMergeBillQuery = (query) => {
      const mergeConditions = [];

      if (userId) {
        mergeConditions.push({ userId });
      }

      if (ref_no) {
        mergeConditions.push({ ref_no });
      }

      if (mergeConditions.length === 0) {
        return false;
      }

      delete query.userType;
      query.$or = mergeConditions;
      return true;
    };

    if (userType === "specificCustomer") {
      if (product === "mergeBill") {
        const hasMergeBillFilter = applyMergeBillQuery(customerQuery);
        applyMergeBillQuery(paymentQuery);

        if (!hasMergeBillFilter) {
          return res.status(400).json({
            success: false,
            message: "userId or ref_no is required for mergeBill ledger",
          });
        }
      } else if (userId) {
        customerQuery.userId = userId;
        paymentQuery.userId = userId;
      }
    }

    if (userType === "walkingCustomer") {
      // if (billNo) {
      //   customerQuery.billNo = billNo;
      //   paymentQuery.billNo = billNo;
      // }

      if (product === "mergeBill") {
        const hasMergeBillFilter = applyMergeBillQuery(customerQuery);
        applyMergeBillQuery(paymentQuery);

        if (!hasMergeBillFilter) {
          return res.status(400).json({
            success: false,
            message: "userId or ref_no is required for mergeBill ledger",
          });
        }
      } else if (ref_no) {
        customerQuery.ref_no = ref_no;
        paymentQuery.ref_no = ref_no;
      } 
    }

    if(userType === "all"){
     delete customerQuery.userType
     delete paymentQuery.userType
    }

    const openingCustomerQuery = {
      ...customerQuery,
      date: { $lt: startDate },
    };

    const openingPaymentQuery = {
      ...paymentQuery,
      date: { $lt: startDate },
    };

    const [openingBills, openingPayments] = await Promise.all([
      Customerdata.aggregate([
        { $match: openingCustomerQuery },
        {
          $group: {
            _id: null,
            debit: {
              $sum: {
                $ifNull: ["$totalAmount", "$amount"],
              },
            },
          },
        },
      ]),
      SalesPaymentData.aggregate([
        { $match: openingPaymentQuery },
        {
          $group: {
            _id: null,
            credit: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const openingDebit = Number(openingBills[0]?.debit || 0);
    const openingCredit = Number(openingPayments[0]?.credit || 0);
    const openingBalance = Number((openingDebit - openingCredit).toFixed(2));

    const monthlyBills = await Customerdata.aggregate([
      { $match: customerQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            userType: "$userType",
            userId: "$userId",
            ref_no: "$ref_no",
            clientName: "$clientName",
          },
          debit: {
            $sum: {
              $ifNull: ["$totalAmount", "$amount"],
            },
          },
          billNumbers: {
            $addToSet: "$billNo",
          },
          refNumbers: {
            $addToSet: "$ref_no",
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
          clientName: { $ifNull: ["$_id.clientName", ""] },
          userType: { $ifNull: ["$_id.userType", ""] },
          customerType: { $ifNull: ["$_id.userType", ""] },
          userId: { $ifNull: ["$_id.userId", ""] },
          billNo: {
            $reduce: {
              input: {
                $filter: {
                  input: "$billNumbers",
                  as: "billNumber",
                  cond: {
                    $and: [
                      { $ne: ["$$billNumber", null] },
                      { $ne: ["$$billNumber", ""] },
                    ],
                  },
                },
              },
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] },
                ],
              },
            },
          },
          paymentId: "",
          dueOnDate: "",
          ref_no: {
            $reduce: {
              input: {
                $filter: {
                  input: "$refNumbers",
                  as: "refNumber",
                  cond: {
                    $and: [
                      { $ne: ["$$refNumber", null] },
                      { $ne: ["$$refNumber", ""] },
                    ],
                  },
                },
              },
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] },
                ],
              },
            },
          },
          customer: {
            clientName: { $ifNull: ["$_id.clientName", ""] },
            userType: { $ifNull: ["$_id.userType", ""] },
            userId: { $ifNull: ["$_id.userId", ""] },
            ref_no: { $ifNull: ["$_id.ref_no", ""] },
          },
          debit: { $round: ["$debit", 2] },
          credit: { $literal: 0 },
          entryType: { $literal: "bill" },
        },
      },
    ]);

    const isAllCustomersLedger = !userId && !ref_no;
    let paymentEntries = [];

    if (isAllCustomersLedger) {
      paymentEntries = await SalesPaymentData.aggregate([
        { $match: paymentQuery },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              customerKey: {
                $cond: [
                  { $ne: [{ $ifNull: ["$userId", ""] }, ""] },
                  { $concat: ["user:", "$userId"] },
                  {
                    $cond: [
                      { $ne: [{ $ifNull: ["$ref_no", ""] }, ""] },
                      { $concat: ["ref:", "$ref_no"] },
                      {
                        $concat: [
                          "name:",
                          { $toLower: { $ifNull: ["$clientName", ""] } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            credit: { $sum: "$amount" },
            paymentCount: { $sum: 1 },
            billNumbers: { $addToSet: "$billNo" },
            folios: { $addToSet: "$folio" },
            clientName: { $first: "$clientName" },
            userType: { $first: "$userType" },
            userId: { $first: "$userId" },
            ref_no: { $first: "$ref_no" },
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
                "Monthly payment total - ",
                { $toString: "$paymentCount" },
                " payment(s) - ",
                { $toString: "$_id.month" },
                "/",
                { $toString: "$_id.year" },
              ],
            },
            folio: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$folios",
                    as: "folioValue",
                    cond: {
                      $and: [
                        { $ne: ["$$folioValue", null] },
                        { $ne: ["$$folioValue", ""] },
                      ],
                    },
                  },
                },
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this",
                    { $concat: ["$$value", ", ", "$$this"] },
                  ],
                },
              },
            },
            billNo: {
              $reduce: {
                input: {
                  $filter: {
                    input: "$billNumbers",
                    as: "billNumber",
                    cond: {
                      $and: [
                        { $ne: ["$$billNumber", null] },
                        { $ne: ["$$billNumber", ""] },
                      ],
                    },
                  },
                },
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this",
                    { $concat: ["$$value", ", ", "$$this"] },
                  ],
                },
              },
            },
            paymentId: "",
            dueOnDate: "",
            clientName: { $ifNull: ["$clientName", ""] },
            userType: { $ifNull: ["$userType", ""] },
            customerType: { $ifNull: ["$userType", ""] },
            userId: { $ifNull: ["$userId", ""] },
            ref_no: { $ifNull: ["$ref_no", ""] },
            customer: {
              clientName: { $ifNull: ["$clientName", ""] },
              userType: { $ifNull: ["$userType", ""] },
              userId: { $ifNull: ["$userId", ""] },
              ref_no: { $ifNull: ["$ref_no", ""] },
            },
            paymentCount: 1,
            debit: { $literal: 0 },
            credit: { $round: ["$credit", 2] },
            entryType: { $literal: "payment" },
          },
        },
      ]);
    } else {
      const payments = await SalesPaymentData.find(paymentQuery).lean();

      paymentEntries = payments.map((item) => ({
        date: item.date,
        description: item.description || "Payment received",
        folio: item.folio || "",
        billNo: item.billNo || "",
        paymentId: item._id,
        dueOnDate: item.dueOnDate || "",
        clientName: item.clientName || "",
        userType: item.userType || "",
        customerType: item.userType || "",
        userId: item.userId || "",
        ref_no: item.ref_no || "",
        customer: {
          clientName: item.clientName || "",
          userType: item.userType || "",
          userId: item.userId || "",
          ref_no: item.ref_no || "",
        },
        paymentCount: 1,
        debit: 0,
        credit: Number(item.amount || 0),
        entryType: "payment",
      }));
    }

    const mergeLedgerSummaryEntries = (items) => {
      const mergedMap = new Map();

      const appendText = (currentValue = "", nextValue = "") => {
        if (!nextValue) return currentValue || "";
        if (!currentValue) return nextValue;
        if (String(currentValue).split(", ").includes(String(nextValue))) return currentValue;
        return `${currentValue}, ${nextValue}`;
      };

      items.forEach((item) => {
        const itemDate = new Date(item.date);
        const monthDate = new Date(Date.UTC(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), 1));
        const identityKey = item.userId
          ? `user:${item.userId}`
          : item.ref_no
            ? `ref:${item.ref_no}`
            : `name:${String(item.clientName || "").toLowerCase()}`;
        const mergeKey = `${monthDate.toISOString()}|${item.userType || ""}|${identityKey}`;

        if (!mergedMap.has(mergeKey)) {
          mergedMap.set(mergeKey, {
            ...item,
            date: monthDate,
            description: "",
            folio: "",
            billNo: "",
            paymentId: "",
            dueOnDate: "",
            debit: 0,
            credit: 0,
            paymentCount: 0,
            entryType: "summary",
          });
        }

        const mergedItem = mergedMap.get(mergeKey);
        mergedItem.debit += Number(item.debit || 0);
        mergedItem.credit += Number(item.credit || 0);
        mergedItem.paymentCount += Number(item.paymentCount || (item.entryType === "payment" ? 1 : 0));
        mergedItem.description = appendText(mergedItem.description, item.description);
        mergedItem.folio = appendText(mergedItem.folio, item.folio);
        mergedItem.billNo = appendText(mergedItem.billNo, item.billNo);

        if (!mergedItem.clientName && item.clientName) mergedItem.clientName = item.clientName;
        if (!mergedItem.userType && item.userType) mergedItem.userType = item.userType;
        if (!mergedItem.customerType && item.customerType) mergedItem.customerType = item.customerType;
        if (!mergedItem.userId && item.userId) mergedItem.userId = item.userId;
        if (!mergedItem.ref_no && item.ref_no) mergedItem.ref_no = item.ref_no;
        if (!mergedItem.customer?.clientName && item.customer) mergedItem.customer = item.customer;
      });

      return Array.from(mergedMap.values()).map((item) => ({
        ...item,
        debit: Number(item.debit.toFixed(2)),
        credit: Number(item.credit.toFixed(2)),
        paymentCount: item.paymentCount || 0,
      }));
    };

    const mergedSummaryEntries = mergeLedgerSummaryEntries([...monthlyBills, ...paymentEntries]);

    const entries = mergedSummaryEntries.sort(
      (a, b) => {
        const dateDifference = new Date(a.date) - new Date(b.date);
        if (dateDifference !== 0) return dateDifference;
        return String(a.entryType || "").localeCompare(String(b.entryType || ""));
      }
    );

    let balance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const openingEntry = {
      date: startDate,
      description: "Opening balance",
      folio: "",
      billNo: billNo || "",
      paymentId: "",
      dueOnDate: "",
      clientName: userName || "",
      userType,
      customerType: userType,
      userId: userId || "",
      ref_no: ref_no || "",
      customer: {
        clientName: userName || "",
        userType,
        userId: userId || "",
        ref_no: ref_no || "",
      },
      debit: 0,
      credit: 0,
      balance: openingBalance,
      entryType: "opening",
    };

    const ledger = entries.map((item) => {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);

      totalDebit += debit;
      totalCredit += credit;
      balance += debit - credit;

      return {
        ...item,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        balance: Number(balance.toFixed(2)),
      };
    });

    const finalBalance = Number(balance.toFixed(2));
    const finalEntry = {
      date: endDate,
      description: "Final total",
      folio: "",
      billNo: billNo || "",
      paymentId: "",
      dueOnDate: "",
      clientName: userName || "",
      userType,
      customerType: userType,
      userId: userId || "",
      ref_no: ref_no || "",
      customer: {
        clientName: userName || "",
        userType,
        userId: userId || "",
        ref_no: ref_no || "",
      },
      debit: Number(totalDebit.toFixed(2)),
      credit: Number(totalCredit.toFixed(2)),
      balance: finalBalance,
      entryType: "total",
    };

    return res.status(200).json({
      success: true,
      message: "Sales ledger fetched successfully",
      data: [openingEntry, ...ledger, finalEntry],
      summary: {
        year: yearNumber || startMonthInfo.year,
        customerProduct: normalizedCustomerProduct,
        fromMonth: `${startMonthInfo.year}-${String(startMonthInfo.month).padStart(2, "0")}`,
        toMonth: `${endMonthInfo.year}-${String(endMonthInfo.month).padStart(2, "0")}`,
        openingBalance,
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        closingBalance: finalBalance,
        finalBalance,
      },
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

const getPurchaseLedgerSummary = async (req, res) => {
  try {
    const {
      year,
      month,
      fromMonth,
      toMonth,
      startMonth,
      endMonth,
      monthFrom,
      monthTo,
      from_month,
      to_month,
      userType = "all",
      userId,
      vendorRef,
      vendorName,
      receivedFrom,
      userName,
      phoneNumber,
      billNo,
      product,
    } = req.query;

    if (!["all", "walkingCustomer", "specificCustomer"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "userType must be all, walkingCustomer or specificCustomer",
      });
    }

    const yearNumber = year ? Number(year) : null;
    if (year && !Number.isInteger(yearNumber)) {
      return res.status(400).json({
        success: false,
        message: "year must be a valid number",
      });
    }

    const monthNames = {
      january: 1, jan: 1,
      february: 2, feb: 2,
      march: 3, mar: 3,
      april: 4, apr: 4,
      may: 5,
      june: 6, jun: 6,
      july: 7, jul: 7,
      august: 8, aug: 8,
      september: 9, sep: 9, sept: 9,
      october: 10, oct: 10,
      november: 11, nov: 11,
      december: 12, dec: 12,
    };

    const parseMonthYear = (value, defaultYear = null) => {
      if (!value) return null;

      const parts = String(value)
        .trim()
        .toLowerCase()
        .replace(/[/_]/g, "-")
        .replace(/\s+/g, "-")
        .split("-")
        .filter(Boolean);

      let parsedYear = defaultYear;
      let parsedMonth = null;

      for (const part of parts) {
        if (/^\d{4}$/.test(part)) {
          parsedYear = Number(part);
        } else if (!parsedMonth) {
          parsedMonth = monthNames[part] || Number(part);
        }
      }

      if (
        !Number.isInteger(parsedYear) ||
        !Number.isInteger(parsedMonth) ||
        parsedMonth < 1 ||
        parsedMonth > 12
      ) {
        return null;
      }

      return { year: parsedYear, month: parsedMonth };
    };

    const selectedFromMonth = fromMonth || startMonth || monthFrom || from_month;
    const selectedToMonth = toMonth || endMonth || monthTo || to_month;
    let startMonthInfo = null;
    let endMonthInfo = null;

    if (selectedFromMonth && selectedToMonth) {
      startMonthInfo = parseMonthYear(selectedFromMonth, yearNumber);
      endMonthInfo = parseMonthYear(selectedToMonth, yearNumber);
    } else if (selectedFromMonth || selectedToMonth) {
      const selectedMonth = parseMonthYear(selectedFromMonth || selectedToMonth, yearNumber);
      if (selectedMonth) {
        startMonthInfo = { year: selectedMonth.year, month: 1 };
        endMonthInfo = selectedMonth;
      }
    } else if (month) {
      const selectedMonth = parseMonthYear(month, yearNumber);
      if (selectedMonth) {
        startMonthInfo = { year: selectedMonth.year, month: 1 };
        endMonthInfo = selectedMonth;
      }
    } else if (Number.isInteger(yearNumber)) {
      startMonthInfo = { year: yearNumber, month: 1 };
      endMonthInfo = { year: yearNumber, month: 12 };
    }

    if (!startMonthInfo || !endMonthInfo) {
      return res.status(400).json({
        success: false,
        message: "year is required unless month includes year, for example month=jun-2026",
      });
    }

    const startDate = new Date(Date.UTC(startMonthInfo.year, startMonthInfo.month - 1, 1));
    const endDate = new Date(Date.UTC(endMonthInfo.year, endMonthInfo.month, 1));

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: "from month must be before or equal to to month",
      });
    }

    const materialQuery = { date: { $gte: startDate, $lt: endDate } };
    const paymentQuery = { date: { $gte: startDate, $lt: endDate } };

    if (userType !== "all") {
      materialQuery.userType = userType;
      paymentQuery.userType = userType;
    }

    if (userId) {
      materialQuery.userId = userId;
      paymentQuery.userId = userId;
    }

    if (vendorRef) {
      materialQuery.vendorRef = vendorRef;
      paymentQuery.vendorRef = vendorRef;
    }

    const selectedVendorName = vendorName || receivedFrom || userName;
    if (selectedVendorName && !userId && !vendorRef) {
      const exactName = {
        $regex: `^${escapeRegex(String(selectedVendorName).trim())}$`,
        $options: "i",
      };
      materialQuery.receivedFrom = exactName;
      paymentQuery.$or = [{ vendorName: exactName }, { receivedFrom: exactName }];
    }

    if (phoneNumber) {
      materialQuery.phoneNumber = phoneNumber;
      paymentQuery.phoneNumber = phoneNumber;
    }

    if (billNo) {
      materialQuery.billNo = billNo;
      paymentQuery.billNo = billNo;
    }

    if (product && product !== "all") {
      if (!["poleythene", "hydensity"].includes(product)) {
        return res.status(400).json({
          success: false,
          message: "product must be poleythene, hydensity or all",
        });
      }
      materialQuery.product = product;
      paymentQuery.product = product;
    }

    const openingMaterialQuery = { ...materialQuery, date: { $lt: startDate } };
    const openingPaymentQuery = { ...paymentQuery, date: { $lt: startDate } };
    const materialAmountExpression = {
      $multiply: [
        {
          $ifNull: [
            "$grossWeight",
            {
              $add: [
                { $ifNull: ["$weightPure", 0] },
                { $ifNull: ["$weightMixing", 0] },
              ],
            },
          ],
        },
        { $ifNull: ["$rate", 0] },
      ],
    };

    const [openingPurchases, openingPayments] = await Promise.all([
      materialdata.aggregate([
        { $match: openingMaterialQuery },
        { $group: { _id: null, credit: { $sum: materialAmountExpression } } },
      ]),
      PurchasePaymentData.aggregate([
        { $match: openingPaymentQuery },
        { $group: { _id: null, debit: { $sum: "$amount" } } },
      ]),
    ]);

    const openingCredit = Number(openingPurchases[0]?.credit || 0);
    const openingDebit = Number(openingPayments[0]?.debit || 0);
    const openingBalance = Number((openingCredit - openingDebit).toFixed(2));

    const vendorKeyExpression = {
      $cond: [
        { $ne: [{ $ifNull: ["$userId", ""] }, ""] },
        { $concat: ["user:", "$userId"] },
        {
          $cond: [
            { $ne: [{ $ifNull: ["$vendorRef", ""] }, ""] },
            { $concat: ["ref:", "$vendorRef"] },
            {
              $concat: [
                "name:",
                {
                  $toLower: {
                    $ifNull: ["$receivedFrom", { $ifNull: ["$vendorName", ""] }],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const monthlyPurchases = await materialdata.aggregate([
      { $match: materialQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            vendorKey: vendorKeyExpression,
          },
          credit: { $sum: materialAmountExpression },
          totalWeight: {
            $sum: {
              $ifNull: [
                "$grossWeight",
                {
                  $add: [
                    { $ifNull: ["$weightPure", 0] },
                    { $ifNull: ["$weightMixing", 0] },
                  ],
                },
              ],
            },
          },
          purchaseCount: { $sum: 1 },
          materialIds: { $push: "$_id" },
          billNumbers: { $addToSet: "$billNo" },
          vendorName: { $first: "$receivedFrom" },
          vendorRef: { $first: "$vendorRef" },
          userType: { $first: "$userType" },
          userId: { $first: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: { year: "$_id.year", month: "$_id.month", day: 1 },
          },
          vendorKey: "$_id.vendorKey",
          vendorName: { $ifNull: ["$vendorName", ""] },
          receivedFrom: { $ifNull: ["$vendorName", ""] },
          vendorRef: { $ifNull: ["$vendorRef", ""] },
          userType: { $ifNull: ["$userType", ""] },
          userId: { $ifNull: ["$userId", ""] },
          billNumbers: 1,
          materialIds: 1,
          purchaseCount: 1,
          paymentCount: { $literal: 0 },
          totalWeight: { $round: ["$totalWeight", 2] },
          debit: { $literal: 0 },
          credit: { $round: ["$credit", 2] },
        },
      },
    ]);

    const monthlyPayments = await PurchasePaymentData.aggregate([
      { $match: paymentQuery },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            vendorKey: vendorKeyExpression,
          },
          debit: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
          paymentIds: { $push: "$_id" },
          billNumbers: { $addToSet: "$billNo" },
          folios: { $addToSet: "$folio" },
          vendorName: {
            $first: { $ifNull: ["$vendorName", "$receivedFrom"] },
          },
          vendorRef: { $first: "$vendorRef" },
          userType: { $first: "$userType" },
          userId: { $first: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: { year: "$_id.year", month: "$_id.month", day: 1 },
          },
          vendorKey: "$_id.vendorKey",
          vendorName: { $ifNull: ["$vendorName", ""] },
          receivedFrom: { $ifNull: ["$vendorName", ""] },
          vendorRef: { $ifNull: ["$vendorRef", ""] },
          userType: { $ifNull: ["$userType", ""] },
          userId: { $ifNull: ["$userId", ""] },
          billNumbers: 1,
          folios: 1,
          paymentIds: 1,
          paymentCount: 1,
          purchaseCount: { $literal: 0 },
          totalWeight: { $literal: 0 },
          debit: { $round: ["$debit", 2] },
          credit: { $literal: 0 },
        },
      },
    ]);

    const mergedEntries = new Map();
    const appendValues = (currentValues = [], nextValues = []) =>
      [...new Set([...currentValues, ...nextValues].filter(Boolean).map(String))];

    [...monthlyPurchases, ...monthlyPayments].forEach((item) => {
      const entryDate = new Date(item.date);
      const mergeKey = `${entryDate.toISOString()}|${item.vendorKey}`;

      if (!mergedEntries.has(mergeKey)) {
        mergedEntries.set(mergeKey, {
          date: entryDate,
          description: "Monthly purchase ledger total",
          folio: "",
          billNo: "",
          vendorName: item.vendorName || "",
          receivedFrom: item.receivedFrom || item.vendorName || "",
          vendorRef: item.vendorRef || "",
          userType: item.userType || "",
          userId: item.userId || "",
          vendor: {
            vendorName: item.vendorName || "",
            vendorRef: item.vendorRef || "",
            userType: item.userType || "",
            userId: item.userId || "",
          },
          materialIds: [],
          paymentIds: [],
          purchaseCount: 0,
          paymentCount: 0,
          totalWeight: 0,
          debit: 0,
          credit: 0,
          entryType: "summary",
        });
      }

      const merged = mergedEntries.get(mergeKey);
      merged.debit += Number(item.debit || 0);
      merged.credit += Number(item.credit || 0);
      merged.totalWeight += Number(item.totalWeight || 0);
      merged.purchaseCount += Number(item.purchaseCount || 0);
      merged.paymentCount += Number(item.paymentCount || 0);
      merged.materialIds = appendValues(merged.materialIds, item.materialIds);
      merged.paymentIds = appendValues(merged.paymentIds, item.paymentIds);
      const bills = appendValues(merged.billNo ? merged.billNo.split(", ") : [], item.billNumbers);
      const folios = appendValues(merged.folio ? merged.folio.split(", ") : [], item.folios);
      merged.billNo = bills.join(", ");
      merged.folio = folios.join(", ");

      if (!merged.vendorName && item.vendorName) merged.vendorName = item.vendorName;
      if (!merged.receivedFrom && item.receivedFrom) merged.receivedFrom = item.receivedFrom;
      if (!merged.vendorRef && item.vendorRef) merged.vendorRef = item.vendorRef;
      if (!merged.userType && item.userType) merged.userType = item.userType;
      if (!merged.userId && item.userId) merged.userId = item.userId;
      merged.vendor = {
        vendorName: merged.vendorName,
        vendorRef: merged.vendorRef,
        userType: merged.userType,
        userId: merged.userId,
      };
    });

    const entries = Array.from(mergedEntries.values()).sort((a, b) => {
      const dateDifference = new Date(a.date) - new Date(b.date);
      if (dateDifference !== 0) return dateDifference;
      return String(a.vendorName).localeCompare(String(b.vendorName));
    });

    let balance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalWeight = 0;

    const selectedVendor = selectedVendorName || "";
    const baseEntry = {
      folio: "",
      billNo: billNo || "",
      vendorName: selectedVendor,
      receivedFrom: selectedVendor,
      vendorRef: vendorRef || "",
      userType,
      userId: userId || "",
      vendor: {
        vendorName: selectedVendor,
        vendorRef: vendorRef || "",
        userType,
        userId: userId || "",
      },
    };

    const openingEntry = {
      ...baseEntry,
      date: startDate,
      description: "Opening balance",
      materialIds: [],
      paymentIds: [],
      purchaseCount: 0,
      paymentCount: 0,
      totalWeight: 0,
      debit: 0,
      credit: 0,
      balance: openingBalance,
      entryType: "opening",
    };

    const ledger = entries.map((item) => {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);

      totalDebit += debit;
      totalCredit += credit;
      totalWeight += Number(item.totalWeight || 0);
      balance += credit - debit;

      return {
        ...item,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        totalWeight: Number(Number(item.totalWeight || 0).toFixed(2)),
        balance: Number(balance.toFixed(2)),
      };
    });

    const finalBalance = Number(balance.toFixed(2));
    const finalEntry = {
      ...baseEntry,
      date: endDate,
      description: "Final total",
      materialIds: [],
      paymentIds: [],
      purchaseCount: ledger.reduce((sum, item) => sum + item.purchaseCount, 0),
      paymentCount: ledger.reduce((sum, item) => sum + item.paymentCount, 0),
      totalWeight: Number(totalWeight.toFixed(2)),
      debit: Number(totalDebit.toFixed(2)),
      credit: Number(totalCredit.toFixed(2)),
      balance: finalBalance,
      entryType: "total",
    };

    return res.status(200).json({
      success: true,
      message: "Purchase ledger fetched successfully",
      data: [openingEntry, ...ledger, finalEntry],
      summary: {
        year: yearNumber || startMonthInfo.year,
        fromMonth: `${startMonthInfo.year}-${String(startMonthInfo.month).padStart(2, "0")}`,
        toMonth: `${endMonthInfo.year}-${String(endMonthInfo.month).padStart(2, "0")}`,
        product: product || "all",
        openingBalance,
        totalWeight: Number(totalWeight.toFixed(2)),
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        closingBalance: finalBalance,
        finalBalance,
      },
    });
  } catch (error) {
    console.error("getPurchaseLedgerSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching purchase ledger",
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
          ref_no: { $first: "$ref_no" },
          
        },
      },
      { $sort: { latestDate: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $project: {
          _id: 0,
          clientName: 1,
          ref_no: 1,
          
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






module.exports = { createUser, getCustomerbyId, getCustomer, getMaterialbyId,getMaterial, loginUser, changePassword, forgotPassword, Creatematerial,editMaterial, deleteMaterial, createCustomer, editCustomer, deleteCustomer,updateMaterialStatusById, updateCustomerStatusById, CreateCategoryCustomer, getCategoryCustomer, deleteCategoryCustomer, EditCategoryCustomer, getwalkingcustomer, getReceivedFromVendorRef, getCustomerdetails, getcategoryCustomerbyId, getCombinedData, receiveSalesPayment, deleteSalesPayment, editSalesPayment, getSalesLedgerYearly, walkingCustomer, getSalesLedgerSummary, getPurchaseLedgerSummary };
