const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const url = "mongodb://localhost:27017";
const client = new MongoClient(url);

let db;

client.connect()
  .then(() => {
    db = client.db("online_retail_db");
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("MongoDB connection failed", err);
  });

// REGISTER with customer_id
app.post("/register", async (req, res) => {
  const count = await db.collection("customers").countDocuments();
  const customerId = "C" + String(count + 1).padStart(3, "0");

  const user = {
    customer_id: customerId,
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    phone: req.body.phone,
    address: req.body.address,
    created_at: new Date()
  };

  await db.collection("customers").insertOne(user);
  res.send({ success: true });
});


// LOGIN
app.post("/login", async (req, res) => {
  const user = await db.collection("customers").findOne({
    email: req.body.email,
    password: req.body.password
  });

  if (user) {
    res.send({ success: true, user });
  } else {
    res.send({ success: false });
  }
});


// ✅ PRODUCTS ROUTE (THIS WAS MISSING)
app.get("/products", async (req, res) => {
  const products = await db.collection("products").find().toArray();
  res.json(products);
});

// GET ORDERS FOR LOGGED-IN USER
app.get("/orders/:customerId", async (req, res) => {
  const orders = await db
    .collection("orders")
    .find({ customer_id: req.params.customerId })
    .toArray();

  res.json(orders);
});

// GET SINGLE PRODUCT DETAILS
app.get("/product/:productId", async (req, res) => {
  const product = await db
    .collection("products")
    .findOne({ product_id: req.params.productId });

  res.json(product);
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});


app.post("/place-order", async (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_city,
      items,
      total_amount,
      payment_mode
    } = req.body;

    // Basic validation
    if (!customer_id || !items || items.length === 0) {
      return res.json({ success: false });
    }

    const order = {
      order_id: "O" + Date.now(),
      customer_id: customer_id,

      // ✅ THESE WERE MISSING BEFORE
      customer_name: customer_name,
      customer_phone: customer_phone,
      delivery_address: delivery_address,
      delivery_city: delivery_city,

      items: items,
      total_amount: total_amount,
      payment_mode: payment_mode,

      order_status: "Placed",
      order_date: new Date()
    };

    await db.collection("orders").insertOne(order);

    

    // REDUCE PRODUCT STOCK (ADD HERE)
    for (const item of items) {
      await db.collection("products").updateOne(
        { product_id: item.product_id },
        { $inc: { stock: -item.quantity } }
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.post("/update-profile", async (req, res) => {
  try {
    const { customer_id, name, phone, address } = req.body;

    await db.collection("customers").updateOne(
      { customer_id: customer_id },
      {
        $set: {
          name: name,
          phone: phone,
          address: address
        }
      }
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});


// admin
app.get("/admin/order-stats", async (req, res) => {
  try {
    const orders = await db.collection("orders").find().toArray();

    const stats = {};

    orders.forEach(order => {
      const date = order.order_date.toISOString().split("T")[0];
      stats[date] = (stats[date] || 0) + 1;
    });

    const result = Object.keys(stats).map(date => ({
      date: date,
      count: stats[date]
    }));

    res.json(result);

  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.get("/admin/payment-stats", async (req, res) => {
  const orders = await db.collection("orders").find().toArray();

  const stats = {
    "Cash on Delivery": 0,
    "Card on Delivery": 0,
    "Pick Up In Store": 0
  };

  orders.forEach(o => {
    if (stats[o.payment_mode] !== undefined) {
      stats[o.payment_mode]++;
    }
  });

  res.json(stats);
});


app.get("/admin/order-status-stats", async (req, res) => {
  const orders = await db.collection("orders").find().toArray();
  const stats = {};

  orders.forEach(o => {
    stats[o.order_status] = (stats[o.order_status] || 0) + 1;
  });

  res.json(stats);
});


app.get("/admin/customers", async (req, res) => {
  const customers = await db.collection("customers").find().toArray();
  res.json(customers);
});


app.delete("/admin/delete-customer/:id", async (req, res) => {
  try {
    const customerId = req.params.id;

    await db.collection("customers").deleteOne({
      customer_id: customerId
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});


app.get("/admin/summary", async (req, res) => {
  try {
    const totalOrders = await db.collection("orders").countDocuments();

    const revenueResult = await db.collection("orders").aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total_amount" }
        }
      }
    ]).toArray();

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const totalCustomers =
      await db.collection("customers").countDocuments();

    res.json({
      totalOrders,
      totalRevenue,
      totalCustomers
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});


app.get("/admin/products", async (req, res) => {
  const products = await db.collection("products").find().toArray();
  res.json(products);
});


app.post("/admin/save-product", async (req, res) => {
  const p = req.body;

  await db.collection("products").updateOne(
    { product_id: p.product_id },
    { $set: p },
    { upsert: true }
  );

  res.json({ success: true });
});


app.delete("/admin/delete-product/:pid", async (req, res) => {
  await db.collection("products").deleteOne({
    product_id: req.params.pid
  });

  res.json({ success: true });
});

app.get("/admin/orders", async (req, res) => {
  try {
    const orders = await db
      .collection("orders")
      .find()
      .sort({ order_date: -1 }) 
      .toArray();

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});


app.put("/admin/update-order-status", async (req, res) => {
  try {
    const { order_id, order_status } = req.body;

    if (!order_id || !order_status) {
      return res.json({ success: false });
    }

    await db.collection("orders").updateOne(
      { order_id: order_id },
      { $set: { order_status: order_status } }
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});
