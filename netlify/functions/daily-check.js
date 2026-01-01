const { schedule } = require('@netlify/functions');
// You'll need to install 'firebase-admin' in your package.json
const admin = require("firebase-admin");

// To avoid exposing keys, we use Environment Variables in Netlify Dashboard
// But for now, you can paste your Service Account JSON here just to test (Be careful!)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const handler = async function(event, context) {
  const db = admin.firestore();
  const docRef = db.collection('system').doc('ghostt_status');
  const doc = await docRef.get();
  
  if (!doc.exists) return { statusCode: 200 };

  const data = doc.data();
  const lastSeen = data.last_seen.toDate();
  const now = new Date();
  
  // Calculate difference in hours
  const diffHours = Math.abs(now - lastSeen) / 36e5;

  // IF YOU HAVEN'T PINGED IN 720 HOURS (30 DAYS)
  if (diffHours > 720) {
    console.log("TRIGGERING PROTOCOL OMEGA");
    
    // 1. DELETE THE VAULT
    await db.collection('vault').listDocuments().then(val => {
        val.map((val) => {
            val.delete()
        })
    });

    // 2. HERE YOU WOULD TRIGGER THE EMAIL API (e.g. Resend or SendGrid)
  }

  return {
    statusCode: 200,
  };
};

// Run this function every day at midnight
exports.handler = schedule("@daily", handler);
