const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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
  },
});

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

async function run() {
  try {
    const db = client.db("lifeShieldDB");
    const policyCollection = db.collection("policies");
    const blogCollection = db.collection("blogs");
    const reviewCollection = db.collection("reviews");
    const newsletterCollection = db.collection("newsletter");
    const userCollection = db.collection("users");
    const  applicationCollection = db.collection("application");

    // Middleware: Verify Token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware: Verify Admin 
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === "admin";
    if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access! Admin Only." });
    }
    next();
};

    //  JWT API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      res.send({ role: user?.role });
    });

    // Policy Routes

    app.get("/popular-policies", async (req, res) => {
      const result = await policyCollection
        .find()
        .sort({ purchased_count: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // 2.Specific Policy's Details
    app.get("/policy/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID format" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await policyCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Policy not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Blog (Dynamic)

    app.get("/all-blogs", async (req, res) => {
      const result = await blogCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogCollection.findOne(query);
      res.send(result);
    });

    // blog- visit increase routes

    app.patch("/blog/visit/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { total_visit: 1 },
      };
      const result = await blogCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Review Routes

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const reviewWithDate = {
        ...review,
        date: new Date(),
      };
      const result = await reviewCollection.insertOne(reviewWithDate);
      res.send(result);
    });

    // NewsLetter Routes

    app.post("/newsletter", async (req, res) => {
      const subscriber = req.body;

      const existing = await newsletterCollection.findOne({
        email: subscriber.email,
      });
      if (existing) {
        return res.status(400).send({ message: "Already Subscribed!" });
      }

      const result = await newsletterCollection.insertOne({
        ...subscriber,
        subscribedAt: new Date(),
      });
      res.send(result);
    });

    // user Routes

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });



   // --- User Management (Admin Only) ---

// Getting all user (With Protection)
app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    const result = await userCollection.find().toArray();
    res.send(result);
});

// Change User Role (Promote/Demote)
app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const { role } = req.body; 
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: { role: role },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
});

// User remove (Optional but useful)
app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await userCollection.deleteOne(query);
    res.send(result);
});

    //  Get all Policy API (Search, Filter, Pagination )
    app.get("/all-policies", async (req, res) => {
      const { search, category, page, size } = req.query;
      const pageNum = parseInt(page) || 0;
      const sizeNum = parseInt(size) || 9;
      let query = {};
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      if (category && category !== "All") {
        query.category = category;
      }

      try {
        const cursor = policyCollection
          .find(query)
          .skip(pageNum * sizeNum)
          .limit(sizeNum);
        const result = await cursor.toArray();
        const count = await policyCollection.countDocuments(query);

        res.send({ result, count });
      } catch (error) {
        res.status(500).send({ message: "Error fetching policies" });
      }
    });

    // Add new Policy
app.post("/policies", verifyToken, verifyAdmin, async (req, res) => {
    const policy = req.body;
    const result = await policyCollection.insertOne(policy);
    res.send(result);
});

// Update Policy
app.patch("/policies/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const updatedPolicy = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedPolicy };
    const result = await policyCollection.updateOne(filter, updateDoc);
    res.send(result);
});

// Delete Policy
app.delete("/policies/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await policyCollection.deleteOne(query);
    res.send(result);
});

// Admin Can see All Agents
app.get("/users/agents", verifyToken, verifyAdmin, async (req, res) => {
    const query = { role: "agent" };
    const result = await userCollection.find(query).toArray();
    res.send(result);
});

    //application from customer from planned quote
    app.post("/applications", async (req, res) => {
  const application = req.body;
  const result = await applicationCollection.insertOne(application);
  res.send(result);
});

// profile save API----
app.patch("/users/:email", async (req, res) => {
  const email = req.params.email;
  const updatedData = req.body;
  const filter = { email: email };
  const updateDoc = {
    $set: {
      name: updatedData.name,
      photo: updatedData.photo,
    },
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});

// Status Update API (Approve/Reject/Assign)
app.patch("/applications/status/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: { status: status },
    };
    const result = await applicationCollection.updateOne(filter, updateDoc);
    res.send(result);
});

// payment routes

app.post("/create-payment-intent", async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);

  if (!price || amount < 1) {
    return res.status(400).send({ message: "Invalid amount" });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd", 
    payment_method_types: ["card"],
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.patch("/applications/payment/:id", async (req, res) => {
    const id = req.params.id;
    const payment = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            status: 'Paid',
            transactionId: payment.transactionId,
            paymentDate: payment.date,
            paidAmount: payment.amount
        },
    };

    
    const result = await applicationCollection.updateOne(filter, updateDoc);
    res.send(result);
});

app.get("/applied-policies/:email", async (req, res) => {
    const email = req.params.email;
    const query = { applicantEmail: email, status: 'Paid' }; 
    const result = await applicationCollection.find(query).toArray();
    res.send(result);
});


// assign agent API
app.patch("/applications/assign/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const { agentEmail, agentName, status } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: { 
            agentEmail: agentEmail,
            agentName: agentName,
            status: status 
        },
    };
    const result = await applicationCollection.updateOne(filter, updateDoc);
    res.send(result);
});

// 2.Get all aplication
app.get("/all-applications", verifyToken, verifyAdmin, async (req, res) => {
    const result = await applicationCollection.find().toArray();
    res.send(result);
});

    console.log("Successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Life Shield Server is running...");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
