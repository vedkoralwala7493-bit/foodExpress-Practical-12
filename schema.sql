CREATE DATABASE IF NOT EXISTS foodexpress
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE foodexpress;

CREATE TABLE IF NOT EXISTS food_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    description VARCHAR(300) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_food_item_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(24) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    delivery_address VARCHAR(300) NOT NULL,
    notes VARCHAR(300) NOT NULL DEFAULT '',
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('received', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'received',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_order_number (order_number),
    CONSTRAINT chk_order_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    food_item_id INT UNSIGNED NOT NULL,
    item_name VARCHAR(120) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_food FOREIGN KEY (food_item_id)
        REFERENCES food_items(id) ON DELETE RESTRICT,
    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

INSERT INTO food_items (name, category, description, price, image_url, is_featured)
SELECT * FROM (
    SELECT 'The House Burger', 'Burgers', 'Smash patty, cheddar, pickles, and our house sauce.', 12.50, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', TRUE
    UNION ALL SELECT 'Crispy Chicken Burger', 'Burgers', 'Golden chicken, crunchy slaw, and tangy pickles.', 13.50, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=800&q=80', FALSE
    UNION ALL SELECT 'Garden Pesto Pizza', 'Pizza', 'Basil pesto, roasted tomatoes, mozzarella, and greens.', 15.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80', TRUE
    UNION ALL SELECT 'Green Goddess Bowl', 'Bowls', 'Avocado, quinoa, crisp greens, and lemon tahini.', 13.25, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', TRUE
    UNION ALL SELECT 'Creamy Tuscan Pasta', 'Pasta', 'Tomato cream, parmesan, herbs, and a little chili.', 14.75, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80', FALSE
    UNION ALL SELECT 'Chocolate Lava Cake', 'Desserts', 'Warm chocolate cake with a soft center and vanilla cream.', 7.25, 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=800&q=80', TRUE
    UNION ALL SELECT 'Crispy Garden Salad', 'Bowls', 'Seasonal greens, cucumber, tomato, and house vinaigrette.', 10.50, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', FALSE
    UNION ALL SELECT 'Margherita Pizza', 'Pizza', 'Tomato, fresh mozzarella, basil, and olive oil.', 14.00, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80', FALSE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM food_items LIMIT 1);
