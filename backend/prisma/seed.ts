import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CheezyHub database...');

  // ─── System Settings ─────────────────────────
  const existingSettings = await prisma.systemSettings.findFirst();
  if (!existingSettings) {
    await prisma.systemSettings.create({
      data: {
        deliveryFee: 3.99,
        serviceCharge: 0,
        deliveryRadiusKm: 10,
        restaurantName: 'CheezyHub',
        restaurantPhone: '+1234567890',
        ordersAccepting: true,
      },
    });
  }

  // ─── Admin Account ────────────────────────────
  const adminPin = await bcrypt.hash('1234', 10);
  await prisma.staff.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', pinHash: adminPin, role: 'admin' },
  });

  // ─── Kitchen Account ──────────────────────────
  await prisma.staff.upsert({
    where: { username: 'kitchen1' },
    update: {},
    create: { username: 'kitchen1', pinHash: await bcrypt.hash('5678', 10), role: 'kitchen' },
  });

  // ─── Delivery Driver ──────────────────────────
  await prisma.staff.upsert({
    where: { username: 'driver1' },
    update: {},
    create: { username: 'driver1', pinHash: await bcrypt.hash('9012', 10), role: 'delivery' },
  });

  // ─── Menu Categories ─────────────────────────
  const burgers = await prisma.category.upsert({
    where: { name: 'Burgers' },
    update: {},
    create: { name: 'Burgers', sortOrder: 1 },
  });

  const pizza = await prisma.category.upsert({
    where: { name: 'Pizza' },
    update: {},
    create: { name: 'Pizza', sortOrder: 2 },
  });

  const sides = await prisma.category.upsert({
    where: { name: 'Sides' },
    update: {},
    create: { name: 'Sides', sortOrder: 3 },
  });

  const drinks = await prisma.category.upsert({
    where: { name: 'Drinks' },
    update: {},
    create: { name: 'Drinks', sortOrder: 4 },
  });

  // ─── Menu Items ───────────────────────────────

  // Classic Cheezeburger
  await prisma.menuItem.create({
    data: {
      name: 'Classic Cheezeburger',
      description: 'Juicy beef patty, cheddar, lettuce, tomato, pickles, special sauce',
      basePrice: 11.99,
      categoryId: burgers.id,
      sortOrder: 1,
      modifierGroups: {
        create: [
          {
            name: 'Size',
            required: true,
            multiSelect: false,
            modifiers: {
              create: [
                { name: 'Single', priceAdjustment: 0 },
                { name: 'Double', priceAdjustment: 3.00 },
                { name: 'Triple', priceAdjustment: 5.50 },
              ],
            },
          },
          {
            name: 'Add-ons',
            required: false,
            multiSelect: true,
            modifiers: {
              create: [
                { name: 'Extra Cheese', priceAdjustment: 1.00 },
                { name: 'Bacon', priceAdjustment: 1.50 },
                { name: 'Avocado', priceAdjustment: 1.50 },
                { name: 'Jalapeños', priceAdjustment: 0.50 },
              ],
            },
          },
        ],
      },
    },
  });

  // Cheeze Margherita Pizza
  await prisma.menuItem.create({
    data: {
      name: 'Margherita Pizza',
      description: 'San Marzano tomato sauce, fresh mozzarella, basil, olive oil',
      basePrice: 14.99,
      categoryId: pizza.id,
      sortOrder: 1,
      modifierGroups: {
        create: [
          {
            name: 'Size',
            required: true,
            multiSelect: false,
            modifiers: {
              create: [
                { name: '10" Personal', priceAdjustment: 0 },
                { name: '12" Medium', priceAdjustment: 3.00 },
                { name: '14" Large', priceAdjustment: 5.00 },
              ],
            },
          },
          {
            name: 'Extra Toppings',
            required: false,
            multiSelect: true,
            modifiers: {
              create: [
                { name: 'Pepperoni', priceAdjustment: 2.00 },
                { name: 'Mushrooms', priceAdjustment: 1.00 },
                { name: 'Bell Peppers', priceAdjustment: 1.00 },
                { name: 'Olives', priceAdjustment: 1.00 },
              ],
            },
          },
        ],
      },
    },
  });

  // Loaded Fries
  await prisma.menuItem.create({
    data: {
      name: 'Loaded Cheeze Fries',
      description: 'Crispy fries smothered in cheese sauce, topped with sour cream',
      basePrice: 7.99,
      categoryId: sides.id,
      sortOrder: 1,
    },
  });

  // Onion Rings
  await prisma.menuItem.create({
    data: {
      name: 'Crispy Onion Rings',
      description: 'Beer-battered onion rings served with dipping sauce',
      basePrice: 5.99,
      categoryId: sides.id,
      sortOrder: 2,
    },
  });

  // Drinks
  for (const drink of [
    { name: 'Fresh Lemonade', price: 3.99 },
    { name: 'Iced Coffee', price: 4.49 },
    { name: 'Soft Drink', price: 2.49 },
    { name: 'Milkshake', price: 5.99 },
  ]) {
    await prisma.menuItem.create({
      data: {
        name: drink.name,
        basePrice: drink.price,
        categoryId: drinks.id,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('\n📋 Default Credentials:');
  console.log('  Admin:   username=admin    PIN=1234');
  console.log('  Kitchen: username=kitchen1 PIN=5678');
  console.log('  Driver:  username=driver1  PIN=9012');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
