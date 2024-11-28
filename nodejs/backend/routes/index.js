var express = require('express');
var router = express.Router();
;const axios = require('axios').default; // npm install axios
const CryptoJS = require('crypto-js'); // npm install crypto-js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('592773543135-d82dknvqh59tlkcav8viq1o1v0sfr3jl.apps.googleusercontent.com'); // Replace with your actual client ID
const bodyParser = require('body-parser'); // npm install body-parser
const moment = require('moment'); // npm install moment
const qs = require('qs');
const connectDb=require('../model/db');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const nodemailer = require('nodemailer');
//gui mail
const transporter = nodemailer.createTransport({
 
  service: 'gmail',
  auth: {
    user: 'vinhnguyen13062004@gmail.com', // Replace with your email
    pass: 'vinhdeptrai',  // Replace with your email password or app password
  },
});

// Function to send email
async function sendEmail(to, subject, htmlContent) {
  try {
    await transporter.sendMail({
      from: 'ADMIN Electronic Store <vinhnguyen13062004@gmail.com>', // Replace with your email
      to,
      subject,
      html: htmlContent,
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
//Đăng ký tài khoản với mã hóa mật khẩu bcrypt
const bcrypt = require('bcryptjs');
router.post('/register', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const { email, password } = req.body;
  const user = await userCollection.findOne({ email });
  if (user) {
    return res.status(400).json({ message: "Email đã tồn tại" });
  }else
  {
    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = { email, password: hashPassword , role: 'user' };
    
    
  
    try {
      const result = await userCollection.insertOne(newUser);
      if (result.insertedId) {
         // Send welcome email
      await sendEmail(
        email,
        'Chúc mừng bạn đã đăng ký thành công',
        `<h1>Chào mừng bạn đến với ElectronicStore</h1>
         <p>Cảm ơn bạn đã tham gia chương trình</p>
         <ul>
           <li>Username: ${email}</li>
         </ul>`
      );
        res.status(200).json({ message: "Đăng ký thành công" });
      } else {
        res.status(500).json({ message: "Đăng ký thất bại" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
    }
  }
 
});

//Kiểm tra token qua Bearer

router.get('/checktoken', async (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, 'secret', (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    res.status(200).json({ message: "Token hợp lệ" });
  }
  );
}
);


//lấy thông tin chi tiết user qua token
router.get('/detailuser', async (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, 'secret', async (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    const db = await connectDb();
    const userCollection = db.collection('users');
    const userInfo = await userCollection.findOne({ email: user.email });
    if (userInfo) {
      res.status(200).json(userInfo);
    } else {
      res.status(404).json({ message: "Không tìm thấy user" });
    }
  });
});
//login gg
router.post('/auth/google', async (req, res, next) => {
  const { tokenId } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: '592773543135-d82dknvqh59tlkcav8viq1o1v0sfr3jl.apps.googleusercontent.com', // Replace with your actual client ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    const db = await connectDb();
    const userCollection = db.collection('users');
    let user = await userCollection.findOne({ email });

    if (!user) {
      // Register user if not found
      user = {
        email,
        password: null, // Password not set for Google users
        role: 'user',
      };
      await userCollection.insertOne(user);
      // Send welcome email for Google users
      await sendEmail(
        email,
        'Chúc mừng bạn đã đăng ký thành công',
        `<h1>Chào mừng bạn đến với ElectronicStore</h1>
         <p>Cảm ơn bạn đã tham gia chương trình</p>
         <ul>
           <li>Username: ${email}</li>
         </ul>`
      );
    }

    const token = jwt.sign({ email: user.email, role: user.role }, 'secret', { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Xác thực Google thất bại" });
  }
});

//check jwt
const jwt = require('jsonwebtoken');
const { url } = require('inspector');
router.post('/login', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const { email, password } = req.body;
  const user = await userCollection.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "Email không tồn tại" });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ message: "Mật khẩu không chính xác" });
  }
  const token = jwt.sign({ email: user.email, role: user.role }, 'secret', { expiresIn: '1h' });
  res.status(200).json({ token });
});
//Thiết lập nơi lưu trữ và tên file
let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/img')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
//Kiểm tra file upload
function checkFileUpLoad(req, file, cb){
if(!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)){
  return cb(new Error('Bạn chỉ được upload file ảnh'));
}
cb(null, true);
}
//Upload file
let upload = multer({ storage: storage, fileFilter: checkFileUpLoad });
//lấy danh mục
router.get('/categories', async(req, res, next)=> {
  const db=await connectDb();
  const categoryCollection=db.collection('categories');
  const categories=await categoryCollection.find().toArray();
  if(categories){
    res.status(200).json(categories);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);
//thêm danh mục

router.post('/addcategories', async (req, res, next) => {
  const db = await connectDb();
  const categoriesCollection = db.collection('categories');
  const { name,status } = req.body;
  const newCategories = { name, status };
  try {
    const result = await categoriesCollection.insertOne(newCategories);

    // Check if insertedId exists (indicates successful insertion)
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm danh mục thành công" });
    } else {
      res.status(500).json({ message: "Thêm danh mục thất bại" }); // Consider using 500 for unexpected errors
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" }); // Generic error message for user
  }
});
//sua danh muc
router.put('/updatecategories/:id', async (req, res, next) => {
  const db = await connectDb();
  const categoriesCollection = db.collection('categories');
  const id = new ObjectId(req.params.id);
  const { name, status} = req.body;
  let updatedCategories = { name,status }; 

  try {
    const result = await categoriesCollection.updateOne({ _id: id }, { $set: updatedCategories});
    if (result.matchedCount) {
      res.status(200).json({ message: "Sửa sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});
//Xóa danh mục
router.delete('/deletecategories/:id', async (req, res, next) => {
  const db = await connectDb();
  const categoriesCollection = db.collection('categories');
  const id = new ObjectId(req.params.id);
  try {
    const result = await categoriesCollection.deleteOne({ _id: id });
    if (result.deletedCount) {
      res.status(200).json({ message: "Xóa sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});
//Thêm sản phẩm
router.post('/addproduct', upload.single('image'), async (req, res, next) => {
  const db = await connectDb();
  const productCollection = db.collection('products');
  const { name, price, description, categoryId } = req.body;
  const image = req.file.originalname;
  const newProduct = { name, price, description, categoryId, image };

  try {
    const result = await productCollection.insertOne(newProduct);
  
    // Check if insertedId exists (indicates successful insertion)
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm sản phẩm thành công" });
    } else {
      res.status(500).json({ message: "Thêm sản phẩm thất bại" }); // Consider using 500 for unexpected errors
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" }); // Generic error message for user
  }
});

//Xóa sản phẩm
router.delete('/deleteproduct/:id', async (req, res, next) => {
  const db = await connectDb();
  const productCollection = db.collection('products');
  const id = new ObjectId(req.params.id);
  try {
    const result = await productCollection.deleteOne({ _id: id });
    if (result.deletedCount) {
      res.status(200).json({ message: "Xóa sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

//Sửa sản phẩm
router.put('/updateproduct/:id', upload.single('image'), async (req, res, next) => {
  const db = await connectDb();
  const productCollection = db.collection('products');
  const id = new ObjectId(req.params.id);
  const { name, price, description, categoryId } = req.body;
  let updatedProduct = { name, price, description, categoryId }; 

  if (req.file) {
    const image = req.file.originalname;
    updatedProduct.image = image; //
  }

  try {
    const result = await productCollection.updateOne({ _id: id }, { $set: updatedProduct });
    if (result.matchedCount) {
      res.status(200).json({ message: "Sửa sản phẩm thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});



router.get('/productdetail/:id', async(req, res, next)=> {
  let id = new ObjectId(req.params.id);
  const db=await connectDb();
  const productCollection=db.collection('products');
  const product=await productCollection.findOne({_id:id});
  if(product){
    res.status(200).json(product);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);
//Tìm kiếm theo sản phẩm
router.get('/search/:keyword', async(req, res, next)=> {
  const db=await connectDb();
  const productCollection=db.collection('products');
  const products=await productCollection.find({name: new RegExp(req.params.keyword, 'i')}).toArray();
  if(products){
    res.status(200).json(products);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);
router.get('/products', async(req, res, next)=> {
  const db=await connectDb();
  const productCollection=db.collection('products');
  const products=await productCollection.find().toArray();
  if(products){
    res.status(200).json(products);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
});
//Lấy danh sách sản phẩm theo idcate
router.get('/productbycate/:idcate', async(req, res, next)=> {
  const db=await connectDb();
  const productCollection=db.collection('products');
  const products=await productCollection.find({categoryId:req.params.idcate}).toArray();
  if(products){
    res.status(200).json(products);
  }else{
    res.status(404).json({message : "Không tìm thấy"})
  }
}
);
// Lấy danh sách người dùng
router.get('/users', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const users = await userCollection.find().toArray();
  if (users.length > 0) {
    res.status(200).json(users);
  } else {
    res.status(404).json({ message: "Không tìm thấy người dùng" });
  }
});

// Thêm người dùng
router.post('/addusers', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const {  email, password } = req.body;
  const newUser = { email, password };
  
  try {
    const result = await userCollection.insertOne(newUser);
    if (result.insertedId) {
      res.status(200).json({ message: "Thêm người dùng thành công" });
    } else {
      res.status(500).json({ message: "Thêm người dùng thất bại" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

// Sửa thông tin người dùng
router.put('/updateusers/:id', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const id = new ObjectId(req.params.id);
  const { email, password } = req.body;
  const updatedUser = {  email, password };

  try {
    const result = await userCollection.updateOne({ _id: id }, { $set: updatedUser });
    if (result.matchedCount) {
      res.status(200).json({ message: "Sửa thông tin người dùng thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

// Xóa người dùng
router.delete('/deleteusers/:id', async (req, res, next) => {
  const db = await connectDb();
  const userCollection = db.collection('users');
  const id = new ObjectId(req.params.id);

  try {
    const result = await userCollection.deleteOne({ _id: id });
    if (result.deletedCount) {
      res.status(200).json({ message: "Xóa người dùng thành công" });
    } else {
      res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra, vui lòng thử lại" });
  }
});

//lấy don hang
router.get('/orders', async (req, res) => {
  try {
    const paidOrders = payments.map(order => {
      const totalAmount = order.items.reduce(
        (sum, item) => sum + item.price_data.unit_amount * item.quantity,
        0
      );

      return {
        order_id: order._id.$oid,
        items: order.items.map(item => ({
          name: item.price_data.product_data.name,
          quantity: item.quantity,
          price: item.price_data.unit_amount,
          currency: item.price_data.currency,
          image: item.price_data.product_data.images ? item.price_data.product_data.images[0] : null,
        })),
        total_amount: totalAmount,
        created_at: order.createdAt.$date,
      };
    });

    res.status(200).json({
      message: "List of paid orders",
      data: paidOrders,
    });

  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// APP INFO, STK TEST: 4111 1111 1111 1111
const config = {
  app_id: '2553',
  key1: 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL',
  key2: 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
};

router.use(bodyParser.json());

/**
 * methed: POST
 * Sandbox	POST	https://sb-openapi.zalopay.vn/v2/create
 * Real	POST	https://openapi.zalopay.vn/v2/create
 * description: tạo đơn hàng, thanh toán
 */
router.post('/payment', async (req, res) => {
  const embed_data = {
    //sau khi hoàn tất thanh toán sẽ đi vào link này (thường là link web thanh toán thành công của mình)
    redirecturl: '  https://ae53-2405-4802-a3d8-33b0-6c86-3d89-26ca-ef13.ngrok-free.app',
  };

  const items = [];
  const transID = Math.floor(Math.random() * 1000000);

  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
    app_user: 'user123',
    app_time: Date.now(), 
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: 300000,
    //khi thanh toán xong, zalopay server sẽ POST đến url này để thông báo cho server của mình
    //Chú ý: cần dùng ngrok để public url thì Zalopay Server mới call đến được
    callback_url: 'https://7671-2405-4802-a3d8-33b0-6c86-3d89-26ca-ef13.ngrok-free.app/callback',
    description: `Lazada - Payment for the order #${transID}`,
    bank_code: 'zalopayapp',
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data =
    config.app_id +
    '|' +
    order.app_trans_id +
    '|' +
    order.app_user +
    '|' +
    order.amount +
    '|' +
    order.app_time +
    '|' +
    order.embed_data +
    '|' +
    order.item;
  order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  try {
    const result = await axios.post(config.endpoint, null, { params: order });

    return res.status(200).json(result.data);
  } catch (error) {
    console.log(error);
  }
});


router.post('/callback', (req, res) => {
  let result = {};
  console.log(req.body);
  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
    console.log('mac =', mac);

    // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    if (reqMac !== mac) {
// callback không hợp lệ
      result.return_code = -1;
      result.return_message = 'mac not equal';
    } else {
      // thanh toán thành công
      // merchant cập nhật trạng thái cho đơn hàng ở đây
      let dataJson = JSON.parse(dataStr, config.key2);
      console.log(
        "update order's status = success where app_trans_id =",
        dataJson['app_trans_id'],
      );

      result.return_code = 1;
      result.return_message = 'success';
    }
  } catch (ex) {
    console.log('lỗi:::' + ex.message);
    result.return_code = 0; 
    result.return_message = ex.message;
  }

  // thông báo kết quả cho ZaloPay server
  res.json(result);
});



router.post('/check-status-order', async (req, res) => {
  const { app_trans_id } = req.body;

  let postData = {
    app_id: config.app_id,
    app_trans_id, // Input your app_trans_id
  };

  let data = postData.app_id + '|' + postData.app_trans_id + '|' + config.key1; // appid|app_trans_id|key1
  postData.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  let postConfig = {
    method: 'post',
    url: 'https://sb-openapi.zalopay.vn/v2/query',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: qs.stringify(postData),
  };

  try {
    const result = await axios(postConfig);
    console.log(result.data);
    return res.status(200).json(result.data);
  
  } catch (error) {
    console.log('lỗi');
    console.log(error);
  }
});


module.exports = router;