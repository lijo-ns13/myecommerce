const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');

const getAddress = async (req, res) => {
  try {
    console.log('clicked');
    console.log('res', req.user._id);
    const user = await User.findById({ _id: req.user._id }).populate('address');
    console.log('user', user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('addy', user.address);
    res.status(200).render('address/address', { user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getAddAddress = (req, res) => {
  res.status(200).render('address/add-address');
};
const postAddAddress = async (req, res) => {
  try {
    const userId = req.user._id;

    // Destructure and trim input values
    const { street, phoneNo, city, state, postalCode, country } = req.body;

    // Trim all fields
    const trimmedStreet = street.trim();
    const trimmedPhoneNo = phoneNo.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    const trimmedPostalCode = postalCode.trim();
    const trimmedCountry = country.trim();

    // Log trimmed body for debugging
    console.log(req.body);

    // Check for empty fields
    if (
      !trimmedPhoneNo ||
      !trimmedStreet ||
      !trimmedCity ||
      !trimmedState ||
      !trimmedPostalCode ||
      !trimmedCountry
    ) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Regex for phone number (adjust if necessary)
    const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
    if (!phoneRegex.test(trimmedPhoneNo)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    // Regex for Indian postal code
    const postalCodeRegex = /^[1-9][0-9]{5}$/; // Must be 6 digits and cannot start with 0
    if (!postalCodeRegex.test(trimmedPostalCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postal code. Must be a 6-digit Indian postal code.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newAddrs = {
      street: trimmedStreet,
      phoneNo: trimmedPhoneNo,
      city: trimmedCity,
      state: trimmedState,
      postalCode: trimmedPostalCode,
      country: trimmedCountry,
      user: req.user._id,
    };

    const newAddress = await Address.create(newAddrs);
    user.address.push(newAddress._id);
    await user.save();

    res.status(200).json({ success: true, message: 'New address added successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getEditAddress = async (req, res) => {
  try {
    const id = req.params.id;
    const address = await Address.findById(id);
    if (!address) {
      return res.status(404).json({ success: false, message: 'address not found' });
    }
    res.render('address/edit-address', { address: address });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const patchEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.user._id;
    const { street, phoneNo, city, state, postalCode, country } = req.body;

    // Trim all input values
    const trimmedStreet = street.trim();
    const trimmedPhoneNo = phoneNo.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    const trimmedPostalCode = postalCode.trim();
    const trimmedCountry = country.trim();

    console.log('Request Body:', req.body);

    // Fetch the address from the database
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Check if the user is authorized to edit this address
    if (address.user.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to edit this address' });
    }

    // Check for empty fields
    if (
      !trimmedStreet ||
      !trimmedPhoneNo ||
      !trimmedCity ||
      !trimmedState ||
      !trimmedPostalCode ||
      !trimmedCountry
    ) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Regex for phone number (adjust if necessary)
    const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
    if (!phoneRegex.test(trimmedPhoneNo)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    // Regex for Indian postal code
    const postalCodeRegex = /^[1-9][0-9]{5}$/; // Must be 6 digits and cannot start with 0
    if (!postalCodeRegex.test(trimmedPostalCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postal code. Must be a 6-digit Indian postal code.',
      });
    }

    // Prepare the updated address object
    const updatedAddress = {
      street: trimmedStreet,
      phoneNo: trimmedPhoneNo,
      city: trimmedCity,
      state: trimmedState,
      postalCode: trimmedPostalCode,
      country: trimmedCountry,
    };

    // Update the address in the database
    await Address.findByIdAndUpdate(addressId, updatedAddress, { new: true });

    res.status(200).json({ success: true, message: 'Address successfully updated' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.user._id; // Make sure req.user is populated (e.g., through authentication middleware)

    // Validate addressId and userId
    if (!addressId || !userId) {
      return res.status(400).json({ success: false, message: 'Invalid address ID or user ID' });
    }

    // Find and delete the address
    const address = await Address.findOneAndDelete({ _id: addressId, user: userId });

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: 'Address not found or does not belong to the user' });
    }

    res.status(200).json({ success: true, message: 'Address successfully deleted' });
  } catch (error) {
    console.error('Error deleting address:', error); // Log the error for debugging
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAddress,
  getAddAddress,
  postAddAddress,
  getEditAddress,
  patchEditAddress,
  deleteAddress,
};
