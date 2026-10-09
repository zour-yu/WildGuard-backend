require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB.');
  const db = mongoose.connection.collection('users');
  
  const r1 = await db.updateMany({ role: 'Admin' }, { $set: { role: 'Park Manager' } });
  const r2 = await db.updateMany({ role: 'Liaison' }, { $set: { role: 'Park Manager' } });
  const r3 = await db.updateMany({ role: 'Community Liaison Officer' }, { $set: { role: 'Park Manager' } });
  
  console.log('Updated Admins:', r1.modifiedCount);
  console.log('Updated Liaisons:', r2.modifiedCount);
  console.log('Updated Community Liaison Officers:', r3.modifiedCount);
  
  process.exit(0);
}).catch(err => {
  console.error('Connection failed (IP Whitelist?):', err.message);
  process.exit(1);
});
