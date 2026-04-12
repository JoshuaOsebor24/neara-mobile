const MANAGED_SEED_OWNER_EMAIL_PATTERN = "owner+%@neara.test";

const DEMO_STORE_IMAGES = {
  bread: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Bread%20loaf.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Loaf%20of%20bread..jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Loaf%20Of%20Bread.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Loaf%20of%20bread.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Sourdough%20Bread%20Loaf.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Photograph%20of%20Bread.jpg",
  ],
  charger: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/USB-C.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/USB-cable.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Cable%20USB.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/USB%20cable.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/USB%20Type%20C.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/USB-C%20cable%20connected%20to%20a%20powerbank.jpg",
  ],
  coke: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20bottle.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20Bottle.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20bottles.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20bottle%20%286699404437%29.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20bottles%20%282%29.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Coca%20Cola%20bottles.JPG",
  ],
  indomie: [
    "https://indomieca.com/wp-content/uploads/2020/06/Chicken-Flavour-300x214.png",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Instant%20noodles.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Instant_Noodles.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Instantnoodles.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Typical%20instant%20noodles.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Hot%20Instant%20Noodles.jpg",
  ],
  storefront:
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
  paracetamol: [
    "https://commons.wikimedia.org/wiki/Special:FilePath/Panadol.JPG",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Panadol.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Yef%20paracetamol.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/M%26B%20paracetamol.jpg",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Medication%20Paracetamol.JPG",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Acetaminophen%20%28cropped%29.jpg",
  ],
};

function pickDemoImage(type, index) {
  const list = DEMO_STORE_IMAGES[type];
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  return list[index % list.length];
}

function buildStapleProducts(prices, imageIndex) {
  return [
    {
      product_name: "Indomie Instant Noodles",
      category: "Groceries",
      description: "Quick family noodle packs for breakfast, supper, and easy restocks.",
      image_url: pickDemoImage("indomie", imageIndex),
      tags: ["indomie", "noodles", "groceries"],
      variants: [
        {
          variant_name: "Super Pack",
          price: prices.indomie,
          stock_quantity: prices.indomieStock ?? 24,
          in_stock: prices.indomieInStock ?? true,
        },
        {
          variant_name: "Hungry Man Pack",
          price: prices.indomieLarge ?? prices.indomie + 180,
          stock_quantity: prices.indomieLargeStock ?? 16,
          in_stock: prices.indomieLargeInStock ?? true,
        },
      ],
    },
    {
      product_name: "Coca-Cola",
      category: "Drinks",
      description: "Chilled soft drink bottles for quick refreshment and party supplies.",
      image_url: pickDemoImage("coke", imageIndex),
      tags: ["coke", "soft drink", "drinks"],
      variants: [
        {
          variant_name: "50cl Bottle",
          price: prices.coke,
          stock_quantity: prices.cokeStock ?? 20,
          in_stock: prices.cokeInStock ?? true,
        },
        {
          variant_name: "1.5L Bottle",
          price: prices.cokeLarge ?? prices.coke + 550,
          stock_quantity: prices.cokeLargeStock ?? 12,
          in_stock: prices.cokeLargeInStock ?? true,
        },
      ],
    },
    {
      product_name: "Paracetamol Tablets",
      category: "Pharmacy",
      description: "Everyday pain relief tablets for headaches, fever, and body aches.",
      image_url: pickDemoImage("paracetamol", imageIndex),
      tags: ["paracetamol", "pain relief", "pharmacy"],
      variants: [
        {
          variant_name: "1 Sachet",
          price: prices.paracetamol,
          stock_quantity: prices.paracetamolStock ?? 30,
          in_stock: prices.paracetamolInStock ?? true,
        },
        {
          variant_name: "10 Tablet Card",
          price: prices.paracetamolCard ?? prices.paracetamol + 650,
          stock_quantity: prices.paracetamolCardStock ?? 18,
          in_stock: prices.paracetamolCardInStock ?? true,
        },
      ],
    },
    {
      product_name: "Sliced Bread",
      category: "Bakery",
      description: "Soft fresh bread loaves for breakfast, toast, and quick sandwiches.",
      image_url: pickDemoImage("bread", imageIndex),
      tags: ["bread", "bakery", "breakfast"],
      variants: [
        {
          variant_name: "Medium Loaf",
          price: prices.bread,
          stock_quantity: prices.breadStock ?? 14,
          in_stock: prices.breadInStock ?? true,
        },
        {
          variant_name: "Large Loaf",
          price: prices.breadLarge ?? prices.bread + 300,
          stock_quantity: prices.breadLargeStock ?? 10,
          in_stock: prices.breadLargeInStock ?? true,
        },
      ],
    },
    {
      product_name: "Phone Charger",
      category: "Electronics",
      description: "Fast everyday charger for quick top-ups at home, work, or in transit.",
      image_url: pickDemoImage("charger", imageIndex),
      tags: ["phone charger", "charger", "electronics"],
      variants: [
        {
          variant_name: "USB Charger",
          price: prices.phoneCharger,
          stock_quantity: prices.phoneChargerStock ?? 10,
          in_stock: prices.phoneChargerInStock ?? true,
        },
        {
          variant_name: "Type-C Fast Charger",
          price: prices.phoneChargerFast ?? prices.phoneCharger + 1200,
          stock_quantity: prices.phoneChargerFastStock ?? 8,
          in_stock: prices.phoneChargerFastInStock ?? true,
        },
      ],
    },
  ];
}

function buildDemoStore({
  address,
  description,
  emailSlug,
  latitude,
  longitude,
  ownerName,
  phoneNumber,
  prices,
  productImageIndex,
  storeName,
}) {
  return {
    store: {
      store_name: storeName,
      category: "Convenience Store",
      address,
      state: "Lagos",
      country: "Nigeria",
      latitude,
      longitude,
      phone_number: phoneNumber,
      verified: true,
      subscription_tier: 1,
      image_url: DEMO_STORE_IMAGES.storefront,
      header_images: [DEMO_STORE_IMAGES.storefront],
      description,
      owner: {
        name: ownerName,
        email: `owner+${emailSlug}@neara.test`,
        phone_number: phoneNumber.replace(" 41", " 51"),
      },
    },
    products: buildStapleProducts(prices, productImageIndex),
  };
}

const CURRENT_AREA_DEMO_STORES = [
  buildDemoStore({
    storeName: "Mama T Store",
    emailSlug: "mama-t-store",
    ownerName: "Temitope Hassan",
    productImageIndex: 0,
    address: "8 Udi Street, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44850,
    longitude: 3.43454,
    phoneNumber: "+234 801 555 4181",
    description:
      "Friendly neighborhood provisions shop for fast daily essentials, cold drinks, noodles, and quick medicine pickups.",
    prices: {
      indomie: 520,
      indomieLarge: 700,
      coke: 450,
      cokeLarge: 980,
      paracetamol: 300,
      paracetamolCard: 900,
      bread: 1400,
      breadLarge: 1700,
      phoneCharger: 4200,
      phoneChargerFast: 5400,
    },
  }),
  buildDemoStore({
    storeName: "Lekki Mini Mart",
    emailSlug: "lekki-mini-mart",
    ownerName: "Lekan Afolabi",
    productImageIndex: 1,
    address: "15 Royal Palm Drive, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44836,
    longitude: 3.43486,
    phoneNumber: "+234 801 555 4182",
    description:
      "Compact mini mart stocked for quick home restocks, late-night drinks, pain relief, and phone accessories.",
    prices: {
      indomie: 560,
      indomieLarge: 760,
      coke: 500,
      cokeLarge: 1050,
      paracetamol: 350,
      paracetamolCard: 980,
      bread: 1500,
      breadLarge: 1800,
      phoneCharger: 4500,
      phoneChargerFast: 5900,
    },
  }),
  buildDemoStore({
    storeName: "QuickBuy Supermarket",
    emailSlug: "quickbuy-supermarket",
    ownerName: "Kemi Ojo",
    productImageIndex: 2,
    address: "21 Osborne Road, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44867,
    longitude: 3.43431,
    phoneNumber: "+234 801 555 4183",
    description:
      "Reliable supermarket for pantry staples, family groceries, basic medication, and quick convenience buys.",
    prices: {
      indomie: 600,
      indomieLarge: 820,
      coke: 500,
      cokeLarge: 1080,
      paracetamol: 400,
      paracetamolCard: 1100,
      bread: 1600,
      breadLarge: 1900,
      phoneCharger: 4800,
      phoneChargerFast: 6200,
    },
  }),
  buildDemoStore({
    storeName: "Jide Provision Store",
    emailSlug: "jide-provision-store",
    ownerName: "Jide Oladipo",
    productImageIndex: 3,
    address: "3 Frajend Close, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44822,
    longitude: 3.43458,
    phoneNumber: "+234 801 555 4184",
    description:
      "Busy corner shop for affordable provisions, school-run snacks, pain relief, and top-up chargers.",
    prices: {
      indomie: 540,
      indomieLarge: 730,
      coke: 430,
      cokeLarge: 920,
      paracetamol: 250,
      paracetamolCard: 820,
      bread: 1350,
      breadLarge: 1650,
      phoneCharger: 3900,
      phoneChargerFast: 5200,
    },
  }),
  buildDemoStore({
    storeName: "24/7 Mart Lekki",
    emailSlug: "247-mart-lekki",
    ownerName: "Opeyemi Daniels",
    productImageIndex: 4,
    address: "6 Kebbi Street, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44874,
    longitude: 3.43493,
    phoneNumber: "+234 801 555 4185",
    description:
      "Always-open convenience stop for night purchases, chilled drinks, emergency medicine, and quick food staples.",
    prices: {
      indomie: 650,
      indomieLarge: 870,
      coke: 550,
      cokeLarge: 1200,
      paracetamol: 450,
      paracetamolCard: 1180,
      bread: 1700,
      breadLarge: 2050,
      phoneCharger: 5200,
      phoneChargerFast: 6700,
    },
  }),
  buildDemoStore({
    storeName: "Aunty Bisi Corner Shop",
    emailSlug: "aunty-bisi-corner-shop",
    ownerName: "Bisi Akinwale",
    productImageIndex: 5,
    address: "10 12th Street, Osborne Foreshore Estate, Ikoyi, Lagos",
    latitude: 6.44863,
    longitude: 3.43518,
    phoneNumber: "+234 801 555 4186",
    description:
      "Popular corner shop for family essentials, affordable noodles, fresh bread, and grab-and-go household needs.",
    prices: {
      indomie: 530,
      indomieLarge: 720,
      coke: 470,
      cokeLarge: 1000,
      paracetamol: 300,
      paracetamolCard: 920,
      bread: 1450,
      breadLarge: 1750,
      phoneCharger: 4100,
      phoneChargerFast: 5500,
    },
  }),
];

const PREMIUM_DEMO_STORE = {
  store: {
    store_name: "Blue Harbour Market",
    category: "Convenience Store",
    address: "18 Admiralty Way, Lekki Phase 1, Lagos",
    state: "Lagos",
    country: "Nigeria",
    latitude: 6.43178,
    longitude: 3.45583,
    phone_number: "+234 801 555 4199",
    delivery_available: true,
    verified: true,
    subscription_tier: 3,
    image_url:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    header_images: [
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=1600&q=80",
    ],
    description:
      "Premium neighborhood market curated for fast daily shopping, chilled drinks, snack runs, pantry restocks, and polished same-day convenience in Lekki.",
    owner: {
      name: "Zainab Kareem",
      email: "owner+blue-harbour-market@neara.test",
      phone_number: "+234 801 555 5199",
    },
  },
  products: [
    {
      product_name: "Coca-Cola Classic",
      category: "Drinks",
      description: "Ice-cold Coca-Cola for quick refreshment, lunches, and party packs.",
      image_url:
        "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "cold", "soft drink", "soda", "essentials"],
      variants: [
        { variant_name: "50cl Bottle", price: 500, stock_quantity: 40, in_stock: true },
        { variant_name: "1.5L Bottle", price: 1100, stock_quantity: 20, in_stock: true },
        { variant_name: "Pack of 6", price: 2950, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Fanta Orange",
      category: "Drinks",
      description: "Bright orange soda served chilled for grab-and-go refreshment.",
      image_url:
        "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "orange", "cold", "soft drink", "soda"],
      variants: [
        { variant_name: "50cl Bottle", price: 500, stock_quantity: 34, in_stock: true },
        { variant_name: "1L Bottle", price: 900, stock_quantity: 18, in_stock: true },
      ],
    },
    {
      product_name: "Aquafina Water",
      category: "Drinks",
      description: "Clean bottled water for hydration at home, work, and on the move.",
      image_url:
        "https://images.unsplash.com/photo-1564419439260-094b1b7a2712?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "cold", "water", "essentials"],
      variants: [
        { variant_name: "75cl Bottle", price: 350, stock_quantity: 50, in_stock: true },
        { variant_name: "Pack of 12", price: 3600, stock_quantity: 12, in_stock: true },
      ],
    },
    {
      product_name: "Five Alive Citrus Burst",
      category: "Drinks",
      description: "Chilled fruit drink with a bright citrus finish for quick energy.",
      image_url:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "juice", "cold", "fruit"],
      variants: [
        { variant_name: "35cl PET", price: 600, stock_quantity: 28, in_stock: true },
        { variant_name: "1L Bottle", price: 1250, stock_quantity: 16, in_stock: true },
      ],
    },
    {
      product_name: "Monster Energy",
      category: "Drinks",
      description: "Popular energy drink for busy mornings, workouts, and long drives.",
      image_url:
        "https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "cold", "energy", "essentials"],
      variants: [
        { variant_name: "500ml Can", price: 1450, stock_quantity: 24, in_stock: true },
      ],
    },
    {
      product_name: "Chivita Orange Juice",
      category: "Drinks",
      description: "Smooth orange juice carton for breakfast tables and family fridges.",
      image_url:
        "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1200&q=80",
      tags: ["drinks", "juice", "orange", "breakfast"],
      variants: [
        { variant_name: "1L Carton", price: 2200, stock_quantity: 18, in_stock: true },
        { variant_name: "Pack of 6", price: 12600, stock_quantity: 6, in_stock: true },
      ],
    },
    {
      product_name: "Pringles Sour Cream & Onion",
      category: "Snacks",
      description: "Crisp stacked chips for movie nights, office desks, and snack baskets.",
      image_url:
        "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=1200&q=80",
      tags: ["snacks", "crisps", "snack", "essentials"],
      variants: [
        { variant_name: "Single Tube", price: 2400, stock_quantity: 20, in_stock: true },
        { variant_name: "Pack of 3", price: 6900, stock_quantity: 8, in_stock: true },
      ],
    },
    {
      product_name: "Biscuit Assorted Pack",
      category: "Snacks",
      description: "Crunchy tea biscuits packed for desks, school runs, and home guests.",
      image_url:
        "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=80",
      tags: ["snacks", "biscuit", "breakfast", "essentials"],
      variants: [
        { variant_name: "200g Pack", price: 950, stock_quantity: 26, in_stock: true },
        { variant_name: "Family Pack", price: 2400, stock_quantity: 14, in_stock: true },
      ],
    },
    {
      product_name: "Salted Plantain Chips",
      category: "Snacks",
      description: "Lightly salted crunchy plantain chips for easy everyday snacking.",
      image_url:
        "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=1200&q=80",
      tags: ["snacks", "plantain", "snack", "local favorites"],
      variants: [
        { variant_name: "120g Bag", price: 1400, stock_quantity: 24, in_stock: true },
      ],
    },
    {
      product_name: "Cadbury Dairy Milk",
      category: "Snacks",
      description: "Smooth milk chocolate bar for quick treats and gift add-ons.",
      image_url:
        "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=1200&q=80",
      tags: ["snacks", "chocolate", "dessert"],
      variants: [
        { variant_name: "Single Bar", price: 1200, stock_quantity: 30, in_stock: true },
        { variant_name: "Pack of 5", price: 5600, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Golden Penny Spaghetti",
      category: "Grocery",
      description: "Reliable spaghetti packs for quick dinners and pantry restocks.",
      image_url:
        "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "essentials", "pasta", "pantry"],
      variants: [
        { variant_name: "500g Pack", price: 950, stock_quantity: 32, in_stock: true },
        { variant_name: "Pack of 10", price: 8900, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Indomie Chicken Noodles",
      category: "Grocery",
      description: "Popular instant noodles for easy breakfasts, late dinners, and bulk buys.",
      image_url:
        "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "essentials", "noodles", "quick meals"],
      variants: [
        { variant_name: "Super Pack", price: 550, stock_quantity: 40, in_stock: true },
        { variant_name: "Hungry Man", price: 750, stock_quantity: 24, in_stock: true },
        { variant_name: "Carton of 40", price: 20500, stock_quantity: 6, in_stock: true },
      ],
    },
    {
      product_name: "Mama's Pride Rice",
      category: "Grocery",
      description: "Clean long-grain rice suitable for family cooking and weekly restocks.",
      image_url:
        "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "rice", "essentials", "pantry"],
      variants: [
        { variant_name: "1kg Bag", price: 2300, stock_quantity: 18, in_stock: true },
        { variant_name: "5kg Bag", price: 11000, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Honeywell Wheat Meal",
      category: "Grocery",
      description: "Smooth wheat meal staple for swallows and family lunch prep.",
      image_url:
        "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "essentials", "pantry", "family"],
      variants: [
        { variant_name: "1kg Bag", price: 1800, stock_quantity: 18, in_stock: true },
        { variant_name: "2kg Bag", price: 3400, stock_quantity: 12, in_stock: true },
      ],
    },
    {
      product_name: "Peak Full Cream Milk",
      category: "Dairy",
      description: "Rich powdered milk for cereals, tea, and family breakfast routines.",
      image_url:
        "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1200&q=80",
      tags: ["dairy", "breakfast", "essentials", "milk"],
      variants: [
        { variant_name: "400g Tin", price: 4200, stock_quantity: 14, in_stock: true },
        { variant_name: "900g Tin", price: 8900, stock_quantity: 8, in_stock: true },
      ],
    },
    {
      product_name: "Farm Fresh Eggs",
      category: "Dairy",
      description: "Fresh eggs delivered daily for breakfast, baking, and home cooking.",
      image_url:
        "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=1200&q=80",
      tags: ["dairy", "breakfast", "essentials", "fresh"],
      variants: [
        { variant_name: "Half Crate", price: 3800, stock_quantity: 18, in_stock: true },
        { variant_name: "Full Crate", price: 7200, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Freshly Baked Sourdough",
      category: "Bakery",
      description: "Artisan-style loaf with crisp crust and soft interior for premium breakfasts.",
      image_url:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
      tags: ["bakery", "bread", "fresh", "breakfast"],
      variants: [
        { variant_name: "Large Loaf", price: 3200, stock_quantity: 14, in_stock: true },
      ],
    },
    {
      product_name: "Butter Croissant",
      category: "Bakery",
      description: "Flaky butter croissant baked fresh for premium breakfast and coffee runs.",
      image_url:
        "https://images.unsplash.com/photo-1555507036-ab794f4afe5d?auto=format&fit=crop&w=1200&q=80",
      tags: ["bakery", "breakfast", "snack", "fresh"],
      variants: [
        { variant_name: "Single", price: 1800, stock_quantity: 20, in_stock: true },
        { variant_name: "Box of 4", price: 6600, stock_quantity: 8, in_stock: true },
      ],
    },
    {
      product_name: "Banana Bunch",
      category: "Produce",
      description: "Fresh sweet bananas for breakfast, smoothies, and healthy snack trays.",
      image_url:
        "https://images.unsplash.com/photo-1574226516831-e1dff420e37f?auto=format&fit=crop&w=1200&q=80",
      tags: ["produce", "fruit", "fresh", "essentials"],
      variants: [
        { variant_name: "Small Bunch", price: 1800, stock_quantity: 20, in_stock: true },
        { variant_name: "Large Bunch", price: 2600, stock_quantity: 12, in_stock: true },
      ],
    },
    {
      product_name: "Avocado Pear",
      category: "Produce",
      description: "Creamy ripe avocados for salads, toast, and smoothie bowls.",
      image_url:
        "https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?auto=format&fit=crop&w=1200&q=80",
      tags: ["produce", "fruit", "fresh", "healthy"],
      variants: [
        { variant_name: "Single", price: 1200, stock_quantity: 24, in_stock: true },
        { variant_name: "Pack of 4", price: 4300, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Tomato Mix Pack",
      category: "Produce",
      description: "Bright tomatoes blended for sauces, stews, and quick home cooking.",
      image_url:
        "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=1200&q=80",
      tags: ["produce", "vegetable", "fresh", "essentials"],
      variants: [
        { variant_name: "500g Pack", price: 1600, stock_quantity: 20, in_stock: true },
        { variant_name: "1kg Pack", price: 2900, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Kellogg's Corn Flakes",
      category: "Grocery",
      description: "Classic breakfast cereal for quick weekday mornings and family tables.",
      image_url:
        "https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "breakfast", "essentials", "cereal"],
      variants: [
        { variant_name: "300g Box", price: 2900, stock_quantity: 16, in_stock: true },
        { variant_name: "750g Box", price: 6100, stock_quantity: 8, in_stock: true },
      ],
    },
    {
      product_name: "Heinz Baked Beans",
      category: "Grocery",
      description: "Quick protein-rich pantry staple for breakfast and easy meals.",
      image_url:
        "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "essentials", "pantry", "breakfast"],
      variants: [
        { variant_name: "415g Tin", price: 1850, stock_quantity: 20, in_stock: true },
        { variant_name: "Pack of 4", price: 7000, stock_quantity: 8, in_stock: true },
      ],
    },
    {
      product_name: "Dettol Antiseptic Liquid",
      category: "Essentials",
      description: "Trusted household antiseptic for cleaning, hygiene, and first-aid support.",
      image_url:
        "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=1200&q=80",
      tags: ["essentials", "cleaning", "toiletries", "family"],
      variants: [
        { variant_name: "250ml Bottle", price: 2200, stock_quantity: 18, in_stock: true },
        { variant_name: "750ml Bottle", price: 4900, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Colgate Triple Action",
      category: "Essentials",
      description: "Everyday toothpaste for family oral care and travel bags.",
      image_url:
        "https://images.unsplash.com/photo-1559591937-abc3c517e5bd?auto=format&fit=crop&w=1200&q=80",
      tags: ["essentials", "toiletries", "beauty", "family"],
      variants: [
        { variant_name: "140g Tube", price: 1650, stock_quantity: 22, in_stock: true },
        { variant_name: "Pack of 3", price: 4700, stock_quantity: 10, in_stock: true },
      ],
    },
    {
      product_name: "Milo Refill Pack",
      category: "Grocery",
      description: "Chocolate malt drink refill for breakfast mugs and school lunches.",
      image_url:
        "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=1200&q=80",
      tags: ["groceries", "breakfast", "drink", "family"],
      variants: [
        { variant_name: "400g Refill", price: 3400, stock_quantity: 16, in_stock: true },
        { variant_name: "800g Refill", price: 6200, stock_quantity: 8, in_stock: true },
      ],
    },
  ],
};

const STORE_BLUEPRINTS = [
  PREMIUM_DEMO_STORE,
  {
    store: {
      store_name: "Osborne Fresh Market",
      category: "Grocery",
      address: "12 Osborne Road, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44892,
      longitude: 3.43261,
      phone_number: "+234 801 555 4101",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Neighborhood grocery for premium pantry staples, fruit bowls, breakfast essentials, and fast restocks around Osborne.",
      owner: {
        name: "Amaka Dike",
        email: "owner+osborne-fresh-market@neara.test",
        phone_number: "+234 801 555 5101",
      },
    },
    products: [
      {
        product_name: "Imported Seedless Grapes",
        category: "Produce",
        description: "Sweet chilled grapes packed for quick home snacking and fruit platters.",
        image_url:
          "https://images.unsplash.com/photo-1515778767554-6b1f8c6d5f95?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit", "produce", "grapes"],
        variants: [
          { variant_name: "500g Punnet", price: 5400, stock_quantity: 18, in_stock: true },
          { variant_name: "1kg Punnet", price: 10200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Farm Fresh Eggs",
        category: "Dairy",
        description: "Fresh eggs supplied daily for breakfast, baking, and family cooking.",
        image_url:
          "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=1200&q=80",
        tags: ["eggs", "dairy"],
        variants: [
          { variant_name: "Half Crate", price: 3600, stock_quantity: 20, in_stock: true },
          { variant_name: "Full Crate", price: 6900, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Freshly Baked Sourdough",
        category: "Bakery",
        description: "Daily sourdough loaf with a crisp crust and soft center.",
        image_url:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
        tags: ["bread", "bakery"],
        variants: [{ variant_name: "Large Loaf", price: 3200, stock_quantity: 14, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Lagoon Bakery House",
      category: "Bakery",
      address: "4 Udi Street, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44974,
      longitude: 3.43492,
      phone_number: "+234 801 555 4102",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Modern neighborhood bakery serving pastries, celebration cakes, breakfast buns, and flaky savory snacks.",
      owner: {
        name: "Tola Adebayo",
        email: "owner+lagoon-bakery-house@neara.test",
        phone_number: "+234 801 555 5102",
      },
    },
    products: [
      {
        product_name: "Butter Croissant",
        category: "Pastries",
        description: "Layered butter croissant baked fresh every morning.",
        image_url:
          "https://images.unsplash.com/photo-1555507036-ab794f4afe5d?auto=format&fit=crop&w=1200&q=80",
        tags: ["croissant", "pastry", "breakfast"],
        variants: [
          { variant_name: "Single", price: 1600, stock_quantity: 22, in_stock: true },
          { variant_name: "Box of 4", price: 5900, stock_quantity: 9, in_stock: true },
        ],
      },
      {
        product_name: "Chicken Pie",
        category: "Savory Snacks",
        description: "Buttery pastry filled with chicken, vegetables, and mild spice.",
        image_url:
          "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80",
        tags: ["pie", "snack"],
        variants: [
          { variant_name: "Single", price: 1900, stock_quantity: 24, in_stock: true },
          { variant_name: "Pack of 4", price: 7200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Red Velvet Celebration Cake",
        category: "Cakes",
        description: "Moist red velvet cake finished with cream cheese frosting.",
        image_url:
          "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=1200&q=80",
        tags: ["cake", "dessert"],
        variants: [
          { variant_name: "6-inch", price: 18000, stock_quantity: 5, in_stock: true },
          { variant_name: "8-inch", price: 26500, stock_quantity: 3, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Ikoyi Green Pharmacy",
      category: "Pharmacy",
      address: "19 Royal Palm Drive, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44758,
      longitude: 3.43121,
      phone_number: "+234 801 555 4103",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Community pharmacy with wellness products, over-the-counter care, and convenient daily health essentials.",
      owner: {
        name: "Boma Nwosu",
        email: "owner+ikoyi-green-pharmacy@neara.test",
        phone_number: "+234 801 555 5103",
      },
    },
    products: [
      {
        product_name: "Vitamin C Tablets",
        category: "Supplements",
        description: "Daily vitamin C tablets for immune support and routine wellness.",
        image_url:
          "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=1200&q=80",
        tags: ["pharmacy", "supplements", "vitamin c"],
        variants: [
          { variant_name: "100 Tablets", price: 4500, stock_quantity: 16, in_stock: true },
        ],
      },
      {
        product_name: "Digital Thermometer",
        category: "Health Devices",
        description: "Easy-read digital thermometer for quick home temperature checks.",
        image_url:
          "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80",
        tags: ["health", "thermometer"],
        variants: [{ variant_name: "Single Unit", price: 7200, stock_quantity: 10, in_stock: true }],
      },
      {
        product_name: "First Aid Kit",
        category: "Health Essentials",
        description: "Compact household first aid kit for cuts, scrapes, and everyday emergencies.",
        image_url:
          "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=1200&q=80",
        tags: ["first aid", "health"],
        variants: [{ variant_name: "Home Kit", price: 9500, stock_quantity: 8, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Salt & Palm Kitchen",
      category: "Restaurant",
      address: "7 Salt Lagos Close, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.45068,
      longitude: 3.43617,
      phone_number: "+234 801 555 4104",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Casual kitchen serving jollof, grilled proteins, soups, and quick lunch trays for Osborne residents.",
      owner: {
        name: "Segun Balogun",
        email: "owner+salt-palm-kitchen@neara.test",
        phone_number: "+234 801 555 5104",
      },
    },
    products: [
      {
        product_name: "Smoky Jollof Rice Tray",
        category: "Meals",
        description: "Party-style jollof rice served with grilled chicken and plantain.",
        image_url:
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80",
        tags: ["food", "jollof", "meal"],
        variants: [
          { variant_name: "Regular", price: 6500, stock_quantity: 18, in_stock: true },
          { variant_name: "Large", price: 9200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Peppered Grilled Catfish",
        category: "Meals",
        description: "Whole catfish grilled with pepper sauce and onions.",
        image_url:
          "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80",
        tags: ["catfish", "grill"],
        variants: [{ variant_name: "Single", price: 13800, stock_quantity: 8, in_stock: true }],
      },
      {
        product_name: "Ofada Sauce Pack",
        category: "Ready Meals",
        description: "Hot ayamase sauce packed for home lunch and dinner service.",
        image_url:
          "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
        tags: ["ofada", "sauce"],
        variants: [{ variant_name: "750ml Pack", price: 5200, stock_quantity: 11, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Foreshore Style Studio",
      category: "Fashion",
      address: "25 Kebbi Street, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44673,
      longitude: 3.43774,
      phone_number: "+234 801 555 4105",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80",
      ],
      description:
        "Contemporary fashion boutique for polished ready-to-wear, premium accessories, elevated weekend looks, and occasion styling in Ikoyi.",
      owner: {
        name: "Teni Lawson",
        email: "owner+foreshore-style-studio@neara.test",
        phone_number: "+234 801 555 5105",
      },
    },
    products: [
      {
        product_name: "Linen Two-Piece Set",
        category: "Womenswear",
        description: "Easy-fit linen co-ord set for warm Lagos days and weekend brunch.",
        image_url:
          "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "linen", "set"],
        variants: [
          { variant_name: "Size 10", price: 28500, stock_quantity: 6, in_stock: true },
          { variant_name: "Size 12", price: 28500, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Satin Evening Slip Dress",
        category: "Womenswear",
        description: "Fluid satin midi dress designed for dinners, events, and elegant evening styling.",
        image_url:
          "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "dress", "womenswear", "evening"],
        variants: [
          { variant_name: "Size 8", price: 36500, stock_quantity: 4, in_stock: true },
          { variant_name: "Size 10", price: 36500, stock_quantity: 6, in_stock: true },
          { variant_name: "Size 12", price: 36500, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Tailored Wide-Leg Trousers",
        category: "Womenswear",
        description: "Clean high-waist trousers with a flattering wide-leg cut for office and smart casual looks.",
        image_url:
          "https://images.unsplash.com/photo-1506629905607-d9b1c5c5f0b1?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "trousers", "tailored", "womenswear"],
        variants: [
          { variant_name: "Size 10", price: 24500, stock_quantity: 7, in_stock: true },
          { variant_name: "Size 12", price: 24500, stock_quantity: 8, in_stock: true },
          { variant_name: "Size 14", price: 24500, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Structured Blazer",
        category: "Womenswear",
        description: "Sharp single-breasted blazer for workwear, events, and elevated layering.",
        image_url:
          "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "blazer", "tailored", "womenswear"],
        variants: [
          { variant_name: "Size 10", price: 32500, stock_quantity: 5, in_stock: true },
          { variant_name: "Size 12", price: 32500, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Pleated Midi Skirt",
        category: "Womenswear",
        description: "Flowing midi skirt with crisp pleats for polished day-to-night dressing.",
        image_url:
          "https://images.unsplash.com/photo-1583496661160-fb5886a13d36?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "skirt", "womenswear", "classic"],
        variants: [
          { variant_name: "Size 10", price: 21000, stock_quantity: 8, in_stock: true },
          { variant_name: "Size 12", price: 21000, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Cotton Poplin Shirt",
        category: "Womenswear",
        description: "Crisp oversized shirt that styles easily with denim, trousers, or skirts.",
        image_url:
          "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "shirt", "essentials", "womenswear"],
        variants: [
          { variant_name: "Small", price: 18500, stock_quantity: 9, in_stock: true },
          { variant_name: "Medium", price: 18500, stock_quantity: 10, in_stock: true },
          { variant_name: "Large", price: 18500, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Soft Knit Lounge Set",
        category: "Womenswear",
        description: "Premium knit set for travel days, casual outings, and relaxed home styling.",
        image_url:
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "knitwear", "set", "loungewear"],
        variants: [
          { variant_name: "Small", price: 29500, stock_quantity: 5, in_stock: true },
          { variant_name: "Medium", price: 29500, stock_quantity: 7, in_stock: true },
        ],
      },
      {
        product_name: "Leather Handbag",
        category: "Accessories",
        description: "Structured everyday handbag with clean hardware and roomy interior.",
        image_url:
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "bag", "accessories", "leather"],
        variants: [
          { variant_name: "Tan", price: 42000, stock_quantity: 4, in_stock: true },
          { variant_name: "Black", price: 42000, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Mini Crossbody Bag",
        category: "Accessories",
        description: "Compact premium crossbody bag for errands, brunch, and light evening carry.",
        image_url:
          "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "bag", "accessories", "crossbody"],
        variants: [
          { variant_name: "Cream", price: 28500, stock_quantity: 5, in_stock: true },
          { variant_name: "Black", price: 28500, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Statement Sunglasses",
        category: "Accessories",
        description: "Bold square-frame sunglasses for bright afternoons and polished styling.",
        image_url:
          "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "accessories", "sunglasses", "luxury"],
        variants: [
          { variant_name: "Black Frame", price: 16500, stock_quantity: 8, in_stock: true },
          { variant_name: "Brown Frame", price: 16500, stock_quantity: 6, in_stock: true },
        ],
      },
      {
        product_name: "Gold Hoop Earrings",
        category: "Jewelry",
        description: "Classic polished hoops that finish both casual and dressy looks beautifully.",
        image_url:
          "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "jewelry", "accessories", "gold"],
        variants: [
          { variant_name: "Medium Pair", price: 9800, stock_quantity: 12, in_stock: true },
          { variant_name: "Large Pair", price: 12500, stock_quantity: 8, in_stock: true },
        ],
      },
      {
        product_name: "Leather Slide Sandals",
        category: "Footwear",
        description: "Minimal leather slides with cushioned sole for everyday use.",
        image_url:
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80",
        tags: ["footwear", "sandals"],
        variants: [
          { variant_name: "EU 39", price: 24500, stock_quantity: 5, in_stock: true },
          { variant_name: "EU 40", price: 24500, stock_quantity: 4, in_stock: true },
        ],
      },
      {
        product_name: "Block Heel Sandals",
        category: "Footwear",
        description: "Elegant block heels designed for events, dinners, and comfortable extended wear.",
        image_url:
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "footwear", "heels", "sandals"],
        variants: [
          { variant_name: "EU 38", price: 31500, stock_quantity: 4, in_stock: true },
          { variant_name: "EU 39", price: 31500, stock_quantity: 5, in_stock: true },
          { variant_name: "EU 40", price: 31500, stock_quantity: 4, in_stock: true },
        ],
      },
      {
        product_name: "White Leather Sneakers",
        category: "Footwear",
        description: "Clean low-profile sneakers for easy premium casual styling.",
        image_url:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "footwear", "sneakers", "essentials"],
        variants: [
          { variant_name: "EU 38", price: 35500, stock_quantity: 5, in_stock: true },
          { variant_name: "EU 39", price: 35500, stock_quantity: 6, in_stock: true },
          { variant_name: "EU 40", price: 35500, stock_quantity: 5, in_stock: true },
        ],
      },
      {
        product_name: "Silk Headscarf",
        category: "Accessories",
        description: "Printed silk scarf for hair styling, neck wraps, and luxe finishing detail.",
        image_url:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
        tags: ["fashion", "accessories", "scarf", "luxury"],
        variants: [
          { variant_name: "Monogram Print", price: 11800, stock_quantity: 10, in_stock: true },
          { variant_name: "Abstract Print", price: 11800, stock_quantity: 9, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Blue Jet Gadgets",
      category: "Electronics",
      address: "9 Osborne Road, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.45182,
      longitude: 3.43855,
      phone_number: "+234 801 555 4106",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Electronics and accessories shop for phones, audio gear, charging kits, and work-from-home essentials.",
      owner: {
        name: "Femi Johnson",
        email: "owner+blue-jet-gadgets@neara.test",
        phone_number: "+234 801 555 5106",
      },
    },
    products: [
      {
        product_name: "Wireless Earbuds",
        category: "Audio",
        description: "Compact Bluetooth earbuds with charging case and dual microphones.",
        image_url:
          "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?auto=format&fit=crop&w=1200&q=80",
        tags: ["audio", "earbuds"],
        variants: [{ variant_name: "Standard", price: 32000, stock_quantity: 12, in_stock: true }],
      },
      {
        product_name: "65W Fast Charger",
        category: "Accessories",
        description: "USB-C wall charger for phones, tablets, and light laptops.",
        image_url:
          "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80",
        tags: ["charger", "electronics"],
        variants: [{ variant_name: "Single Unit", price: 18000, stock_quantity: 14, in_stock: true }],
      },
      {
        product_name: "Portable Power Bank",
        category: "Accessories",
        description: "High-capacity power bank for mobile devices on the go.",
        image_url:
          "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1200&q=80",
        tags: ["power bank", "battery"],
        variants: [{ variant_name: "20,000mAh", price: 27500, stock_quantity: 9, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Palmview Beauty Lounge",
      category: "Beauty",
      address: "31 Udoma Street, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44596,
      longitude: 3.43387,
      phone_number: "+234 801 555 4107",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Beauty lounge for skincare, makeup essentials, hair care products, and quick pamper pickups.",
      owner: {
        name: "Kemi Adeniran",
        email: "owner+palmview-beauty-lounge@neara.test",
        phone_number: "+234 801 555 5107",
      },
    },
    products: [
      {
        product_name: "Hydrating Face Serum",
        category: "Skincare",
        description: "Lightweight serum for everyday hydration and glow support.",
        image_url:
          "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80",
        tags: ["skincare", "serum"],
        variants: [{ variant_name: "30ml Bottle", price: 14500, stock_quantity: 10, in_stock: true }],
      },
      {
        product_name: "Curl Defining Cream",
        category: "Haircare",
        description: "Moisture-rich styling cream for soft, defined curls.",
        image_url:
          "https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=1200&q=80",
        tags: ["haircare", "curl"],
        variants: [{ variant_name: "250ml Jar", price: 9800, stock_quantity: 14, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Harbour Petals",
      category: "Flowers",
      address: "15 2nd Avenue, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44721,
      longitude: 3.43896,
      phone_number: "+234 801 555 4108",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Flower studio creating premium bouquets, home arrangements, and gift-ready floral boxes.",
      owner: {
        name: "Nneka Umeh",
        email: "owner+harbour-petals@neara.test",
        phone_number: "+234 801 555 5108",
      },
    },
    products: [
      {
        product_name: "White Rose Bouquet",
        category: "Bouquets",
        description: "Classic white rose bouquet hand-tied for birthdays and thoughtful gifting.",
        image_url:
          "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=1200&q=80",
        tags: ["flowers", "bouquet", "roses"],
        variants: [
          { variant_name: "12 Stems", price: 24000, stock_quantity: 8, in_stock: true },
          { variant_name: "24 Stems", price: 42000, stock_quantity: 4, in_stock: true },
        ],
      },
      {
        product_name: "Table Arrangement",
        category: "Arrangements",
        description: "Compact fresh-flower arrangement for home dining and office desks.",
        image_url:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80",
        tags: ["flowers", "arrangement"],
        variants: [{ variant_name: "Standard", price: 18000, stock_quantity: 6, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Foreshore Fitness Shop",
      category: "Fitness",
      address: "28 Royal Palm Drive, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.44488,
      longitude: 3.43528,
      phone_number: "+234 801 555 4109",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Specialty fitness store for workout accessories, recovery gear, and clean nutrition staples.",
      owner: {
        name: "Ugo Nnamani",
        email: "owner+foreshore-fitness-shop@neara.test",
        phone_number: "+234 801 555 5109",
      },
    },
    products: [
      {
        product_name: "Yoga Mat",
        category: "Training Gear",
        description: "Non-slip yoga mat for home workouts, pilates, and stretching sessions.",
        image_url:
          "https://images.unsplash.com/photo-1599447292180-45fd84092ef4?auto=format&fit=crop&w=1200&q=80",
        tags: ["fitness", "yoga"],
        variants: [{ variant_name: "6mm Mat", price: 22000, stock_quantity: 9, in_stock: true }],
      },
      {
        product_name: "Whey Protein",
        category: "Nutrition",
        description: "Vanilla whey protein for post-workout shakes and recovery support.",
        image_url:
          "https://images.unsplash.com/photo-1622484212850-eb596d769edc?auto=format&fit=crop&w=1200&q=80",
        tags: ["protein", "nutrition"],
        variants: [{ variant_name: "2kg Tub", price: 54000, stock_quantity: 7, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Osborne Home Edit",
      category: "Home Decor",
      address: "8 Park Lane, Osborne Foreshore Estate, Ikoyi, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.45254,
      longitude: 3.43342,
      phone_number: "+234 801 555 4110",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Curated home store with candles, table styling, decor accents, and soft furnishings for upscale apartments.",
      owner: {
        name: "Ifeoma Obi",
        email: "owner+osborne-home-edit@neara.test",
        phone_number: "+234 801 555 5110",
      },
    },
    products: [
      {
        product_name: "Scented Soy Candle",
        category: "Home Fragrance",
        description: "Hand-poured soy candle with warm amber notes for living spaces.",
        image_url:
          "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1200&q=80",
        tags: ["candle", "decor"],
        variants: [{ variant_name: "Large Jar", price: 16800, stock_quantity: 10, in_stock: true }],
      },
      {
        product_name: "Ceramic Vase",
        category: "Decor",
        description: "Minimal ceramic vase for floral styling and shelf display.",
        image_url:
          "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80",
        tags: ["vase", "home decor"],
        variants: [{ variant_name: "Medium", price: 19500, stock_quantity: 6, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Elegushi Fresh Basket",
      category: "Grocery",
      address: "18 Meadow Hall Way, Lekki, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.43291,
      longitude: 3.47682,
      phone_number: "+234 801 555 4111",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Quick neighborhood grocery for fruit, breakfast staples, pantry top-ups, and convenience pickups around Elegushi.",
      owner: {
        name: "Dami Ojo",
        email: "owner+elegushi-fresh-basket@neara.test",
        phone_number: "+234 801 555 5111",
      },
    },
    products: [
      {
        product_name: "Golden Morn Cereal",
        category: "Breakfast",
        description: "Popular maize and soy cereal for quick breakfast bowls and easy family mornings.",
        image_url:
          "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
        tags: ["cereal", "breakfast"],
        variants: [
          { variant_name: "500g Pack", price: 1800, stock_quantity: 22, in_stock: true },
          { variant_name: "1kg Pack", price: 3200, stock_quantity: 12, in_stock: true },
        ],
      },
      {
        product_name: "Fresh Strawberries",
        category: "Produce",
        description: "Sweet fresh strawberries packed for smoothies, snacking, and fruit platters.",
        image_url:
          "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=1200&q=80",
        tags: ["fruit", "berries"],
        variants: [{ variant_name: "250g Punnet", price: 4200, stock_quantity: 14, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Palm Springs Pharmacy",
      category: "Pharmacy",
      address: "9 Palm Springs Road, Lekki, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.43584,
      longitude: 3.47866,
      phone_number: "+234 801 555 4112",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Nearby pharmacy for OTC medication, wellness supplements, and daily health essentials.",
      owner: {
        name: "Amarachi Ibe",
        email: "owner+palm-springs-pharmacy@neara.test",
        phone_number: "+234 801 555 5112",
      },
    },
    products: [
      {
        product_name: "Ibuprofen Capsules",
        category: "Pain Relief",
        description: "Fast-acting ibuprofen capsules for routine pain relief and inflammation support.",
        image_url:
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80",
        tags: ["pharmacy", "pain relief"],
        variants: [
          { variant_name: "Pack of 10", price: 1600, stock_quantity: 30, in_stock: true },
          { variant_name: "Pack of 30", price: 4200, stock_quantity: 16, in_stock: true },
        ],
      },
      {
        product_name: "Vitamin C",
        category: "Supplements",
        description: "Daily vitamin C tablets for immune support and everyday wellness.",
        image_url:
          "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=1200&q=80",
        tags: ["supplements", "vitamin c"],
        variants: [
          { variant_name: "1000mg x 20", price: 2900, stock_quantity: 20, in_stock: true },
          { variant_name: "1000mg x 60", price: 7600, stock_quantity: 10, in_stock: true },
        ],
      },
    ],
  },
  {
    store: {
      store_name: "Meadow Grill Kitchen",
      category: "Restaurant",
      address: "27 Meadow Hall Way, Lekki, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.43088,
      longitude: 3.47794,
      phone_number: "+234 801 555 4113",
      verified: false,
      subscription_tier: 1,
      image_url:
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Fast casual kitchen serving rice bowls, grilled proteins, and takeaway trays for the Lekki neighborhood.",
      owner: {
        name: "Sade Bakare",
        email: "owner+meadow-grill-kitchen@neara.test",
        phone_number: "+234 801 555 5113",
      },
    },
    products: [
      {
        product_name: "Smoky Jollof Rice Tray",
        category: "Meals",
        description: "Party-style jollof rice served hot for quick lunch and dinner orders.",
        image_url:
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80",
        tags: ["meal", "jollof"],
        variants: [
          { variant_name: "Regular", price: 6500, stock_quantity: 16, in_stock: true },
          { variant_name: "Large", price: 9200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Peppered Turkey Bowl",
        category: "Meals",
        description: "Peppered turkey served with fries or rice for quick takeaway orders.",
        image_url:
          "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1200&q=80",
        tags: ["turkey", "meal"],
        variants: [{ variant_name: "Single Bowl", price: 7800, stock_quantity: 11, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Coastal Tech Hub",
      category: "Electronics",
      address: "6 Kusenla Road, Lekki, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.43422,
      longitude: 3.48021,
      phone_number: "+234 801 555 4114",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Neighborhood gadget store for chargers, earbuds, cables, and quick mobile accessories.",
      owner: {
        name: "Lanre Bello",
        email: "owner+coastal-tech-hub@neara.test",
        phone_number: "+234 801 555 5114",
      },
    },
    products: [
      {
        product_name: "65W Fast Charger",
        category: "Accessories",
        description: "Compact USB-C fast charger for phones, tablets, and lightweight laptops.",
        image_url:
          "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80",
        tags: ["charger", "electronics"],
        variants: [{ variant_name: "Single Unit", price: 18000, stock_quantity: 13, in_stock: true }],
      },
      {
        product_name: "Wireless Earbuds",
        category: "Audio",
        description: "Bluetooth earbuds with charging case for calls, music, and everyday commuting.",
        image_url:
          "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?auto=format&fit=crop&w=1200&q=80",
        tags: ["audio", "earbuds"],
        variants: [{ variant_name: "Standard", price: 32000, stock_quantity: 8, in_stock: true }],
      },
    ],
  },
  {
    store: {
      store_name: "Beachside Bakery House",
      category: "Bakery",
      address: "11 Admiralty Close, Off Lekki-Epe Expressway, Lekki, Lagos",
      state: "Lagos",
      country: "Nigeria",
      latitude: 6.42976,
      longitude: 3.47493,
      phone_number: "+234 801 555 4115",
      verified: true,
      subscription_tier: 2,
      image_url:
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Local bakery for savory pies, pastries, celebration cakes, and breakfast pickups near the beachside corridor.",
      owner: {
        name: "Moyin Balogun",
        email: "owner+beachside-bakery-house@neara.test",
        phone_number: "+234 801 555 5115",
      },
    },
    products: [
      {
        product_name: "Chicken Pie",
        category: "Savory Snacks",
        description: "Buttery chicken pie baked fresh throughout the day.",
        image_url:
          "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80",
        tags: ["pie", "snack"],
        variants: [
          { variant_name: "Single", price: 1900, stock_quantity: 24, in_stock: true },
          { variant_name: "Pack of 4", price: 7200, stock_quantity: 10, in_stock: true },
        ],
      },
      {
        product_name: "Butter Croissant",
        category: "Pastries",
        description: "Layered croissant with a crisp exterior and soft buttery center.",
        image_url:
          "https://images.unsplash.com/photo-1555507036-ab794f4afe5d?auto=format&fit=crop&w=1200&q=80",
        tags: ["pastry", "breakfast"],
        variants: [
          { variant_name: "Single", price: 1600, stock_quantity: 18, in_stock: true },
          { variant_name: "Box of 4", price: 5900, stock_quantity: 7, in_stock: true },
        ],
      },
    ],
  },
  ...CURRENT_AREA_DEMO_STORES,
];

async function purgeManagedSeedStores(client) {
  const { rows } = await client.query(
    `
      DELETE FROM stores
      WHERE owner_id IN (
        SELECT id
        FROM users
        WHERE LOWER(email) LIKE LOWER($1)
      )
      RETURNING id
    `,
    [MANAGED_SEED_OWNER_EMAIL_PATTERN],
  );

  await client.query(
    `
      DELETE FROM users
      WHERE LOWER(email) LIKE LOWER($1)
    `,
    [MANAGED_SEED_OWNER_EMAIL_PATTERN],
  );

  return rows.length;
}

module.exports = {
  STORE_BLUEPRINTS,
  purgeManagedSeedStores,
};
