const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-server.a0arf8b.mongodb.net/?retryWrites=true&w=majority&appName=simple-crud-server`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    

    const db = client.db("lifeShieldDB");
    const policyCollection = db.collection("policies");
     const blogCollection = db.collection("blogs");
     const reviewCollection = db.collection("reviews");

    // Policy Routes

    app.get('/popular-policies', async (req, res) => {
      const result = await policyCollection.find()
        .sort({ purchased_count: -1 }) 
        .limit(6) 
        .toArray();
      res.send(result);
    });

    // 2.Specific Policy's Details 
    app.get('/policy/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await policyCollection.findOne(query);
      res.send(result);
    });

    // Blog (Dynamic)

    app.get('/all-blogs', async (req, res) => {
    const result = await blogCollection.find()
        .sort({ date: -1 }) 
        .toArray();
    res.send(result);
});


app.get('/blog/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await blogCollection.findOne(query);
    res.send(result);
});


// Review Routes

app.get('/reviews', async (req, res) => {
    const result = await reviewCollection.find().sort({ _id: -1 }).toArray();
    res.send(result);
});
app.post('/reviews', async (req, res) => {
    const review = req.body;
    const reviewWithDate = {
        ...review,
        date: new Date()
    };
    const result = await reviewCollection.insertOne(reviewWithDate);
    res.send(result);
});

    console.log("Successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Life Shield Server is running...');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});