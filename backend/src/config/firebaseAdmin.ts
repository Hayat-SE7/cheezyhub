import admin from 'firebase-admin';
import path from 'path';

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, 'firebase-adminsdk.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
