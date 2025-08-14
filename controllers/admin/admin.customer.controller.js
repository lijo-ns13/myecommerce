const User = require('../../models/userSchema');

// const getCustomers=async(req, res) => {
//     // res.send('Retrieve all customers');
//     try{
//         const users=await User.find({role:'user'}).select('+isBlocked')
//         res.render('customers',{customers:users})
//     }catch(error){
//         res.status(400).json({success:false,message:error.message})
//     }

// }
const getCustomers = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const totalCustomers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCustomers / limit);

    const customers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('customers', {
      customers,
      currentPage: page,
      totalPages,
      searchQuery: search, // ✅ THIS FIXES THE ERROR
      currentPath: '/customer',
    });
  } catch (err) {
    res.status(500).send('Error loading customers');
  }
};

const postCustomerBlock = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true })
      .select('+isBlocked')
      .exec();
    console.log(user.isBlocked);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // res.json({success:true,message:'User Blocked Succssfully'});
    res.status(200).redirect('/admin/customers');
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const postCustomerUnblock = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true })
      .select('+isBlocked')
      .exec();
    console.log(user.isBlocked);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // res.json({success:true,message:'User Unblocked Succssfully'});
    res.status(200).redirect('/admin/customers');
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
module.exports = {
  getCustomers,
  postCustomerBlock,
  postCustomerUnblock,
};
