const cors = require("cors");
const jwt = require('jsonwebtoken');
const {jwtAuthMiddleware, authorizeRoles} = require('./../jwt');

const {  createUser,loginUser, changePassword, forgotPassword, getCombinedData, getCustomer, getCustomerbyId, getMaterialbyId, Creatematerial,editMaterial, deleteMaterial, createCustomer,editCustomer, deleteCustomer,getMaterial, updateMaterialStatusById, updateCustomerStatusById, CreateCategoryCustomer, getCategoryCustomer, deleteCategoryCustomer, EditCategoryCustomer, getwalkingcustomer, getCustomerdetails, getcategoryCustomerbyId, receiveSalesPayment, deleteSalesPayment, editSalesPayment, getSalesLedgerYearly, getSalesLedgerSummary, walkingCustomer }
 = require("../inventorycontrollers/inventoryController");

const CustomRoutes = (http, express) => {
   http.get("/inventoryApp", (req, res) => {
     res.send("inventory app");
   });

  http.use(cors());
  http.use(express.static("dist"));
  http.use(express.urlencoded({ extended: true }));
  http.use(express.json());
  
// user Routes
http.post("/inventoryApp/loginUser", loginUser);
http.post("/inventoryApp/createUser", createUser);
http.post("/inventoryApp/forgotPassword", forgotPassword);
http.patch("/inventoryApp/changePassword", jwtAuthMiddleware, changePassword);

const allRoles = authorizeRoles("admin", "manager", "accounts");
const adminOrManager = authorizeRoles("admin", "manager");
const adminOrAccounts = authorizeRoles("admin", "accounts");

http.post("/inventoryApp/Creatematerial", jwtAuthMiddleware, adminOrManager, Creatematerial);
http.post("/inventoryApp/createCustomer", jwtAuthMiddleware, adminOrManager, createCustomer);

http.get("/inventoryApp/getMaterial", jwtAuthMiddleware, allRoles, getCombinedData);
http.get("/inventoryApp/getCustomer", jwtAuthMiddleware, allRoles, getCustomer);
http.get("/inventoryApp/getMaterial/:id", jwtAuthMiddleware, allRoles, getMaterialbyId);
http.delete("/inventoryApp/deleteMaterial/:id", jwtAuthMiddleware, adminOrManager, deleteMaterial);
http.patch("/inventoryApp/editMaterial", jwtAuthMiddleware, adminOrManager, editMaterial);

http.get("/inventoryApp/getCustomerbyId/:id", jwtAuthMiddleware, allRoles, getCustomerbyId);
http.get("/inventoryApp/getcategoryCustomerbyId/:id", jwtAuthMiddleware, allRoles, getcategoryCustomerbyId);

http.patch("/inventoryApp/editCustomer", jwtAuthMiddleware, adminOrManager, editCustomer);
http.delete("/inventoryApp/deleteCustomer/:id", jwtAuthMiddleware, adminOrManager, deleteCustomer  );
http.get("/inventoryApp/updateMaterialStatusById/:id", jwtAuthMiddleware, adminOrManager, updateMaterialStatusById);
http.get("/inventoryApp/updateCustomerStatusById/:id", jwtAuthMiddleware, adminOrManager, updateCustomerStatusById);


http.post("/inventoryApp/CreateCategoryCustomer", jwtAuthMiddleware, adminOrManager, CreateCategoryCustomer);
http.get("/inventoryApp/getCategoryCustomer", jwtAuthMiddleware, allRoles, getCategoryCustomer);
http.get("/inventoryApp/getwalkingcustomer", jwtAuthMiddleware, allRoles, getwalkingcustomer);
http.get("/inventoryApp/getCustomerdetails", jwtAuthMiddleware, allRoles, getCustomerdetails);
http.delete("/inventoryApp/deleteCategoryCustomer/:id", jwtAuthMiddleware, adminOrManager, deleteCategoryCustomer);
http.patch("/inventoryApp/EditCategoryCustomer", jwtAuthMiddleware, adminOrManager, EditCategoryCustomer);

http.get("/inventoryApp/getSalesLedgerYearly", jwtAuthMiddleware, adminOrManager, getSalesLedgerYearly);
http.get("/inventoryApp/getSalesLedgerSummary", jwtAuthMiddleware, adminOrManager, getSalesLedgerSummary);

http.post("/inventoryApp/receiveSalesPayment", jwtAuthMiddleware, adminOrManager, receiveSalesPayment);
http.patch("/inventoryApp/editSalesPayment/:id", jwtAuthMiddleware, adminOrManager, editSalesPayment);
http.delete("/inventoryApp/deleteSalesPayment/:id", jwtAuthMiddleware, adminOrManager, deleteSalesPayment);
http.get("/inventoryApp/walkingCustomer", jwtAuthMiddleware, allRoles, walkingCustomer);
}
  // http.post("/costingapp/insertFormData", insertFormData);
  // http.post("/costingapp/Adminlogin", Adminlogin);
  // http.post("/costingapp/insertAdminFormData", insertAdminFormData);
  // http.get("/costingapp/getAdminFormData", getAdminFormData);
  // http.post("/costingapp/addDate", addDate);
  // http.post("/costingapp/hubspotData", hubspotData);


module.exports = CustomRoutes;
