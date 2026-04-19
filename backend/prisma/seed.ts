import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CheezyHub database...');

  // ─── System Settings ─────────────────────────────────────────
  const existingSettings = await prisma.systemSettings.findFirst();
  if (!existingSettings) {
    await prisma.systemSettings.create({
      data: {
        deliveryFee:      150,
        serviceCharge:    0,
        deliveryRadiusKm: 10,
        restaurantName:   'CheezyHub',
        restaurantPhone:  '+92 300 000 0000',
        ordersAccepting:  true,
      },
    });
    console.log('✅ System settings created');
  }

  // ─── Staff Accounts ──────────────────────────────────────────

  const adminHash   = await bcrypt.hash('1234', 10);
  const cashierHash = await bcrypt.hash('000000', 10);
  const kitchenHash = await bcrypt.hash('5678', 10);
  const driverHash  = await bcrypt.hash('9012', 10);

  await prisma.staff.upsert({
    where:  { username: 'admin' },
    update: { pinHash: adminHash, isActive: true },
    create: {
      username: 'admin',
      pinHash:  adminHash,
      role:     'admin',
      fullName: 'Admin User',
    },
  });

  await prisma.staff.upsert({
    where:  { username: 'cashier1' },
    update: { pinHash: cashierHash, isActive: true },
    create: {
      username: 'cashier1',
      pinHash:  cashierHash,
      role:     'cashier',
      fullName: 'Counter Staff',
    },
  });

  await prisma.staff.upsert({
    where:  { username: 'kitchen1' },
    update: { pinHash: kitchenHash, isActive: true },
    create: {
      username: 'kitchen1',
      pinHash:  kitchenHash,
      role:     'kitchen',
      fullName: 'Kitchen Staff',
    },
  });

  await prisma.staff.upsert({
    where:  { username: 'driver1' },
    update: {
      pinHash:            driverHash,
      fullName:           'Ali Raza',
      phone:              '+923001111111',
      vehicleType:        'bike',
      vehiclePlate:       'LHR-001',
      verificationStatus: 'VERIFIED',
      driverStatus:       'OFFLINE',
      isActive:           true,
    },
    create: {
      username:           'driver1',
      pinHash:            driverHash,
      role:               'delivery',
      fullName:           'Ali Raza',
      phone:              '+923001111111',
      vehicleType:        'bike',
      vehiclePlate:       'LHR-001',
      verificationStatus: 'VERIFIED',
      driverStatus:       'OFFLINE',
      isActive:           true,
    },
  });

  console.log('✅ Staff accounts seeded');

  // ─── Test Customer ────────────────────────────────────────────
  await prisma.user.upsert({
    where:  { mobile: '+923000000000' },
    update: {},
    create: {
      name:    'Test Customer',
      mobile:  '+923000000000',
      pinHash: await bcrypt.hash('1234', 10),
      role:    'customer',
    },
  });
  console.log('✅ Test customer seeded  (mobile: +923000000000  PIN: 1234)');

  // ─── Menu ─────────────────────────────────────────────────────
  const menuCount = await prisma.menuItem.count();
  if (menuCount > 0) {
    console.log(`ℹ️  Menu already has ${menuCount} items — skipping menu seed`);
  } else {
    await seedMenu();
    console.log('✅ Menu seeded');
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Default Credentials:');
  console.log('  Admin:    username=admin     PIN=1234');
  console.log('  Kitchen:  username=kitchen1  PIN=5678');
  console.log('  Cashier:  username=cashier1  PIN=000000');
  console.log('  Driver:   username=driver1   PIN=9012');
  console.log('  Customer: mobile=+923000000000  PIN=1234');
}

async function seedMenu() {
  const burgers = await prisma.category.upsert({
    where:  { name: 'Burgers' },
    update: {},
    create: { name: 'Burgers', sortOrder: 1 },
  });

  const pizza = await prisma.category.upsert({
    where:  { name: 'Pizza' },
    update: {},
    create: { name: 'Pizza', sortOrder: 2 },
  });

  const sides = await prisma.category.upsert({
    where:  { name: 'Sides' },
    update: {},
    create: { name: 'Sides', sortOrder: 3 },
  });

  const drinks = await prisma.category.upsert({
    where:  { name: 'Drinks' },
    update: {},
    create: { name: 'Drinks', sortOrder: 4 },
  });

  // ─── Burgers ─────────────────────────────────────────────────
  await prisma.menuItem.create({
    data: {
      name:        'Classic Cheezeburger',
      description: 'Juicy beef patty, cheddar, lettuce, tomato, pickles, special sauce',
      basePrice:   1199,
      categoryId:  burgers.id,
      sortOrder:   1,
      modifierGroups: {
        create: [
          {
            name: 'Size', required: true, multiSelect: false,
            modifiers: {
              create: [
                { name: 'Single', priceAdjustment: 0 },
                { name: 'Double', priceAdjustment: 300 },
                { name: 'Triple', priceAdjustment: 550 },
              ],
            },
          },
          {
            name: 'Add-ons', required: false, multiSelect: true,
            modifiers: {
              create: [
                { name: 'Extra Cheese', priceAdjustment: 100 },
                { name: 'Bacon',        priceAdjustment: 150 },
                { name: 'Avocado',      priceAdjustment: 150 },
                { name: 'Jalapeños',    priceAdjustment: 50 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.menuItem.create({
    data: {
      name:        'Spicy Crispy Chicken Burger',
      description: 'Crispy fried chicken, sriracha mayo, coleslaw, pickled jalapeños',
      basePrice:   1299,
      categoryId:  burgers.id,
      sortOrder:   2,
      modifierGroups: {
        create: [
          {
            name: 'Spice Level', required: true, multiSelect: false,
            modifiers: {
              create: [
                { name: 'Mild',      priceAdjustment: 0 },
                { name: 'Medium',    priceAdjustment: 0 },
                { name: 'Hot',       priceAdjustment: 0 },
                { name: 'Extra Hot', priceAdjustment: 0 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.menuItem.create({
    data: {
      name:       'BBQ Smash Burger',
      description:'Double smash patty, smoky BBQ sauce, crispy onions, American cheese',
      basePrice:  1399, categoryId: burgers.id, sortOrder: 3,
    },
  });

  await prisma.menuItem.create({
    data: {
      name:       'Mushroom Swiss Burger',
      description:'Beef patty, sautéed mushrooms, Swiss cheese, garlic aioli',
      basePrice:  1249, categoryId: burgers.id, sortOrder: 4,
    },
  });

  // ─── Pizza ───────────────────────────────────────────────────
  await prisma.menuItem.create({
    data: {
      name:        'Margherita Pizza',
      description: 'San Marzano tomato sauce, fresh mozzarella, basil, olive oil',
      basePrice:   1499,
      categoryId:  pizza.id,
      sortOrder:   1,
      modifierGroups: {
        create: [
          {
            name: 'Size', required: true, multiSelect: false,
            modifiers: {
              create: [
                { name: '10" Personal', priceAdjustment: 0 },
                { name: '12" Medium',   priceAdjustment: 300 },
                { name: '14" Large',    priceAdjustment: 500 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.menuItem.create({
    data: {
      name: 'Pepperoni Overload Pizza', description: 'Triple-layer pepperoni, mozzarella blend',
      basePrice: 1699, categoryId: pizza.id, sortOrder: 2,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: 'BBQ Chicken Pizza', description: 'Grilled chicken, smoky BBQ sauce, red onions, coriander',
      basePrice: 1599, categoryId: pizza.id, sortOrder: 3,
    },
  });

  // ─── Sides ───────────────────────────────────────────────────
  const sideItems = [
    { name: 'Loaded Cheeze Fries',  price: 799,  desc: 'Crispy fries smothered in cheese sauce' },
    { name: 'Crispy Onion Rings',   price: 599,  desc: 'Beer-battered onion rings' },
    { name: 'Chicken Nuggets (6pc)',price: 699,  desc: 'Golden crispy nuggets' },
    { name: 'Coleslaw',             price: 349,  desc: 'Creamy homemade coleslaw' },
    { name: 'Garlic Bread',         price: 399,  desc: 'Toasted sourdough with garlic butter' },
  ];
  for (let i = 0; i < sideItems.length; i++) {
    const s = sideItems[i];
    await prisma.menuItem.create({
      data: { name: s.name, description: s.desc, basePrice: s.price, categoryId: sides.id, sortOrder: i + 1 },
    });
  }

  // ─── Drinks ──────────────────────────────────────────────────
  const drinkItems = [
    { name: 'Fresh Lemonade', price: 399, desc: 'Freshly squeezed with a hint of mint' },
    { name: 'Iced Coffee',    price: 449, desc: 'Cold brew over ice' },
    { name: 'Soft Drink',     price: 249, desc: 'Pepsi, 7Up, or Mirinda' },
    { name: 'Milkshake',      price: 599, desc: 'Thick and creamy — chocolate, vanilla, or strawberry' },
    { name: 'Mineral Water',  price: 149, desc: 'Still or sparkling' },
    { name: 'Mango Lassi',    price: 429, desc: 'Chilled yogurt-based mango drink' },
  ];
  for (let i = 0; i < drinkItems.length; i++) {
    const d = drinkItems[i];
    await prisma.menuItem.create({
      data: { name: d.name, description: d.desc, basePrice: d.price, categoryId: drinks.id, sortOrder: i + 1 },
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
