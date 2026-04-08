require("dotenv").config();

const bcrypt = require("bcrypt");
const ensureSchema = require("./config/ensureSchema");
const pool = require("./config/db");
const {
  purgeManagedSeedStores,
  STORE_BLUEPRINTS,
} = require("./seedData/osborneStores");

const PASSWORD_HASH_ROUNDS = 8;
const DEFAULT_PASSWORD = "NearaSeed123!";

const LEGACY_STORE_BLUEPRINTS = [
  {
    store: {
      store_name: "Mama Chidinma Market",
      category: "Grocery",
      address: "12 Admiralty Way, Lekki Phase 1, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.4311,
      longitude: 3.4555,
      phone_number: "+234 801 555 2101",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Busy neighborhood grocery with pantry staples, fresh produce, chilled drinks, and everyday household essentials.",
      owner: {
        name: "Chidinma Okeke",
        email: "owner+mama-chidinma@neara.test",
        phone_number: "+234 801 555 3101",
      },
    },
    products: [
      {
        product_name: "Mama Gold Rice",
        category: "Grains",
        description: "Stone-free long grain rice suitable for jollof rice, fried rice, and everyday family meals.",
        image_url:
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80",
        tags: ["rice"],
        variants: [
          { variant_name: "2kg Bag", price: 4200, stock_quantity: 24, in_stock: true },
          { variant_name: "5kg Bag", price: 9800, stock_quantity: 18, in_stock: true },
        ],
      },
      {
        product_name: "Golden Penny Semovita",
        category: "Grains",
        description: "Smooth semovita for swallow dishes, easy to prepare and suitable for regular home use.",
        image_url:
          "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal"],
        variants: [
          { variant_name: "1kg Pack", price: 1700, stock_quantity: 30, in_stock: true },
          { variant_name: "5kg Pack", price: 7900, stock_quantity: 14, in_stock: true },
        ],
      },
      {
        product_name: "Honeywell Wheat Bread",
        category: "Bakery",
        description: "Soft sliced wheat bread for breakfast toast, sandwiches, and quick family meals.",
        image_url:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
        tags: ["bread"],
        variants: [
          { variant_name: "Small Loaf", price: 1100, stock_quantity: 20, in_stock: true },
          { variant_name: "Big Loaf", price: 1500, stock_quantity: 17, in_stock: true },
        ],
      },
      {
        product_name: "Peak Full Cream Milk",
        category: "Dairy",
        description: "Creamy milk powder for tea, coffee, cereals, and baking.",
        image_url:
          "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "400g Tin", price: 4300, stock_quantity: 16, in_stock: true },
          { variant_name: "850g Tin", price: 8400, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Fresh Farm Eggs",
        category: "Dairy",
        description: "Fresh eggs sourced from local poultry farms and packed for daily home cooking.",
        image_url:
          "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "Half Crate", price: 3200, stock_quantity: 22, in_stock: true },
          { variant_name: "Full Crate", price: 6200, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Fresh Tomatoes",
        category: "Produce",
        description: "Bright red tomatoes for stew, soups, sauces, and everyday cooking.",
        image_url:
          "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "1kg Basket", price: 1800, stock_quantity: 26, in_stock: true },
          { variant_name: "2kg Basket", price: 3400, stock_quantity: 13, in_stock: true },
        ],
      },
      {
        product_name: "Ripe Plantain",
        category: "Produce",
        description: "Sweet ripe plantain suitable for frying, roasting, or boiling.",
        image_url:
          "https://images.unsplash.com/photo-1603048719539-9ecb4ce4c7b8?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Pack of 5", price: 1400, stock_quantity: 28, in_stock: true },
          { variant_name: "Pack of 10", price: 2700, stock_quantity: 15, in_stock: true },
        ],
      },
      {
        product_name: "New Yam Tubers",
        category: "Produce",
        description: "Fresh yam tubers for pounded yam, porridge, and roasted yam dishes.",
        image_url:
          "https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "2 Medium Tubers", price: 2600, stock_quantity: 18, in_stock: true },
          { variant_name: "4 Medium Tubers", price: 4900, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Devon King's Vegetable Oil",
        category: "Cooking Essentials",
        description: "Refined vegetable oil for frying, stews, and everyday kitchen use.",
        image_url:
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80",
        tags: ["cooking oil"],
        variants: [
          { variant_name: "1L Bottle", price: 2400, stock_quantity: 24, in_stock: true },
          { variant_name: "3L Bottle", price: 6900, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Dangote Sugar",
        category: "Baking",
        description: "Granulated white sugar for tea, baking, and desserts.",
        image_url:
          "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal"],
        variants: [
          { variant_name: "500g Pack", price: 900, stock_quantity: 27, in_stock: true },
          { variant_name: "1kg Pack", price: 1700, stock_quantity: 19, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Iya Bola Provision Store",
      category: "Supermarket",
      address: "28 Allen Avenue, Ikeja, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.6018,
      longitude: 3.3515,
      phone_number: "+234 801 555 2102",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Reliable provision store for noodles, beverages, dairy products, snacks, and quick convenience shopping.",
      owner: {
        name: "Abiola Adeyemi",
        email: "owner+iya-bola@neara.test",
        phone_number: "+234 801 555 3102",
      },
    },
    products: [
      {
        product_name: "Indomie Chicken Noodles",
        category: "Instant Meals",
        description: "Popular instant noodles for quick breakfasts, hostels, and late-night meals.",
        image_url:
          "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal"],
        variants: [
          { variant_name: "Single Pack", price: 350, stock_quantity: 80, in_stock: true },
          { variant_name: "Carton of 40", price: 12800, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Coca-Cola",
        category: "Beverages",
        description: "Classic cola drink served chilled and ideal for meals or parties.",
        image_url:
          "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=1200&q=80",
        tags: ["soft drink", "drink"],
        variants: [
          { variant_name: "50cl Bottle", price: 500, stock_quantity: 60, in_stock: true },
          { variant_name: "1.5L Bottle", price: 1100, stock_quantity: 24, in_stock: true },
        ],
      },
      {
        product_name: "Fanta Orange",
        category: "Beverages",
        description: "Orange-flavored soft drink for small chops, lunch, and group hangouts.",
        image_url:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80",
        tags: ["soft drink", "drink"],
        variants: [
          { variant_name: "50cl Bottle", price: 500, stock_quantity: 55, in_stock: true },
          { variant_name: "1.5L Bottle", price: 1100, stock_quantity: 22, in_stock: true },
        ],
      },
      {
        product_name: "Maltina",
        category: "Beverages",
        description: "Non-alcoholic malt drink enjoyed chilled at home and at celebrations.",
        image_url:
          "https://images.unsplash.com/photo-1603394630850-69b3ca8121ca?auto=format&fit=crop&w=1200&q=80",
        tags: ["drink"],
        variants: [
          { variant_name: "33cl Can", price: 600, stock_quantity: 48, in_stock: true },
          { variant_name: "Pack of 6", price: 3400, stock_quantity: 14, in_stock: true },
        ],
      },
      {
        product_name: "La Casera Apple",
        category: "Beverages",
        description: "Sparkling apple drink with a crisp sweet finish.",
        image_url:
          "https://images.unsplash.com/photo-1514218953589-2d7d37c5b61c?auto=format&fit=crop&w=1200&q=80",
        tags: ["drink"],
        variants: [
          { variant_name: "35cl Bottle", price: 500, stock_quantity: 42, in_stock: true },
          { variant_name: "Pack of 6", price: 2800, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Peak Yoghurt",
        category: "Dairy",
        description: "Smooth drinking yoghurt for breakfast, school lunch, and afternoon snacks.",
        image_url:
          "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "315g Bottle", price: 900, stock_quantity: 28, in_stock: true },
          { variant_name: "1L Bottle", price: 2200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Sliced Cheddar Cheese",
        category: "Dairy",
        description: "Cheddar cheese slices for sandwiches, burgers, and breakfast toast.",
        image_url:
          "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "200g Pack", price: 3200, stock_quantity: 12, in_stock: true },
          { variant_name: "400g Pack", price: 5900, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Corn Flakes",
        category: "Breakfast",
        description: "Crunchy cereal for quick breakfast bowls with milk or yoghurt.",
        image_url:
          "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal"],
        variants: [
          { variant_name: "500g Box", price: 2100, stock_quantity: 18, in_stock: true },
          { variant_name: "1kg Box", price: 3900, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Cabin Biscuit",
        category: "Snacks",
        description: "Light crispy biscuits for tea breaks, school snacks, and travel packs.",
        image_url:
          "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=80",
        tags: ["snack"],
        variants: [
          { variant_name: "Mini Pack", price: 300, stock_quantity: 50, in_stock: true },
          { variant_name: "Family Pack", price: 950, stock_quantity: 24, in_stock: true },
        ],
      },
      {
        product_name: "Plantain Chips",
        category: "Snacks",
        description: "Crispy sweet-and-salty plantain chips for quick snacking.",
        image_url:
          "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=1200&q=80",
        tags: ["snack"],
        variants: [
          { variant_name: "Small Pack", price: 700, stock_quantity: 34, in_stock: true },
          { variant_name: "Big Pack", price: 1300, stock_quantity: 15, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Lekki Fresh Cuts",
      category: "Frozen Foods",
      address: "6 Fola Osibo Road, Lekki Phase 1, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.4472,
      longitude: 3.4698,
      phone_number: "+234 801 555 2103",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Trusted cold room and protein store with chicken, beef, seafood, and frozen convenience foods.",
      owner: {
        name: "Uche Nwosu",
        email: "owner+lekki-fresh-cuts@neara.test",
        phone_number: "+234 801 555 3103",
      },
    },
    products: [
      {
        product_name: "Chicken Breast",
        category: "Frozen Foods",
        description: "Boneless chicken breast portions for stir-fry, grill, and family meals.",
        image_url:
          "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 6800, stock_quantity: 18, in_stock: true },
          { variant_name: "2kg Pack", price: 13200, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Whole Chicken",
        category: "Frozen Foods",
        description: "Cleaned whole chicken suitable for roast, stew, and oven recipes.",
        image_url:
          "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1.2kg Bird", price: 5200, stock_quantity: 14, in_stock: true },
          { variant_name: "1.8kg Bird", price: 7600, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Turkey Wings",
        category: "Frozen Foods",
        description: "Meaty turkey wings packed for pepper soup, grill, and stew recipes.",
        image_url:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 7200, stock_quantity: 13, in_stock: true },
          { variant_name: "2kg Pack", price: 13900, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Catfish",
        category: "Seafood",
        description: "Freshly frozen catfish ideal for pepper soup and grilled dishes.",
        image_url:
          "https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1 Whole Fish", price: 4300, stock_quantity: 12, in_stock: true },
          { variant_name: "2 Whole Fish", price: 8200, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Prawns",
        category: "Seafood",
        description: "Frozen prawns for pasta, fried rice, and seafood sauces.",
        image_url:
          "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "500g Pack", price: 5400, stock_quantity: 11, in_stock: true },
          { variant_name: "1kg Pack", price: 10200, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Gizzard",
        category: "Frozen Foods",
        description: "Chicken gizzard cleaned and packed for grills, stews, and party chops.",
        image_url:
          "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "500g Pack", price: 2600, stock_quantity: 19, in_stock: true },
          { variant_name: "1kg Pack", price: 4900, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Beef",
        category: "Frozen Foods",
        description: "Fresh beef cuts for stew, soup, and assorted meat packs.",
        image_url:
          "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 6100, stock_quantity: 15, in_stock: true },
          { variant_name: "2kg Pack", price: 11800, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Goat Meat",
        category: "Frozen Foods",
        description: "Cut goat meat portions for nkwobi, pepper soup, and rich soups.",
        image_url:
          "https://images.unsplash.com/photo-1529694157871-4e7c8c971d5a?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 7600, stock_quantity: 12, in_stock: true },
          { variant_name: "2kg Pack", price: 14600, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Turkey Drumsticks",
        category: "Frozen Foods",
        description: "Large turkey drumsticks for oven roast, barbeque, and stew.",
        image_url:
          "https://images.unsplash.com/photo-1528607929212-2636ec44253e?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 7800, stock_quantity: 10, in_stock: true },
          { variant_name: "2kg Pack", price: 14900, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Chicken Lap",
        category: "Frozen Foods",
        description: "Chicken lap portions for grilling, frying, and home catering.",
        image_url:
          "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "1kg Pack", price: 4500, stock_quantity: 20, in_stock: true },
          { variant_name: "2kg Pack", price: 8600, stock_quantity: 9, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Oga Nnamdi Fruit Hub",
      category: "Produce",
      address: "17 Gimbiya Street, Garki, Abuja",
      state: "FCT",
      country: "Nigeria",
      latitude: 9.0446,
      longitude: 7.4914,
      phone_number: "+234 801 555 2104",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1573246123716-6b1782bfc499?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1573246123716-6b1782bfc499?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Fresh fruit and vegetable stand serving homes, offices, and smoothie lovers with daily produce restocks.",
      owner: {
        name: "Nnamdi Eze",
        email: "owner+oga-nnamdi@neara.test",
        phone_number: "+234 801 555 3104",
      },
    },
    products: [
      {
        product_name: "Bananas",
        category: "Fruit",
        description: "Sweet ripe bananas for breakfast, smoothies, and snacks.",
        image_url:
          "https://images.unsplash.com/photo-1574226516831-e1dff420e37f?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Small Bunch", price: 1200, stock_quantity: 25, in_stock: true },
          { variant_name: "Large Bunch", price: 2200, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Watermelon",
        category: "Fruit",
        description: "Juicy watermelon ideal for chilled slices, fruit bowls, and juice.",
        image_url:
          "https://images.unsplash.com/photo-1563114773-84221bd62daa?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Half Melon", price: 1800, stock_quantity: 18, in_stock: true },
          { variant_name: "Whole Melon", price: 3400, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Apples",
        category: "Fruit",
        description: "Crisp apples for lunch packs, desserts, and healthy snacking.",
        image_url:
          "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Pack of 6", price: 2600, stock_quantity: 16, in_stock: true },
          { variant_name: "Pack of 12", price: 5000, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Oranges",
        category: "Fruit",
        description: "Sweet oranges packed for juice, snacking, and school lunch.",
        image_url:
          "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Pack of 8", price: 1400, stock_quantity: 22, in_stock: true },
          { variant_name: "Basket", price: 3800, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Pineapple",
        category: "Fruit",
        description: "Sweet pineapple for smoothies, fruit trays, and fresh juice.",
        image_url:
          "https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Single Fruit", price: 1600, stock_quantity: 20, in_stock: true },
          { variant_name: "Pack of 3", price: 4400, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Avocado Pear",
        category: "Fruit",
        description: "Creamy avocado pears for salads, toast, and smoothie blends.",
        image_url:
          "https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit"],
        variants: [
          { variant_name: "Pack of 4", price: 2200, stock_quantity: 14, in_stock: true },
          { variant_name: "Pack of 8", price: 4200, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Cucumber",
        category: "Vegetables",
        description: "Fresh cucumbers for salads, infused water, and healthy snacks.",
        image_url:
          "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "Pack of 5", price: 1100, stock_quantity: 18, in_stock: true },
          { variant_name: "Pack of 10", price: 2100, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Carrots",
        category: "Vegetables",
        description: "Crunchy carrots for soups, fried rice, and salads.",
        image_url:
          "https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "500g Pack", price: 900, stock_quantity: 24, in_stock: true },
          { variant_name: "1kg Pack", price: 1700, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Bell Peppers",
        category: "Vegetables",
        description: "Mixed bell peppers for stir fry, jollof base, and salads.",
        image_url:
          "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "500g Mix", price: 1800, stock_quantity: 17, in_stock: true },
          { variant_name: "1kg Mix", price: 3400, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Irish Potatoes",
        category: "Vegetables",
        description: "Clean Irish potatoes for fries, porridge, and oven recipes.",
        image_url:
          "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1200&q=80",
        tags: ["vegetable"],
        variants: [
          { variant_name: "1kg Bag", price: 1500, stock_quantity: 19, in_stock: true },
          { variant_name: "3kg Bag", price: 4200, stock_quantity: 9, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Amaka Home Kitchen",
      category: "Deli",
      address: "42 Aminu Kano Crescent, Wuse 2, Abuja",
      state: "FCT",
      country: "Nigeria",
      latitude: 9.0793,
      longitude: 7.466,
      phone_number: "+234 801 555 2105",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1464454709131-ffd692591ee5?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Premium deli and kitchen supply store with breakfast items, cheese, condiments, and ready-to-cook staples.",
      owner: {
        name: "Amaka Obi",
        email: "owner+amaka-home-kitchen@neara.test",
        phone_number: "+234 801 555 3105",
      },
    },
    products: [
      {
        product_name: "Cheddar Cheese Block",
        category: "Dairy",
        description: "Rich cheddar block for sandwiches, burgers, and baked dishes.",
        image_url:
          "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "250g Block", price: 3600, stock_quantity: 14, in_stock: true },
          { variant_name: "500g Block", price: 6900, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Salted Butter",
        category: "Dairy",
        description: "Creamy butter for toast, baking, and pan-frying.",
        image_url:
          "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "250g Tub", price: 2500, stock_quantity: 18, in_stock: true },
          { variant_name: "500g Tub", price: 4700, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Fresh Milk",
        category: "Dairy",
        description: "Chilled milk for cereals, tea, coffee, and smoothies.",
        image_url:
          "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=1200&q=80",
        tags: ["dairy"],
        variants: [
          { variant_name: "1L Bottle", price: 1900, stock_quantity: 16, in_stock: true },
          { variant_name: "2L Bottle", price: 3600, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Brown Bread",
        category: "Bakery",
        description: "Fresh brown bread loaf for healthy sandwiches and toast.",
        image_url:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
        tags: ["bread"],
        variants: [
          { variant_name: "Regular Loaf", price: 1300, stock_quantity: 20, in_stock: true },
          { variant_name: "Family Loaf", price: 1800, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "Croissant",
        category: "Bakery",
        description: "Buttery flaky croissant for breakfast trays and coffee runs.",
        image_url:
          "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80",
        tags: ["bread"],
        variants: [
          { variant_name: "Single", price: 1200, stock_quantity: 24, in_stock: true },
          { variant_name: "Pack of 4", price: 4400, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Breakfast Sausages",
        category: "Frozen Foods",
        description: "Juicy breakfast sausages for brunch, pasta, and quick pan-fry meals.",
        image_url:
          "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=80",
        tags: ["frozen food"],
        variants: [
          { variant_name: "500g Pack", price: 3900, stock_quantity: 13, in_stock: true },
          { variant_name: "1kg Pack", price: 7400, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Corned Beef",
        category: "Canned Goods",
        description: "Seasoned canned beef for sandwiches, pasta, and breakfast meals.",
        image_url:
          "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1200&q=80",
        tags: ["snack"],
        variants: [
          { variant_name: "200g Tin", price: 2800, stock_quantity: 19, in_stock: true },
          { variant_name: "340g Tin", price: 4300, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Mayonnaise",
        category: "Condiments",
        description: "Creamy mayonnaise for sandwiches, salads, and burger dressing.",
        image_url:
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80",
        tags: ["snack"],
        variants: [
          { variant_name: "250ml Jar", price: 1500, stock_quantity: 21, in_stock: true },
          { variant_name: "500ml Jar", price: 2700, stock_quantity: 11, in_stock: true },
        ],
      },
      {
        product_name: "Baked Beans",
        category: "Canned Goods",
        description: "Tomato baked beans for breakfast plates and quick toast toppings.",
        image_url:
          "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal"],
        variants: [
          { variant_name: "420g Can", price: 1800, stock_quantity: 18, in_stock: true },
          { variant_name: "2 Cans Bundle", price: 3400, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Strawberry Jam",
        category: "Spreads",
        description: "Fruit jam for bread, pancakes, pastries, and breakfast trays.",
        image_url:
          "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80",
        tags: ["snack"],
        variants: [
          { variant_name: "250g Jar", price: 1900, stock_quantity: 17, in_stock: true },
          { variant_name: "500g Jar", price: 3500, stock_quantity: 8, in_stock: true },
        ],
      },
    ],
  },
];

function normalizeHeaderImages(headerImages, fallbackImageUrl = null) {
  const list = Array.isArray(headerImages) ? headerImages : [];
  const normalized = list
    .map((item) => (typeof item === "string" && item.trim() ? item.trim() : null))
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  return typeof fallbackImageUrl === "string" && fallbackImageUrl.trim()
    ? [fallbackImageUrl.trim()]
    : [];
}

function buildOwnerRoles(premiumStatus, isOwner) {
  return [
    "user",
    ...(premiumStatus ? ["pro"] : []),
    ...(isOwner ? ["store_owner"] : []),
  ];
}

async function ensureUser(client, user, options = {}) {
  const premiumStatus = Boolean(options.premiumStatus);
  const isOwner = Boolean(options.isOwner);
  const nextRoles = buildOwnerRoles(premiumStatus, isOwner);
  const passwordHash = await bcrypt.hash(options.password || DEFAULT_PASSWORD, PASSWORD_HASH_ROUNDS);

  const existing = await client.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [user.email],
  );

  if (existing.rows[0]) {
    const { rows } = await client.query(
      `
        UPDATE users
        SET
          name = $2,
          password_hash = $3,
          phone_number = $4,
          premium_status = $5,
          roles = $6
        WHERE id = $1
        RETURNING id, name, email
      `,
      [
        existing.rows[0].id,
        user.name,
        passwordHash,
        user.phone_number || null,
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
      RETURNING id, name, email
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
  const existing = await client.query(
    `
      SELECT id
      FROM stores
      WHERE LOWER(store_name) = LOWER($1)
      LIMIT 1
    `,
    [storeData.store_name],
  );

  const headerImages = normalizeHeaderImages(storeData.header_images, storeData.image_url);

  if (existing.rows[0]) {
    const { rows } = await client.query(
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
        existing.rows[0].id,
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

    return { id: rows[0].id, created: false };
  }

  const { rows } = await client.query(
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

  return { id: rows[0].id, created: true };
}

async function ensureProduct(client, storeId, product) {
  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE store_id = $1
        AND LOWER(product_name) = LOWER($2)
      LIMIT 1
    `,
    [storeId, product.product_name],
  );

  if (existing.rows[0]) {
    const { rows } = await client.query(
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

    return { id: rows[0].id, created: false };
  }

  const { rows } = await client.query(
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

  return { id: rows[0].id, created: true };
}

async function ensureVariants(client, productId, variants) {
  let createdCount = 0;

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

    createdCount += 1;
  }

  return createdCount;
}

async function countRows(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return rows[0].count;
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log("🌱 Seeding Neara backend sample data...");
    await ensureSchema();
    await client.query("BEGIN");
    await purgeManagedSeedStores(client);

    let createdStores = 0;
    let createdProducts = 0;
    let createdVariants = 0;

    for (const blueprint of STORE_BLUEPRINTS) {
      const owner = await ensureUser(client, blueprint.store.owner, {
        isOwner: true,
        premiumStatus: Boolean(blueprint.store.verified),
      });

      const storeResult = await ensureStore(client, blueprint.store, owner.id);
      if (storeResult.created) {
        createdStores += 1;
      }

      for (const product of blueprint.products) {
        const productResult = await ensureProduct(client, storeResult.id, product);
        if (productResult.created) {
          createdProducts += 1;
        }

        createdVariants += await ensureVariants(client, productResult.id, product.variants);
      }
    }

    await client.query("COMMIT");

    const totals = {
      stores: await countRows(client, "stores"),
      products: await countRows(client, "products"),
      variants: await countRows(client, "product_variants"),
      users: await countRows(client, "users"),
    };

    console.log("✅ Neara backend sample data ready", {
      createdProducts,
      createdStores,
      createdVariants,
      defaultOwnerPassword: DEFAULT_PASSWORD,
      totalConfiguredProducts: STORE_BLUEPRINTS.reduce(
        (sum, blueprint) => sum + blueprint.products.length,
        0,
      ),
      totalConfiguredStores: STORE_BLUEPRINTS.length,
      totals,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
