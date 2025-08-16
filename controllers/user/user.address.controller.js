const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getAddress = async (req, res) => {
  try {
    console.log('res', req.user._id);
    const user = await User.findById({ _id: req.user._id }).populate('address');
    console.log('user', user);
    if (!user) {
      return res.status(httpStatusCodes.NOT_FOUND).json({ message: 'User not found' });
    }
    res.status(httpStatusCodes.OK).render('address/address', { user: user });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};
const getAddAddress = (req, res) => {
  res.status(httpStatusCodes.OK).render('address/add-address');
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
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COMMON.ALL_FIELDS_REQUIRED });
    }

    // Regex for phone number (adjust if necessary)
    const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
    if (!phoneRegex.test(trimmedPhoneNo)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.ADDRESS.INVALID_PHONE });
    }

    // Regex for Indian postal code
    const postalCodeRegex = /^[1-9][0-9]{5}$/; // Must be 6 digits and cannot start with 0
    if (!postalCodeRegex.test(trimmedPostalCode)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.ADDRESS.INVALID_POSTAL,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.USER_NOT_FOUND });
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

    res.status(httpStatusCodes.OK).json({ success: true, message: messages.ADDRESS.ADD_SUCCESS });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

const getEditAddress = async (req, res) => {
  try {
    const id = req.params.id;
    const address = await Address.findById(id);
    if (!address) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.ADDRESS.ADDRESS_NOT_FOUND });
    }
    res.render('address/edit-address', { address: address });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
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
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.ADDRESS.ADDRESS_NOT_FOUND });
    }

    // Check if the user is authorized to edit this address
    if (address.user.toString() !== userId.toString()) {
      return res
        .status(httpStatusCodes.FORBIDDEN)
        .json({ success: false, message: messages.ADDRESS.UNAUTHORIZED_EDIT });
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
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COMMON.ALL_FIELDS_REQUIRED });
    }

    // Regex for phone number (adjust if necessary)
    const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
    if (!phoneRegex.test(trimmedPhoneNo)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.ADDRESS.INVALID_PHONE });
    }

    // Regex for Indian postal code
    const postalCodeRegex = /^[1-9][0-9]{5}$/; // Must be 6 digits and cannot start with 0
    if (!postalCodeRegex.test(trimmedPostalCode)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.ADDRESS.INVALID_POSTAL,
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

    res.status(200).json({ success: true, message: messages.ADDRESS.UPDATE_SUCCESS });
  } catch (error) {
    return res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.user._id; // Make sure req.user is populated (e.g., through authentication middleware)

    // Validate addressId and userId
    if (!addressId || !userId) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.ADDRESS.INVALID_ID });
    }

    // Find and delete the address
    const address = await Address.findOneAndDelete({ _id: addressId, user: userId });

    if (!address) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.ADDRESS.DELETE_FAIL });
    }

    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.ADDRESS.DELETE_SUCCESS });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.ERROR.SERVER_ERROR });
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
