const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "foodexpress",
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://plus.unsplash.com", "https://placehold.co"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many order attempts. Please wait a little and try again." }
});

function cleanText(value) {
    return typeof value === "string"
        ? value.replace(/[\u0000-\u001F\u007F]/g, "").trim()
        : "";
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "FoodExpress API" });
});

app.get("/api/categories", async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT DISTINCT category FROM food_items WHERE is_active = TRUE ORDER BY category"
        );
        res.json({ categories: rows.map(row => row.category) });
    } catch (error) {
        console.error("Category query failed:", error.message);
        res.status(500).json({ message: "Categories are temporarily unavailable." });
    }
});

app.get("/api/menu", async (req, res) => {
    const search = cleanText(req.query.q).slice(0, 80);
    const category = cleanText(req.query.category).slice(0, 60);
    let sql = `SELECT id, name, category, description, price, image_url, is_featured
               FROM food_items WHERE is_active = TRUE`;
    const values = [];

    if (category && category !== "All") {
        sql += " AND category = ?";
        values.push(category);
    }
    if (search) {
        sql += " AND (name LIKE ? OR description LIKE ? OR category LIKE ?)";
        const pattern = `%${search}%`;
        values.push(pattern, pattern, pattern);
    }
    sql += " ORDER BY is_featured DESC, name ASC";

    try {
        const [items] = await pool.execute(sql, values);
        res.json({ items });
    } catch (error) {
        console.error("Menu query failed:", error.message);
        res.status(500).json({ message: "The menu is temporarily unavailable." });
    }
});

app.post("/api/orders", orderLimiter, async (req, res) => {
    const customer = {
        name: cleanText(req.body.customerName).slice(0, 100),
        email: cleanText(req.body.email).toLowerCase(),
        phone: cleanText(req.body.phone).slice(0, 30),
        address: cleanText(req.body.address).slice(0, 300),
        notes: cleanText(req.body.notes).slice(0, 300)
    };

    if (!customer.name || customer.name.length < 2) {
        return res.status(400).json({ message: "Enter your name (at least 2 characters)." });
    }
    if (!validEmail(customer.email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (customer.phone.length < 7) {
        return res.status(400).json({ message: "Enter a valid phone number." });
    }
    if (customer.address.length < 8) {
        return res.status(400).json({ message: "Enter a complete delivery address." });
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0 || req.body.items.length > 20) {
        return res.status(400).json({ message: "Your cart must contain between 1 and 20 different dishes." });
    }

    const quantities = new Map();
    for (const line of req.body.items) {
        const id = Number(line.id);
        const quantity = Number(line.quantity);
        if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
            return res.status(400).json({ message: "One or more cart items are invalid." });
        }
        quantities.set(id, (quantities.get(id) || 0) + quantity);
        if (quantities.get(id) > 20) {
            return res.status(400).json({ message: "You can order at most 20 of each dish." });
        }
    }

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(", ");
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [foodItems] = await connection.execute(
            `SELECT id, name, price FROM food_items WHERE is_active = TRUE AND id IN (${placeholders}) FOR UPDATE`,
            ids
        );
        if (foodItems.length !== ids.length) {
            await connection.rollback();
            return res.status(400).json({ message: "A dish in your cart is no longer available. Refresh the menu and try again." });
        }

        const itemById = new Map(foodItems.map(item => [item.id, item]));
        const orderLines = ids.map(id => {
            const item = itemById.get(id);
            const quantity = quantities.get(id);
            const unitCents = Math.round(Number(item.price) * 100);
            return { id, name: item.name, quantity, unitCents, lineCents: unitCents * quantity };
        });
        const totalCents = orderLines.reduce((sum, line) => sum + line.lineCents, 0);
        const orderNumber = `FE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const totalAmount = (totalCents / 100).toFixed(2);

        const [orderResult] = await connection.execute(
            `INSERT INTO orders
             (order_number, customer_name, email, phone, delivery_address, notes, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderNumber, customer.name, customer.email, customer.phone, customer.address, customer.notes, totalAmount]
        );

        for (const line of orderLines) {
            await connection.execute(
                `INSERT INTO order_items (order_id, food_item_id, item_name, unit_price, quantity, line_total)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [orderResult.insertId, line.id, line.name, (line.unitCents / 100).toFixed(2), line.quantity, (line.lineCents / 100).toFixed(2)]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: "Your order has been placed.",
            orderNumber,
            total: totalAmount,
            status: "received"
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Order creation failed:", error.message);
        res.status(500).json({ message: "We could not place your order. Please try again." });
    } finally {
        if (connection) connection.release();
    }
});

app.use((error, req, res, next) => {
    console.error("Request error:", error.message);
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Request body must contain valid JSON." });
    }
    res.status(500).json({ message: "An unexpected error occurred. Please try again." });
});

async function start() {
    try {
        await pool.query("SELECT 1");
        app.listen(PORT, () => {
            console.log(`FoodExpress is running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed. Check MySQL and your environment settings:", error.message);
        process.exitCode = 1;
    }
}

start();

