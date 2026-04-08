const MANAGED_SEED_OWNER_EMAIL_PATTERN = "owner+%@neara.test";

const STORE_BLUEPRINTS = [
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
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
      header_images: [
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
      ],
      description:
        "Contemporary fashion boutique for ready-to-wear looks, occasion styling, and wardrobe updates.",
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
