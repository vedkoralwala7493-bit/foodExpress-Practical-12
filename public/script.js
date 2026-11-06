const menuGrid = document.getElementById("menuGrid");
const categoryList = document.getElementById("categoryList");
const searchInput = document.getElementById("menuSearch");
const menuMessage = document.getElementById("menuMessage");
const cartItems = document.getElementById("cartItems");
const emptyCart = document.getElementById("emptyCart");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutMessage = document.getElementById("checkoutMessage");
const orderToast = bootstrap.Toast.getOrCreateInstance(document.getElementById("orderToast"));
const cart = new Map();
let selectedCategory = "All";
let searchTimer;

function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value));
}

function showMenuMessage(text, type = "danger") {
    menuMessage.textContent = text;
    menuMessage.className = `alert alert-${type}`;
}

async function getJson(url, options = {}) {
    let response;
    try {
        response = await fetch(url, options);
    } catch {
        throw new Error("Could not connect to FoodExpress. Check that the server is running.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
    }
    return data;
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

async function loadCategories() {
    try {
        const data = await getJson("/api/categories");
        const categories = ["All", ...data.categories];
        categoryList.replaceChildren();

        categories.forEach((category, index) => {
            const column = makeElement("div", "col-6 col-md-4 col-lg-2");
            const button = makeElement("button", "category-card w-100");
            button.type = "button";
            button.dataset.category = category;
            if (index === 0) button.classList.add("active");

            const icon = makeElement("span", "", {
                All: "🍽️",
                Burgers: "🍔",
                Pizza: "🍕",
                Bowls: "🥗",
                Pasta: "🍝",
                Desserts: "🍰"
            }[category] || "🍴");
            const label = makeElement("b", "", category === "All" ? "All dishes" : category);

            button.append(icon, label);
            button.addEventListener("click", () => {
                categoryList.querySelectorAll(".category-card").forEach(item => {
                    item.classList.remove("active");
                });
                button.classList.add("active");
                selectedCategory = category;
                loadMenu();
            });

            column.appendChild(button);
            categoryList.appendChild(column);
        });
    } catch (error) {
        showMenuMessage(error.message);
    }
}

function createFoodCard(item) {
    const column = makeElement("div", "col-12 col-sm-6 col-lg-4");
    const card = makeElement("article", "card food-card h-100 rounded-xl shadow-sm");
    const image = makeElement("img", "food-photo");
    image.src = item.image_url;
    image.alt = item.name;
    image.loading = "lazy";
    image.onerror = () => {
        image.src = "https://placehold.co/800x500/f7e8da/5b4636?text=FoodExpress";
    };

    const body = makeElement("div", "card-body d-flex flex-column p-3 md:p-4");
    const topLine = makeElement("div", "d-flex justify-content-between align-items-center mb-2");

    if (item.is_featured) {
        topLine.appendChild(makeElement("span", "badge rounded-pill text-bg-warning text-dark", "Popular"));
    } else {
        topLine.appendChild(makeElement("span", "badge rounded-pill text-bg-light", item.category));
    }

    const rating = makeElement("span", "food-rating", "★ 4.8");
    topLine.appendChild(rating);

    const title = makeElement("h3", "card-title tracking-tight", item.name);
    const description = makeElement("p", "card-text", item.description);
    const footer = makeElement("div", "food-meta mt-auto pt-2");
    const price = makeElement("span", "food-price", formatPrice(item.price));
    const addButton = makeElement("button", "btn btn-orange add-button shadow-sm", "+");
    addButton.type = "button";
    addButton.setAttribute("aria-label", `Add ${item.name} to your order`);
    addButton.addEventListener("click", () => addToCart(item));

    footer.append(price, addButton);
    body.append(topLine, title, description, footer);
    card.append(image, body);
    column.appendChild(card);
    return column;
}

async function loadMenu() {
    menuGrid.replaceChildren();
    menuGrid.appendChild(makeElement("div", "col-12 text-center py-5 text-secondary", "Loading the menu…"));
    menuMessage.className = "alert d-none";

    const params = new URLSearchParams();
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
    const query = params.toString();

    try {
        const data = await getJson(`/api/menu${query ? `?${query}` : ""}`);
        menuGrid.replaceChildren(...data.items.map(createFoodCard));
        document.getElementById("noResults").classList.toggle("d-none", data.items.length > 0);
    } catch (error) {
        menuGrid.replaceChildren();
        document.getElementById("noResults").classList.remove("d-none");
        showMenuMessage(error.message);
    }
}

function addToCart(item) {
    const existing = cart.get(item.id);
    if (existing && existing.quantity >= 20) {
        showToast("You can add up to 20 of each dish.");
        return;
    }
    cart.set(item.id, {
        item,
        quantity: existing ? existing.quantity + 1 : 1
    });
    renderCart();
    showToast(`${item.name} added to your order.`);
}

function changeQuantity(id, amount) {
    const entry = cart.get(id);
    if (!entry) return;
    const nextQuantity = entry.quantity + amount;
    if (nextQuantity < 1) {
        cart.delete(id);
    } else if (nextQuantity <= 20) {
        entry.quantity = nextQuantity;
    }
    renderCart();
}

function renderCart() {
    cartItems.replaceChildren();
    const entries = [...cart.values()];
    const itemCount = entries.reduce((total, entry) => total + entry.quantity, 0);
    const subtotal = entries.reduce((total, entry) => {
        return total + Number(entry.item.price) * entry.quantity;
    }, 0);

    cartCount.textContent = itemCount;
    cartTotal.textContent = formatPrice(subtotal);
    emptyCart.classList.toggle("d-none", entries.length > 0);

    entries.forEach(({ item, quantity }) => {
        const line = makeElement("div", "cart-line");
        const name = makeElement("span", "cart-line-name", item.name);
        const linePrice = makeElement("span", "cart-line-price", formatPrice(Number(item.price) * quantity));
        const controls = makeElement("div", "cart-controls");

        const decrease = makeElement("button", "", "−");
        decrease.type = "button";
        decrease.setAttribute("aria-label", `Remove one ${item.name}`);
        decrease.addEventListener("click", () => changeQuantity(item.id, -1));

        const count = makeElement("span", "small", quantity);

        const increase = makeElement("button", "", "+");
        increase.type = "button";
        increase.setAttribute("aria-label", `Add one ${item.name}`);
        increase.addEventListener("click", () => changeQuantity(item.id, 1));

        const remove = makeElement("button", "btn btn-link cart-remove p-0", "Remove");
        remove.type = "button";
        remove.addEventListener("click", () => {
            cart.delete(item.id);
            renderCart();
        });

        controls.append(decrease, count, increase, remove);
        line.append(name, linePrice, controls);
        cartItems.appendChild(line);
    });
}

function showToast(text) {
    document.getElementById("toastMessage").textContent = text;
    orderToast.show();
}

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadMenu, 250);
});

document.getElementById("checkoutForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.getElementById("placeOrderButton");
    const message = checkoutMessage;

    if (!form.reportValidity()) return;
    if (cart.size === 0) {
        message.textContent = "Add at least one dish before placing your order.";
        message.className = "small mt-2 text-danger";
        return;
    }

    const payload = {
        customerName: document.getElementById("customerName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        items: [...cart.entries()].map(([id, entry]) => ({ id, quantity: entry.quantity }))
    };

    button.disabled = true;
    button.textContent = "Submitting order…";
    message.textContent = "";

    try {
        const result = await getJson("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        cart.clear();
        renderCart();
        form.reset();
        message.textContent = `${result.message} Reference: ${result.orderNumber}. Total: ${formatPrice(result.total)}.`;
        message.className = "small mt-2 text-success fw-semibold";
    } catch (error) {
        message.textContent = error.message;
        message.className = "small mt-2 text-danger";
    } finally {
        button.disabled = false;
        button.textContent = "Place order";
    }
});

renderCart();
loadCategories();
loadMenu();
