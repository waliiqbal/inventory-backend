const cors = require("cors");
const jwt = require('jsonwebtoken');
const {jwtAuthMiddleware,} = require('./../jwt');

const {  createUser,loginUser, getCombinedData, getCustomer, getCustomerbyId, getMaterialbyId, Creatematerial,editMaterial, deleteMaterial, createCustomer,editCustomer, deleteCustomer,getMaterial, updateMaterialStatusById, updateCustomerStatusById, CreateCategoryCustomer, getCategoryCustomer, deleteCategoryCustomer, EditCategoryCustomer, getwalkingcustomer, getCustomerdetails, getcategoryCustomerbyId, receiveSalesPayment, getSalesLedgerYearly, walkingCustomer }
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
http.post("/inventoryApp/Creatematerial", Creatematerial);
http.post("/inventoryApp/createCustomer", createCustomer);

http.get("/inventoryApp/getMaterial", getCombinedData);
http.get("/inventoryApp/getCustomer", getCustomer);
http.get("/inventoryApp/getMaterial/:id", getMaterialbyId);
http.delete("/inventoryApp/deleteMaterial/:id", deleteMaterial);
http.patch("/inventoryApp/editMaterial", editMaterial);

http.get("/inventoryApp/getCustomerbyId/:id", getCustomerbyId);
http.get("/inventoryApp/getcategoryCustomerbyId/:id", getcategoryCustomerbyId);

http.patch("/inventoryApp/editCustomer", editCustomer);
http.delete("/inventoryApp/deleteCustomer/:id", deleteCustomer  );
http.get("/inventoryApp/updateMaterialStatusById/:id", updateMaterialStatusById);
http.get("/inventoryApp/updateCustomerStatusById/:id", updateCustomerStatusById);


http.post("/inventoryApp/CreateCategoryCustomer",  CreateCategoryCustomer);
http.get("/inventoryApp/getCategoryCustomer", getCategoryCustomer);
http.get("/inventoryApp/getwalkingcustomer", getwalkingcustomer);
http.get("/inventoryApp/getCustomerdetails", getCustomerdetails);
http.delete("/inventoryApp/deleteCategoryCustomer/:id", deleteCategoryCustomer);
http.patch("/inventoryApp/EditCategoryCustomer", EditCategoryCustomer);

http.get("/inventoryApp/getSalesLedgerYearly", getSalesLedgerYearly);

http.post("/inventoryApp/receiveSalesPayment", receiveSalesPayment);
http.get("/inventoryApp/walkingCustomer", walkingCustomer);
}
  // http.post("/costingapp/insertFormData", insertFormData);
  // http.post("/costingapp/Adminlogin", Adminlogin);
  // http.post("/costingapp/insertAdminFormData", insertAdminFormData);
  // http.get("/costingapp/getAdminFormData", getAdminFormData);
  // http.post("/costingapp/addDate", addDate);
  // http.post("/costingapp/hubspotData", hubspotData);


module.exports = CustomRoutes;
