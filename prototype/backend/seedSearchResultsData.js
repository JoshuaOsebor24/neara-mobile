require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const ensureSchema = require("./config/ensureSchema");
const {
  purgeManagedSeedStores,
  STORE_BLUEPRINTS,
} = require("./seedData/osborneStores");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
});

const PASSWORD_HASH_ROUNDS = 8;
const DEFAULT_PASSWORD = "NearaDev123!";

const LEGACY_STORE_BLUEPRINTS = [
  {
    store: {
      store_name: "Green Basket Grocery",
      category: "Grocery",
      address: "22 Adeniji Adele Road, Lagos Island, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.526,
      longitude: 3.375,
      phone_number: "+234 801 555 0102",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Neighborhood grocery for pantry staples, fresh produce, breakfast items, and quick household restocks.",
      owner: {
        name: "Ada Green",
        email: "owner+green-basket@neara.test",
        phone_number: "+234 801 555 1102",
      },
    },
    products: [
      {
        product_name: "Sunflower Oil",
        category: "Cooking Essentials",
        description: "Refined sunflower oil for frying, grilling, and everyday cooking.",
        tags: ["grocery", "oil", "sunflower oil", "cooking oil"],
        variants: [
          { variant_name: "1L Bottle", price: 3200, stock_quantity: 24, in_stock: true },
          { variant_name: "2L Bottle", price: 6100, stock_quantity: 16, in_stock: true },
        ],
      },
      {
        product_name: "Golden Morn Cereal",
        category: "Breakfast",
        description: "Family breakfast cereal that pairs well with milk and fruit.",
        tags: ["grocery", "cereal", "breakfast", "golden morn"],
        variants: [
          { variant_name: "500g Pack", price: 1850, stock_quantity: 28, in_stock: true },
          { variant_name: "900g Pack", price: 3300, stock_quantity: 14, in_stock: true },
        ],
      },
      {
        product_name: "Basmati Rice",
        category: "Grains",
        description: "Fragrant long-grain basmati rice for family meals and party cooking.",
        tags: ["grocery", "rice", "basmati rice", "grains"],
        variants: [
          { variant_name: "5kg Bag", price: 14800, stock_quantity: 12, in_stock: true },
          { variant_name: "10kg Bag", price: 28800, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Brown Beans",
        category: "Grains",
        description: "Clean brown beans for porridge, moi-moi, and akara.",
        tags: ["grocery", "beans", "brown beans", "protein"],
        variants: [
          { variant_name: "1kg Bag", price: 2400, stock_quantity: 32, in_stock: true },
          { variant_name: "3kg Bag", price: 7000, stock_quantity: 15, in_stock: true },
        ],
      },
      {
        product_name: "Peak Milk",
        category: "Dairy",
        description: "Full cream milk powder for tea, coffee, and cereals.",
        tags: ["grocery", "milk", "peak milk", "dairy"],
        variants: [
          { variant_name: "400g Tin", price: 4100, stock_quantity: 18, in_stock: true },
          { variant_name: "900g Tin", price: 8450, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Fresh Tomatoes",
        category: "Produce",
        description: "Fresh red tomatoes for stew, soups, and jollof rice.",
        tags: ["grocery", "tomatoes", "produce", "vegetables"],
        variants: [
          { variant_name: "1kg Basket", price: 2200, stock_quantity: 20, in_stock: true },
          { variant_name: "2kg Basket", price: 4200, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Whole Wheat Bread",
        category: "Bakery",
        description: "Soft whole wheat loaf for breakfast sandwiches and toast.",
        tags: ["grocery", "bread", "wheat bread", "bakery"],
        variants: [
          { variant_name: "Single Loaf", price: 1650, stock_quantity: 19, in_stock: true },
        ],
      },
      {
        product_name: "Table Sugar",
        category: "Baking",
        description: "Granulated white sugar for tea, baking, and desserts.",
        tags: ["grocery", "sugar", "baking", "table sugar"],
        variants: [
          { variant_name: "500g Pack", price: 950, stock_quantity: 30, in_stock: true },
          { variant_name: "1kg Pack", price: 1750, stock_quantity: 22, in_stock: true },
        ],
      },
      {
        product_name: "Nescafe Classic",
        category: "Beverages",
        description: "Instant coffee granules for morning coffee and quick breaks.",
        tags: ["grocery", "coffee", "nescafe", "beverages"],
        variants: [
          { variant_name: "50g Jar", price: 2400, stock_quantity: 14, in_stock: true },
          { variant_name: "100g Jar", price: 4300, stock_quantity: 9, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Sunrise Bakery",
      category: "Bakery",
      address: "14 Broad Street, Lagos Island, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.5244,
      longitude: 3.3792,
      phone_number: "+234 801 555 0101",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Fresh bread, pastries, celebration cakes, meat pies, and quick breakfast options baked daily.",
      owner: {
        name: "Tunde Sunrise",
        email: "owner+sunrise-bakery@neara.test",
        phone_number: "+234 801 555 1101",
      },
    },
    products: [
      {
        product_name: "Sourdough Bread",
        category: "Bread",
        description: "Crusty artisan sourdough loaf with a soft center.",
        tags: ["bakery", "bread", "sourdough", "artisan bread"],
        variants: [
          { variant_name: "Medium Loaf", price: 2800, stock_quantity: 10, in_stock: true },
          { variant_name: "Large Loaf", price: 3900, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Butter Croissant",
        category: "Pastries",
        description: "Layered butter croissant baked fresh every morning.",
        tags: ["bakery", "croissant", "pastry", "breakfast"],
        variants: [
          { variant_name: "Single", price: 1200, stock_quantity: 25, in_stock: true },
          { variant_name: "Box of 4", price: 4400, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Chocolate Cake",
        category: "Cakes",
        description: "Rich chocolate sponge cake with smooth cocoa frosting.",
        tags: ["bakery", "cake", "chocolate cake", "dessert"],
        variants: [
          { variant_name: "6-inch Cake", price: 11500, stock_quantity: 5, in_stock: true },
          { variant_name: "8-inch Cake", price: 16800, stock_quantity: 3, in_stock: true },
        ],
      },
      {
        product_name: "Vanilla Cupcakes",
        category: "Cakes",
        description: "Soft vanilla cupcakes with creamy butter icing.",
        tags: ["bakery", "cupcakes", "vanilla", "dessert"],
        variants: [
          { variant_name: "Box of 6", price: 5200, stock_quantity: 9, in_stock: true },
          { variant_name: "Box of 12", price: 9800, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Meat Pie",
        category: "Savory Snacks",
        description: "Buttery pastry filled with seasoned minced beef and vegetables.",
        tags: ["bakery", "meat pie", "snack", "pastry"],
        variants: [
          { variant_name: "Single", price: 1400, stock_quantity: 30, in_stock: true },
          { variant_name: "Pack of 4", price: 5200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Sausage Roll",
        category: "Savory Snacks",
        description: "Flaky sausage roll for breakfast and quick bites.",
        tags: ["bakery", "sausage roll", "snack", "pastry"],
        variants: [
          { variant_name: "Single", price: 1200, stock_quantity: 27, in_stock: true },
          { variant_name: "Pack of 4", price: 4500, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "Chocolate Chip Cookies",
        category: "Cookies",
        description: "Crunchy cookies packed with chocolate chips.",
        tags: ["bakery", "cookies", "chocolate chip", "dessert"],
        variants: [
          { variant_name: "6 Pieces", price: 2100, stock_quantity: 18, in_stock: true },
          { variant_name: "12 Pieces", price: 3900, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Cinnamon Rolls",
        category: "Pastries",
        description: "Soft cinnamon rolls with cream glaze.",
        tags: ["bakery", "cinnamon rolls", "pastry", "dessert"],
        variants: [
          { variant_name: "2 Pieces", price: 2500, stock_quantity: 12, in_stock: true },
          { variant_name: "6 Pieces", price: 6900, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Banana Bread",
        category: "Bread",
        description: "Moist banana bread loaf with warm spice notes.",
        tags: ["bakery", "banana bread", "sweet bread", "dessert"],
        variants: [
          { variant_name: "Mini Loaf", price: 2800, stock_quantity: 8, in_stock: true },
          { variant_name: "Family Loaf", price: 5100, stock_quantity: 4, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "VoltHub Electronics",
      category: "Electronics",
      address: "5 Broad Street Tech Arcade, Lagos Island, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.5215,
      longitude: 3.3788,
      phone_number: "+234 801 555 0105",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Phone and laptop accessories, power solutions, storage devices, and everyday electronics essentials.",
      owner: {
        name: "Kola Volt",
        email: "owner+volthub@neara.test",
        phone_number: "+234 801 555 1105",
      },
    },
    products: [
      {
        product_name: "USB-C Fast Charger",
        category: "Chargers",
        description: "Fast wall charger for Android phones, tablets, and USB-C gadgets.",
        tags: ["electronics", "charger", "usb-c charger", "fast charger"],
        variants: [
          { variant_name: "20W", price: 5800, stock_quantity: 16, in_stock: true },
          { variant_name: "33W", price: 7600, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "USB-C Cable",
        category: "Cables",
        description: "Durable braided USB-C cable for charging and data transfer.",
        tags: ["electronics", "usb cable", "usb-c cable", "cable"],
        variants: [
          { variant_name: "1 Meter", price: 2200, stock_quantity: 26, in_stock: true },
          { variant_name: "2 Meters", price: 3200, stock_quantity: 18, in_stock: true },
        ],
      },
      {
        product_name: "Power Bank",
        category: "Power",
        description: "Portable power bank for phones, tablets, and earbuds.",
        tags: ["electronics", "power bank", "battery", "portable charger"],
        variants: [
          { variant_name: "10000mAh", price: 12500, stock_quantity: 9, in_stock: true },
          { variant_name: "20000mAh", price: 18900, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Wireless Earbuds",
        category: "Audio",
        description: "Compact Bluetooth earbuds with charging case.",
        tags: ["electronics", "earbuds", "audio", "bluetooth"],
        variants: [
          { variant_name: "Standard", price: 14500, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Bluetooth Speaker",
        category: "Audio",
        description: "Portable Bluetooth speaker with clear vocals and bass.",
        tags: ["electronics", "speaker", "bluetooth speaker", "audio"],
        variants: [
          { variant_name: "Mini", price: 9800, stock_quantity: 7, in_stock: true },
          { variant_name: "Party Size", price: 18500, stock_quantity: 3, in_stock: true },
        ],
      },
      {
        product_name: "Laptop Charger",
        category: "Chargers",
        description: "Replacement laptop charger for common office laptops.",
        tags: ["electronics", "laptop charger", "charger", "power supply"],
        variants: [
          { variant_name: "65W", price: 16800, stock_quantity: 5, in_stock: true },
          { variant_name: "90W", price: 19800, stock_quantity: 3, in_stock: true },
        ],
      },
      {
        product_name: "Flash Drive",
        category: "Storage",
        description: "USB flash drive for backups, transfer, and quick storage.",
        tags: ["electronics", "flash drive", "usb storage", "storage"],
        variants: [
          { variant_name: "32GB", price: 4200, stock_quantity: 14, in_stock: true },
          { variant_name: "64GB", price: 6500, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "HDMI Cable",
        category: "Cables",
        description: "HDMI cable for monitors, TVs, and laptop display output.",
        tags: ["electronics", "hdmi cable", "display cable", "cable"],
        variants: [
          { variant_name: "1.5 Meters", price: 3500, stock_quantity: 13, in_stock: true },
          { variant_name: "3 Meters", price: 5200, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Phone Case",
        category: "Accessories",
        description: "Protective phone case for daily use and drop protection.",
        tags: ["electronics", "phone case", "accessories", "protection"],
        variants: [
          { variant_name: "iPhone 13", price: 3200, stock_quantity: 9, in_stock: true },
          { variant_name: "Samsung A54", price: 2900, stock_quantity: 8, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "FreshMart",
      category: "Supermarket",
      address: "31 Idumagbo Avenue, Lagos Island, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.5285,
      longitude: 3.3775,
      phone_number: "+234 801 555 0104",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Everyday supermarket for beverages, dairy, snacks, produce, and quick family shopping.",
      owner: {
        name: "Bisi Fresh",
        email: "owner+freshmart@neara.test",
        phone_number: "+234 801 555 1104",
      },
    },
    products: [
      {
        product_name: "Coca-Cola",
        category: "Beverages",
        description: "Classic chilled cola for meals, parties, and quick refreshment.",
        tags: ["supermarket", "beverages", "coke", "soft drink"],
        variants: [
          { variant_name: "50cl Bottle", price: 500, stock_quantity: 40, in_stock: true },
          { variant_name: "1.5L Bottle", price: 1100, stock_quantity: 18, in_stock: true },
        ],
      },
      {
        product_name: "Fanta Orange",
        category: "Beverages",
        description: "Orange soda served chilled for everyday refreshment.",
        tags: ["supermarket", "beverages", "fanta", "soft drink"],
        variants: [
          { variant_name: "50cl Bottle", price: 500, stock_quantity: 38, in_stock: true },
          { variant_name: "1.5L Bottle", price: 1100, stock_quantity: 17, in_stock: true },
        ],
      },
      {
        product_name: "Greek Yogurt",
        category: "Dairy",
        description: "Thick creamy yogurt for breakfast bowls and snacks.",
        tags: ["supermarket", "yogurt", "dairy", "breakfast"],
        variants: [
          { variant_name: "Single Cup", price: 1800, stock_quantity: 12, in_stock: true },
          { variant_name: "Family Tub", price: 5200, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Chicken Breast",
        category: "Frozen Foods",
        description: "Freshly packed chicken breast portions for home cooking.",
        tags: ["supermarket", "chicken", "protein", "frozen"],
        variants: [
          { variant_name: "1kg Pack", price: 6200, stock_quantity: 10, in_stock: true },
          { variant_name: "2kg Pack", price: 11800, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Plantain Chips",
        category: "Snacks",
        description: "Crispy sweet-and-salty plantain chips.",
        tags: ["supermarket", "snacks", "plantain chips", "crisps"],
        variants: [
          { variant_name: "Small Pack", price: 900, stock_quantity: 24, in_stock: true },
          { variant_name: "Family Pack", price: 1800, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "Orange Juice",
        category: "Beverages",
        description: "Ready-to-drink orange juice for breakfast and lunch.",
        tags: ["supermarket", "juice", "orange juice", "beverages"],
        variants: [
          { variant_name: "1L Carton", price: 2300, stock_quantity: 14, in_stock: true },
          { variant_name: "1.5L Bottle", price: 3200, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Cheddar Cheese",
        category: "Dairy",
        description: "Sliced cheddar cheese for sandwiches and burgers.",
        tags: ["supermarket", "cheese", "dairy", "sandwich"],
        variants: [
          { variant_name: "200g Pack", price: 2700, stock_quantity: 11, in_stock: true },
          { variant_name: "400g Pack", price: 4900, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Breakfast Sausage",
        category: "Frozen Foods",
        description: "Breakfast sausages for quick morning meals and brunch.",
        tags: ["supermarket", "sausage", "frozen foods", "breakfast"],
        variants: [
          { variant_name: "500g Pack", price: 3500, stock_quantity: 13, in_stock: true },
          { variant_name: "1kg Pack", price: 6600, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Laundry Detergent",
        category: "Household",
        description: "Liquid laundry detergent for everyday washing.",
        tags: ["supermarket", "detergent", "household", "laundry"],
        variants: [
          { variant_name: "1L Bottle", price: 2600, stock_quantity: 15, in_stock: true },
          { variant_name: "3L Bottle", price: 6900, stock_quantity: 7, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Corner Pharmacy",
      category: "Pharmacy",
      address: "8 Marina Medical Plaza, Lagos Island, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.522,
      longitude: 3.3805,
      phone_number: "+234 801 555 0103",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Pain relief, vitamins, wellness products, first aid supplies, and reliable everyday pharmacy essentials.",
      owner: {
        name: "Miriam Care",
        email: "owner+corner-pharmacy@neara.test",
        phone_number: "+234 801 555 1103",
      },
    },
    products: [
      {
        product_name: "Paracetamol Tablets",
        category: "Pain Relief",
        description: "Fast fever and pain relief tablets for home and travel use.",
        tags: ["pharmacy", "paracetamol", "pain relief", "tablets"],
        variants: [
          { variant_name: "Pack of 12", price: 800, stock_quantity: 32, in_stock: true },
          { variant_name: "Pack of 48", price: 2400, stock_quantity: 16, in_stock: true },
        ],
      },
      {
        product_name: "Ibuprofen Capsules",
        category: "Pain Relief",
        description: "Anti-inflammatory capsules for headaches and muscle aches.",
        tags: ["pharmacy", "ibuprofen", "pain relief", "capsules"],
        variants: [
          { variant_name: "Pack of 10", price: 1600, stock_quantity: 22, in_stock: true },
          { variant_name: "Pack of 30", price: 4200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Vitamin C",
        category: "Supplements",
        description: "Daily immune-support supplement tablets.",
        tags: ["pharmacy", "vitamin c", "supplements", "wellness"],
        variants: [
          { variant_name: "1000mg x 20", price: 2900, stock_quantity: 14, in_stock: true },
          { variant_name: "1000mg x 60", price: 7600, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Multivitamins",
        category: "Supplements",
        description: "Daily multivitamins for wellness, energy, and routine nutrition.",
        tags: ["pharmacy", "multivitamins", "supplements", "wellness"],
        variants: [
          { variant_name: "30 Tablets", price: 4300, stock_quantity: 13, in_stock: true },
          { variant_name: "90 Tablets", price: 9900, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Cough Syrup",
        category: "Cold and Flu",
        description: "Soothing cough syrup for dry and chesty cough symptoms.",
        tags: ["pharmacy", "cough syrup", "cold and flu", "cough"],
        variants: [
          { variant_name: "100ml Bottle", price: 3100, stock_quantity: 12, in_stock: true },
          { variant_name: "200ml Bottle", price: 5200, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Antiseptic Liquid",
        category: "First Aid",
        description: "Antiseptic liquid for wound cleaning and hygiene.",
        tags: ["pharmacy", "antiseptic", "first aid", "hygiene"],
        variants: [
          { variant_name: "250ml Bottle", price: 2400, stock_quantity: 10, in_stock: true },
          { variant_name: "500ml Bottle", price: 4200, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "First Aid Kit",
        category: "First Aid",
        description: "Portable first aid kit for home, office, and travel emergencies.",
        tags: ["pharmacy", "first aid kit", "safety", "medical"],
        variants: [
          { variant_name: "Travel Size", price: 6400, stock_quantity: 7, in_stock: true },
          { variant_name: "Home Size", price: 9800, stock_quantity: 4, in_stock: true },
        ],
      },
      {
        product_name: "Digital Thermometer",
        category: "Medical Devices",
        description: "Digital thermometer for quick temperature checks.",
        tags: ["pharmacy", "thermometer", "medical device", "temperature"],
        variants: [
          { variant_name: "Standard", price: 4200, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "Hand Sanitizer",
        category: "Personal Care",
        description: "Alcohol-based sanitizer for everyday hand hygiene.",
        tags: ["pharmacy", "hand sanitizer", "personal care", "hygiene"],
        variants: [
          { variant_name: "100ml Bottle", price: 1100, stock_quantity: 20, in_stock: true },
          { variant_name: "500ml Bottle", price: 3200, stock_quantity: 9, in_stock: true },
        ],
      },
    ],
  },
];

const SHOPPER_BLUEPRINT = {
  name: "Demo Shopper",
  email: "shopper+demo@neara.test",
  phone_number: "+234 801 555 1199",
  roles: ["user", "pro"],
  premium_status: true,
};

function normalizeHeaderImages(headerImages, fallbackImageUrl = null) {
  const compact = (Array.isArray(headerImages) ? headerImages : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (compact.length > 0) {
    return compact;
  }

  return typeof fallbackImageUrl === "string" && fallbackImageUrl.trim()
    ? [fallbackImageUrl.trim()]
    : [];
}

async function findUserByEmail(client, email) {
  const { rows } = await client.query(
    `
      SELECT id, name, email, phone_number, roles, premium_status
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return rows[0] || null;
}

async function ensureUser(client, user, { isOwner = false } = {}) {
  const existingUser = await findUserByEmail(client, user.email);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, PASSWORD_HASH_ROUNDS);
  const nextRoles = Array.from(
    new Set([
      "user",
      ...(Array.isArray(user.roles) ? user.roles : []),
      ...(isOwner ? ["store_owner"] : []),
    ]),
  );
  const premiumStatus = Boolean(user.premium_status);

  if (existingUser) {
    const { rows } = await client.query(
      `
        UPDATE users
        SET
          name = $2,
          phone_number = $3,
          password_hash = $4,
          premium_status = $5,
          roles = $6
        WHERE id = $1
        RETURNING id, name, email, phone_number, roles, premium_status
      `,
      [
        existingUser.id,
        user.name,
        user.phone_number || null,
        passwordHash,
        premiumStatus,
        nextRoles,
      ],
    );

    return rows[0];
  }

  const { rows } = await client.query(
    `
      INSERT INTO users (name, email, password_hash, phone_number, premium_status, roles)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, phone_number, roles, premium_status
    `,
    [
      user.name,
      user.email,
      passwordHash,
      user.phone_number || null,
      premiumStatus,
      nextRoles,
    ],
  );

  return rows[0];
}

async function ensureStore(client, storeData, ownerId) {
  const { rows } = await client.query(
    `
      SELECT id
      FROM stores
      WHERE LOWER(store_name) = LOWER($1)
      LIMIT 1
    `,
    [storeData.store_name],
  );

  const headerImages = normalizeHeaderImages(storeData.header_images, storeData.image_url);

  if (rows[0]) {
    const updated = await client.query(
      `
        UPDATE stores
        SET
          owner_id = $2,
          category = $3,
          address = $4,
          state = $5,
          country = $6,
          latitude = $7,
          longitude = $8,
          phone_number = $9,
          verified = $10,
          is_suspended = FALSE,
          subscription_tier = $11,
          image_url = $12,
          header_images = $13::jsonb,
          description = $14
        WHERE id = $1
        RETURNING id
      `,
      [
        rows[0].id,
        ownerId,
        storeData.category,
        storeData.address,
        storeData.state || null,
        storeData.country || null,
        storeData.latitude,
        storeData.longitude,
        storeData.phone_number || null,
        Boolean(storeData.verified),
        storeData.subscription_tier || 1,
        storeData.image_url || null,
        JSON.stringify(headerImages),
        storeData.description || null,
      ],
    );

    return {
      id: updated.rows[0].id,
      created: false,
    };
  }

  const inserted = await client.query(
    `
      INSERT INTO stores (
        owner_id,
        store_name,
        category,
        address,
        state,
        country,
        latitude,
        longitude,
        phone_number,
        verified,
        is_suspended,
        subscription_tier,
        image_url,
        header_images,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, $12, $13::jsonb, $14)
      RETURNING id
    `,
    [
      ownerId,
      storeData.store_name,
      storeData.category,
      storeData.address,
      storeData.state || null,
      storeData.country || null,
      storeData.latitude,
      storeData.longitude,
      storeData.phone_number || null,
      Boolean(storeData.verified),
      storeData.subscription_tier || 1,
      storeData.image_url || null,
      JSON.stringify(headerImages),
      storeData.description || null,
    ],
  );

  return {
    id: inserted.rows[0].id,
    created: true,
  };
}

async function ensureProduct(client, storeId, product) {
  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE store_id = $1 AND LOWER(product_name) = LOWER($2)
      LIMIT 1
    `,
    [storeId, product.product_name],
  );

  if (existing.rows[0]) {
    const updated = await client.query(
      `
        UPDATE products
        SET
          category = $2,
          description = $3,
          image_url = $4,
          tags = $5
        WHERE id = $1
        RETURNING id
      `,
      [
        existing.rows[0].id,
        product.category || null,
        product.description || null,
        product.image_url || null,
        product.tags || [],
      ],
    );

    return {
      id: updated.rows[0].id,
      created: false,
    };
  }

  const inserted = await client.query(
    `
      INSERT INTO products (store_id, product_name, category, description, image_url, tags)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      storeId,
      product.product_name,
      product.category || null,
      product.description || null,
      product.image_url || null,
      product.tags || [],
    ],
  );

  return {
    id: inserted.rows[0].id,
    created: true,
  };
}

async function ensureVariants(client, productId, variants) {
  let createdVariants = 0;

  for (const variant of variants) {
    const existing = await client.query(
      `
        SELECT id
        FROM product_variants
        WHERE product_id = $1
          AND COALESCE(LOWER(variant_name), '') = COALESCE(LOWER($2), '')
        LIMIT 1
      `,
      [productId, variant.variant_name || null],
    );

    if (existing.rows[0]) {
      await client.query(
        `
          UPDATE product_variants
          SET
            price = $2,
            stock_quantity = $3,
            in_stock = $4
          WHERE id = $1
        `,
        [
          existing.rows[0].id,
          variant.price,
          variant.stock_quantity ?? 0,
          Boolean(variant.in_stock),
        ],
      );
      continue;
    }

    await client.query(
      `
        INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, in_stock)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        productId,
        variant.variant_name || null,
        variant.price,
        variant.stock_quantity ?? 0,
        Boolean(variant.in_stock),
      ],
    );
    createdVariants += 1;
  }

  return createdVariants;
}

async function ensureSavedStore(client, userId, storeId) {
  await client.query(
    `
      INSERT INTO saved_stores (user_id, store_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, store_id) DO NOTHING
    `,
    [userId, storeId],
  );
}

async function seedSearchResultsData() {
  const client = await pool.connect();

  try {
    console.log("🌱 Seeding Neara development data...");
    await ensureSchema();
    await client.query("BEGIN");
    await purgeManagedSeedStores(client);

    const shopperUser = await ensureUser(client, SHOPPER_BLUEPRINT);
    let createdStores = 0;
    let createdProducts = 0;
    let createdVariants = 0;
    const seededStores = [];

    for (const blueprint of STORE_BLUEPRINTS) {
      const owner = await ensureUser(client, blueprint.store.owner, { isOwner: true });
      const storeResult = await ensureStore(client, blueprint.store, owner.id);

      if (storeResult.created) {
        createdStores += 1;
      }

      seededStores.push({
        id: storeResult.id,
        store_name: blueprint.store.store_name,
        category: blueprint.store.category,
      });

      for (const product of blueprint.products) {
        const productResult = await ensureProduct(client, storeResult.id, product);

        if (productResult.created) {
          createdProducts += 1;
        }

        createdVariants += await ensureVariants(client, productResult.id, product.variants);
      }
    }

    for (const savedStore of seededStores.slice(0, 3)) {
      await ensureSavedStore(client, shopperUser.id, savedStore.id);
    }

    await client.query("COMMIT");

    console.log("✅ Neara development data ready", {
      createdProducts,
      createdStores,
      createdVariants,
      defaultPassword: DEFAULT_PASSWORD,
      sampleShopperEmail: SHOPPER_BLUEPRINT.email,
      totalProductsConfigured: STORE_BLUEPRINTS.reduce(
        (sum, blueprint) => sum + blueprint.products.length,
        0,
      ),
      totalStoresConfigured: STORE_BLUEPRINTS.length,
    });

    console.table(
      seededStores.map((store) => ({
        id: store.id,
        category: store.category,
        store_name: store.store_name,
      })),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Development seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSearchResultsData();
