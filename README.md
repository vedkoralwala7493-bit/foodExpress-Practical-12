# FoodExpress Capstone — Practical 12

A responsive food-ordering web application demonstrating HTML5, CSS, JavaScript, Bootstrap, Tailwind utilities, Express server-side processing, a MySQL database, a JSON REST API, server-side validation, safe order creation, and Git version control.

## Project files

- `public/index.html` — responsive homepage, menu, cart, and checkout form.
- `public/style.css` — project styles and mobile/tablet breakpoints.
- `public/script.js` — menu search/filtering, cart interactions, and JSON API calls.
- `server.js` — Express application, REST endpoints, validation, and transaction processing.
- `schema.sql` — database tables and starter menu data.
- `.env.example` — sample configuration names; make your own `.env` from it.

## Requirements

- Node.js 18 or later
- MySQL 8.0.16 or later
- Internet access to load Bootstrap, Tailwind, and the menu images from their CDNs

## Setup and run

1. **Create the database.** Open MySQL Workbench or a MySQL terminal and run all statements in `schema.sql`. This creates the `foodexpress` database, the `food_items`, `orders`, and `order_items` tables, and sample menu items.
2. **Configure the connection.** Copy `.env.example` to a new file named `.env`. Fill in the MySQL host, port, username, password, database name, and desired app port. Do not commit `.env` to Git.
3. **Install the packages.** Open a terminal in the project folder and run `npm install`.
4. **Start the app.** Run `npm start`.
5. **Open the site.** Visit `http://localhost:3000` (or the port configured in `.env`). Search dishes, filter categories, add items to the cart, and submit an order.

## REST API endpoints

- `GET /api/health` — basic service status.
- `GET /api/categories` — active menu categories as JSON.
- `GET /api/menu` — active menu items; optional `category` and `q` query parameters filter results.
- `POST /api/orders` — validate and create an order. The request accepts customer details and item IDs/quantities. The server reads current prices from MySQL and calculates the total; it does not trust a price sent by the browser.

Example request for `POST /api/orders`:

```json
{
  "customerName": "Alex Morgan",
  "email": "alex@example.com",
  "phone": "+15550142828",
  "address": "123 Market Street, Example City",
  "notes": "Please ring the bell",
  "items": [
    { "id": 1, "quantity": 2 },
    { "id": 4, "quantity": 1 }
  ]
}
```

## Security and validation practices

- Prepared MySQL statements are used for menu queries and every order insert.
- The server checks customer fields and item IDs/quantities before writing data.
- The order and order-item rows are created in a database transaction.
- The server calculates prices using database values, not client-provided prices.
- Helmet sets security headers; order submissions are rate-limited.
- Browser-rendered content uses DOM `textContent` for user input rather than inserting it as HTML.
- API errors shown to users are generic; server-side logs retain diagnostic messages.

This is an educational ordering demo. It does not process payments, calculate delivery charges, or provide staff authentication/order administration.

## Git version control

From the project folder, initialize and commit the source:

```bash
git init
git add .
git status
git commit -m "Build FoodExpress capstone"
```

Create an empty repository on GitHub, then connect and push it using the remote URL GitHub provides:

```bash
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Check that `.env` is not staged before pushing. `.gitignore` already excludes it.

## Deployment outline

1. Provision a Node.js hosting service and a MySQL database.
2. Run `schema.sql` against the production database.
3. Set the database variables and `PORT` in the host's environment-variable settings.
4. Deploy the GitHub repository and configure the start command as `npm start`.
5. Open the deployed HTTPS site and verify the homepage, menu filters, and a test order.

The Tailwind Play CDN is convenient for this course demonstration. For production, compile Tailwind into a static CSS asset instead of using the browser Play CDN.

## Verification checklist

- Open the site at desktop width, then use browser responsive/device mode to check tablet and phone widths.
- Confirm the mobile navigation opens and closes.
- Search for a dish, select a category, add a dish, increase/decrease its quantity, and remove it.
- Submit a valid order and confirm the generated reference and total.
- Try an invalid email, missing address, empty cart, quantity 0, and quantity above 20; the server should reject invalid orders.
- Check the API from a terminal (replace the example fields with test values):

```bash
curl http://localhost:3000/api/menu

curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Alex Morgan","email":"alex@example.com","phone":"+15550142828","address":"123 Market Street, Example City","notes":"","items":[{"id":1,"quantity":2}]}'
```

`GET /api/menu` should return an `items` JSON array. A valid order request should return HTTP 201 with an order number and server-calculated total. Invalid input should return HTTP 400 with a helpful message.
