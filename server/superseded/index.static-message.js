const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pumpstation';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../client'));

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  address: { type: String, unique: true, required: true },
  email: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

const CONNECT_MESSAGE = 'Connect PumpStation';

app.post('/api/connect-wallet', async (req, res) => {
  const { address, email, signature } = req.body;
  if (!address || !signature) {
    return res.status(400).json({ error: 'Address and signature required' });
  }

  try {
    const recovered = ethers.verifyMessage(CONNECT_MESSAGE, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let user = await User.findOne({ address });
    if (!user) {
      user = await User.create({ address, email });
    } else if (email && !user.email) {
      user.email = email;
      await user.save();
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
