/* ============================================================================
 * data.js — Grocery catalogue, stores, dietary rules and knowledge base
 * AI Smart Grocery Assistant
 * All nutrition figures are per 100 g (or per 100 ml for liquids).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var _seq = 0;
  var CATALOG = [];

  /**
   * Compact product builder.
   * n=name b=brand c=category s=pack size pr=price(INR) e=emoji
   * sv=serving grams  np=servings per pack
   * nut=[kcal,protein,carbs,fibre,sugar,fat,satFat,sodium_mg] per 100g
   * nova=NOVA processing group 1..4   eco=eco score 0..100  r=rating
   * ing=ingredient string  tg=tags(pipe)  al=allergens(pipe)
   */
  function p(n, b, c, s, pr, e, sv, np, nut, nova, eco, r, ing, tg, al) {
    _seq++;
    CATALOG.push({
      id: 'P' + String(_seq).padStart(3, '0'),
      name: n, brand: b, category: c, size: s, price: pr, emoji: e,
      servingG: sv, servings: np,
      per100: {
        kcal: nut[0], protein: nut[1], carbs: nut[2], fiber: nut[3],
        sugar: nut[4], fat: nut[5], satFat: nut[6], sodium: nut[7]
      },
      nova: nova, eco: eco, rating: r, ingredients: ing,
      tags: tg ? tg.split('|') : [],
      allergens: al ? al.split('|') : []
    });
  }

  /* ------------------------------------------------------------------ FRUIT */
  p('Bananas (Robusta)', 'Farm Fresh', 'Fruits', '1 dozen', 62, '🍌', 118, 12,
    [89, 1.1, 22.8, 2.6, 12.2, 0.3, 0.1, 1], 1, 88, 4.4,
    'Fresh bananas', 'vegan|vegetarian|gluten-free|whole-food|potassium-rich|pre-workout', '');
  p('Shimla Apples', 'Farm Fresh', 'Fruits', '1 kg', 189, '🍎', 150, 6,
    [52, 0.3, 13.8, 2.4, 10.4, 0.2, 0.0, 1], 1, 84, 4.5,
    'Fresh apples', 'vegan|vegetarian|gluten-free|whole-food|high-fiber|low-gi', '');
  p('Nagpur Oranges', 'Farm Fresh', 'Fruits', '1 kg', 110, '🍊', 130, 7,
    [47, 0.9, 11.8, 2.4, 9.4, 0.1, 0.0, 0], 1, 86, 4.3,
    'Fresh oranges', 'vegan|vegetarian|gluten-free|whole-food|vitamin-c|immunity', '');
  p('Papaya', 'Farm Fresh', 'Fruits', '1 pc (~1.2 kg)', 78, '🥭', 150, 8,
    [43, 0.5, 10.8, 1.7, 7.8, 0.3, 0.1, 8], 1, 90, 4.2,
    'Fresh papaya', 'vegan|vegetarian|gluten-free|whole-food|digestive|low-calorie', '');
  p('Pomegranate', 'Farm Fresh', 'Fruits', '500 g', 145, '🍇', 125, 4,
    [83, 1.7, 18.7, 4.0, 13.7, 1.2, 0.1, 3], 1, 80, 4.6,
    'Fresh pomegranate arils', 'vegan|vegetarian|gluten-free|whole-food|antioxidant|iron-rich', '');
  p('Guava', 'Farm Fresh', 'Fruits', '500 g', 62, '🍐', 125, 4,
    [68, 2.6, 14.3, 5.4, 8.9, 1.0, 0.3, 2], 1, 89, 4.3,
    'Fresh guava', 'vegan|vegetarian|gluten-free|whole-food|high-fiber|vitamin-c|budget-hero', '');
  p('Seedless Grapes', 'Farm Fresh', 'Fruits', '500 g', 95, '🍇', 100, 5,
    [69, 0.7, 18.1, 0.9, 15.5, 0.2, 0.1, 2], 1, 74, 4.1,
    'Fresh grapes', 'vegan|vegetarian|gluten-free|whole-food|antioxidant', '');
  p('Alphonso Mango', 'Farm Fresh', 'Fruits', '1 kg', 320, '🥭', 165, 6,
    [60, 0.8, 15.0, 1.6, 13.7, 0.4, 0.1, 1], 1, 78, 4.7,
    'Fresh mango', 'vegan|vegetarian|gluten-free|whole-food|vitamin-a|seasonal', '');
  p('Watermelon', 'Farm Fresh', 'Fruits', '1 pc (~3 kg)', 96, '🍉', 200, 15,
    [30, 0.6, 7.6, 0.4, 6.2, 0.2, 0.0, 1], 1, 92, 4.0,
    'Fresh watermelon', 'vegan|vegetarian|gluten-free|whole-food|hydrating|low-calorie', '');
  p('Strawberries', 'Berry Farm', 'Fruits', '200 g', 165, '🍓', 100, 2,
    [32, 0.7, 7.7, 2.0, 4.9, 0.3, 0.0, 1], 1, 70, 4.4,
    'Fresh strawberries', 'vegan|vegetarian|gluten-free|whole-food|antioxidant|low-gi', '');
  p('Kiwi', 'Zespri', 'Fruits', '3 pcs', 135, '🥝', 75, 3,
    [61, 1.1, 14.7, 3.0, 9.0, 0.5, 0.0, 3], 1, 66, 4.5,
    'Fresh kiwi fruit', 'vegan|vegetarian|gluten-free|whole-food|vitamin-c|high-fiber', '');
  p('Avocado', 'Import Fresh', 'Fruits', '2 pcs', 240, '🥑', 100, 2,
    [160, 2.0, 8.5, 6.7, 0.7, 14.7, 2.1, 7], 1, 58, 4.4,
    'Fresh avocado', 'vegan|vegetarian|gluten-free|whole-food|healthy-fats|keto|high-fiber', '');

  /* ------------------------------------------------------------- VEGETABLES */
  p('Baby Spinach', 'Farm Fresh', 'Vegetables', '250 g', 45, '🥬', 80, 3,
    [23, 2.9, 3.6, 2.2, 0.4, 0.4, 0.1, 79], 1, 93, 4.5,
    'Fresh spinach leaves', 'vegan|vegetarian|gluten-free|whole-food|iron-rich|low-calorie|keto|budget-hero', '');
  p('Broccoli', 'Farm Fresh', 'Vegetables', '500 g', 98, '🥦', 100, 5,
    [34, 2.8, 6.6, 2.6, 1.7, 0.4, 0.1, 33], 1, 90, 4.4,
    'Fresh broccoli', 'vegan|vegetarian|gluten-free|whole-food|high-fiber|low-calorie|keto', '');
  p('Carrots', 'Farm Fresh', 'Vegetables', '500 g', 38, '🥕', 100, 5,
    [41, 0.9, 9.6, 2.8, 4.7, 0.2, 0.0, 69], 1, 91, 4.3,
    'Fresh carrots', 'vegan|vegetarian|gluten-free|whole-food|vitamin-a|budget-hero', '');
  p('Tomatoes', 'Farm Fresh', 'Vegetables', '1 kg', 42, '🍅', 100, 10,
    [18, 0.9, 3.9, 1.2, 2.6, 0.2, 0.0, 5], 1, 88, 4.2,
    'Fresh tomatoes', 'vegan|vegetarian|gluten-free|whole-food|low-calorie|budget-hero|antioxidant', '');
  p('Onions', 'Farm Fresh', 'Vegetables', '1 kg', 36, '🧅', 100, 10,
    [40, 1.1, 9.3, 1.7, 4.2, 0.1, 0.0, 4], 1, 90, 4.1,
    'Fresh onions', 'vegan|vegetarian|gluten-free|whole-food|budget-hero', '');
  p('Potatoes', 'Farm Fresh', 'Vegetables', '1 kg', 32, '🥔', 150, 6,
    [77, 2.0, 17.5, 2.2, 0.8, 0.1, 0.0, 6], 1, 89, 4.0,
    'Fresh potatoes', 'vegan|vegetarian|gluten-free|whole-food|budget-hero', '');
  p('Cauliflower', 'Farm Fresh', 'Vegetables', '1 pc (~800 g)', 44, '🥬', 100, 8,
    [25, 1.9, 5.0, 2.0, 1.9, 0.3, 0.1, 30], 1, 88, 4.1,
    'Fresh cauliflower', 'vegan|vegetarian|gluten-free|whole-food|keto|low-calorie|low-carb', '');
  p('Capsicum (Mixed)', 'Farm Fresh', 'Vegetables', '250 g', 68, '🫑', 80, 3,
    [31, 1.0, 6.0, 2.1, 4.2, 0.3, 0.1, 4], 1, 84, 4.2,
    'Fresh bell peppers', 'vegan|vegetarian|gluten-free|whole-food|vitamin-c|low-calorie', '');
  p('Cucumber', 'Farm Fresh', 'Vegetables', '500 g', 28, '🥒', 100, 5,
    [15, 0.7, 3.6, 0.5, 1.7, 0.1, 0.0, 2], 1, 92, 4.0,
    'Fresh cucumber', 'vegan|vegetarian|gluten-free|whole-food|hydrating|low-calorie|keto|budget-hero', '');
  p('French Beans', 'Farm Fresh', 'Vegetables', '250 g', 40, '🫛', 100, 3,
    [31, 1.8, 7.0, 3.4, 3.3, 0.2, 0.0, 6], 1, 89, 4.1,
    'Fresh french beans', 'vegan|vegetarian|gluten-free|whole-food|high-fiber|low-calorie', '');
  p('Beetroot', 'Farm Fresh', 'Vegetables', '500 g', 42, '🥬', 100, 5,
    [43, 1.6, 9.6, 2.8, 6.8, 0.2, 0.0, 78], 1, 90, 4.0,
    'Fresh beetroot', 'vegan|vegetarian|gluten-free|whole-food|iron-rich|nitrate-rich|pre-workout', '');
  p('Button Mushrooms', 'Farm Fresh', 'Vegetables', '200 g', 78, '🍄', 100, 2,
    [22, 3.1, 3.3, 1.0, 2.0, 0.3, 0.1, 5], 1, 85, 4.3,
    'Fresh button mushrooms', 'vegan|vegetarian|gluten-free|whole-food|vitamin-d|low-calorie|keto|umami', '');
  p('Sweet Potato', 'Farm Fresh', 'Vegetables', '500 g', 55, '🍠', 150, 3,
    [86, 1.6, 20.1, 3.0, 4.2, 0.1, 0.0, 55], 1, 90, 4.3,
    'Fresh sweet potato', 'vegan|vegetarian|gluten-free|whole-food|complex-carb|vitamin-a|pre-workout', '');
  p('Bottle Gourd (Lauki)', 'Farm Fresh', 'Vegetables', '1 pc (~700 g)', 34, '🥒', 150, 4,
    [14, 0.6, 3.4, 0.5, 1.2, 0.0, 0.0, 2], 1, 93, 3.9,
    'Fresh bottle gourd', 'vegan|vegetarian|gluten-free|whole-food|low-calorie|diabetic-friendly|budget-hero', '');

  /* --------------------------------------------------- GRAINS & CEREALS */
  p('Rolled Oats', 'Quaker', 'Grains & Cereals', '1 kg', 189, '🌾', 40, 25,
    [379, 13.2, 67.7, 10.1, 1.0, 6.5, 1.2, 6], 1, 82, 4.5,
    'Whole grain rolled oats', 'vegan|vegetarian|high-fiber|whole-grain|diabetic-friendly|heart-healthy|low-gi|budget-hero', 'gluten');
  p('Brown Rice', 'India Gate', 'Grains & Cereals', '1 kg', 148, '🍚', 60, 16,
    [362, 7.5, 76.2, 3.4, 0.7, 2.7, 0.6, 5], 1, 79, 4.3,
    'Whole grain brown rice', 'vegan|vegetarian|gluten-free|whole-grain|high-fiber|low-gi', '');
  p('Basmati White Rice', 'India Gate', 'Grains & Cereals', '1 kg', 132, '🍚', 60, 16,
    [356, 7.1, 78.2, 1.3, 0.1, 0.9, 0.2, 4], 2, 72, 4.4,
    'Milled basmati rice', 'vegan|vegetarian|gluten-free|budget-hero', '');
  p('Whole Wheat Atta', 'Aashirvaad', 'Grains & Cereals', '5 kg', 285, '🌾', 60, 83,
    [340, 12.1, 69.4, 11.2, 1.4, 2.5, 0.5, 3], 1, 83, 4.5,
    'Whole wheat flour', 'vegetarian|vegan|whole-grain|high-fiber|budget-hero', 'gluten');
  p('Multigrain Atta', 'Aashirvaad', 'Grains & Cereals', '5 kg', 375, '🌾', 60, 83,
    [333, 13.4, 63.8, 13.5, 1.9, 3.6, 0.7, 8], 2, 81, 4.4,
    'Wheat, soya, oat, maize, chana, psyllium husk', 'vegetarian|vegan|whole-grain|high-fiber|diabetic-friendly|low-gi', 'gluten|soy');
  p('Quinoa', 'Nourish Organics', 'Grains & Cereals', '500 g', 349, '🌾', 50, 10,
    [368, 14.1, 64.2, 7.0, 4.6, 6.1, 0.7, 5], 1, 62, 4.4,
    'Organic white quinoa', 'vegan|vegetarian|gluten-free|complete-protein|high-fiber|whole-grain|low-gi', '');
  p('Ragi Flour (Finger Millet)', 'Organic India', 'Grains & Cereals', '500 g', 92, '🌾', 40, 12,
    [336, 7.3, 72.0, 11.5, 0.5, 1.3, 0.3, 11], 1, 89, 4.3,
    'Stone ground finger millet flour', 'vegan|vegetarian|gluten-free|calcium-rich|high-fiber|diabetic-friendly|budget-hero', '');
  p('Bajra (Pearl Millet)', 'Organic India', 'Grains & Cereals', '1 kg', 118, '🌾', 50, 20,
    [361, 11.6, 67.5, 11.3, 0.9, 5.0, 1.0, 10], 1, 90, 4.2,
    'Whole pearl millet', 'vegan|vegetarian|gluten-free|high-fiber|iron-rich|diabetic-friendly|budget-hero', '');
  p('Corn Flakes', 'Kelloggs', 'Grains & Cereals', '475 g', 235, '🥣', 30, 16,
    [378, 7.0, 84.0, 3.0, 8.5, 0.7, 0.2, 620], 4, 55, 3.9,
    'Maize grits, sugar, malt extract, salt, iron, vitamins', 'vegetarian|fortified|ultra-processed|high-gi', 'gluten');
  p('Crunchy Muesli, No Added Sugar', 'Yogabar', 'Grains & Cereals', '400 g', 349, '🥣', 50, 8,
    [412, 11.8, 57.0, 9.4, 8.2, 14.5, 2.3, 22], 3, 68, 4.3,
    'Oats, almonds, raisins, cranberry, pumpkin seed, honey', 'vegetarian|high-fiber|no-added-sugar|breakfast', 'gluten|nuts');
  p('Poha (Flattened Rice)', 'Local Mill', 'Grains & Cereals', '500 g', 48, '🍚', 50, 10,
    [346, 6.6, 76.9, 2.6, 0.3, 1.2, 0.3, 8], 2, 86, 4.1,
    'Flattened rice', 'vegan|vegetarian|gluten-free|budget-hero|breakfast', '');
  p('Sooji / Rava', 'Local Mill', 'Grains & Cereals', '500 g', 42, '🌾', 50, 10,
    [360, 12.7, 72.8, 3.9, 0.7, 1.1, 0.2, 1], 2, 85, 4.0,
    'Semolina from durum wheat', 'vegetarian|vegan|budget-hero|breakfast', 'gluten');

  /* -------------------------------------------------- PULSES & LEGUMES */
  p('Toor Dal (Arhar)', 'Tata Sampann', 'Pulses & Legumes', '1 kg', 178, '🫘', 50, 20,
    [343, 22.3, 62.8, 15.5, 2.5, 1.5, 0.4, 17], 1, 87, 4.5,
    'Unpolished toor dal', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|budget-hero|diabetic-friendly', '');
  p('Moong Dal (Yellow)', 'Tata Sampann', 'Pulses & Legumes', '1 kg', 152, '🫘', 50, 20,
    [347, 24.5, 59.0, 16.3, 2.0, 1.2, 0.3, 15], 1, 88, 4.5,
    'Split yellow moong dal', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|easy-digest|budget-hero', '');
  p('Chana Dal', 'Tata Sampann', 'Pulses & Legumes', '1 kg', 132, '🫘', 50, 20,
    [364, 20.8, 60.7, 17.1, 3.0, 5.6, 0.7, 20], 1, 88, 4.4,
    'Split bengal gram', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|low-gi|diabetic-friendly|budget-hero', '');
  p('Rajma (Kidney Beans)', '24 Mantra', 'Pulses & Legumes', '500 g', 118, '🫘', 60, 8,
    [333, 24.0, 60.0, 25.0, 2.1, 0.8, 0.1, 24], 1, 86, 4.4,
    'Whole red kidney beans', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|iron-rich|low-gi', '');
  p('Kabuli Chana (Chickpeas)', '24 Mantra', 'Pulses & Legumes', '500 g', 96, '🫘', 60, 8,
    [364, 19.3, 60.7, 17.4, 10.7, 6.0, 0.6, 24], 1, 86, 4.4,
    'Whole white chickpeas', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|low-gi|budget-hero', '');
  p('Masoor Dal (Red Lentil)', 'Tata Sampann', 'Pulses & Legumes', '1 kg', 128, '🫘', 50, 20,
    [352, 25.8, 59.9, 10.8, 1.8, 1.1, 0.2, 7], 1, 88, 4.4,
    'Split red lentils', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|iron-rich|easy-digest|budget-hero', '');
  p('Urad Dal', 'Tata Sampann', 'Pulses & Legumes', '500 g', 94, '🫘', 50, 10,
    [341, 25.2, 58.9, 18.3, 1.9, 1.6, 0.4, 38], 1, 87, 4.2,
    'Split black gram', 'vegan|vegetarian|gluten-free|high-protein|high-fiber', '');
  p('Soya Chunks', 'Nutrela', 'Pulses & Legumes', '200 g', 62, '🫘', 25, 8,
    [345, 52.0, 33.0, 13.0, 0.9, 0.5, 0.1, 25], 3, 75, 4.4,
    'Defatted soy flour', 'vegan|vegetarian|gluten-free|high-protein|muscle-gain|budget-hero|meat-alternative', 'soy');
  p('Black Beans', 'Urban Platter', 'Pulses & Legumes', '500 g', 210, '🫘', 60, 8,
    [341, 21.6, 62.4, 15.5, 2.1, 1.4, 0.4, 5], 1, 78, 4.2,
    'Whole black beans', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|antioxidant', '');
  p('Roasted Chana (Whole)', 'Local', 'Pulses & Legumes', '500 g', 88, '🫘', 30, 16,
    [369, 22.5, 57.8, 18.0, 5.0, 5.4, 0.6, 22], 2, 87, 4.3,
    'Roasted bengal gram', 'vegan|vegetarian|gluten-free|high-protein|high-fiber|healthy-snack|budget-hero', '');

  /* ------------------------------------------------------ DAIRY & EGGS */
  p('Toned Milk', 'Amul', 'Dairy & Eggs', '1 L', 56, '🥛', 200, 5,
    [58, 3.1, 4.7, 0.0, 4.7, 3.0, 1.9, 45], 1, 72, 4.5,
    'Toned cow milk', 'vegetarian|gluten-free|calcium-rich|protein|budget-hero', 'milk');
  p('Full Cream Milk', 'Amul', 'Dairy & Eggs', '1 L', 68, '🥛', 200, 5,
    [87, 3.2, 4.7, 0.0, 4.7, 6.0, 3.9, 45], 1, 68, 4.4,
    'Full cream cow milk', 'vegetarian|gluten-free|calcium-rich|weight-gain', 'milk');
  p('Double Toned Milk', 'Mother Dairy', 'Dairy & Eggs', '1 L', 54, '🥛', 200, 5,
    [43, 3.1, 4.8, 0.0, 4.8, 1.5, 1.0, 45], 1, 74, 4.3,
    'Double toned cow milk', 'vegetarian|gluten-free|low-fat|calcium-rich|weight-loss|heart-healthy', 'milk');
  p('Unsweetened Almond Milk', 'Sofit', 'Dairy & Eggs', '1 L', 199, '🥛', 200, 5,
    [15, 0.5, 0.6, 0.4, 0.0, 1.2, 0.1, 60], 3, 66, 4.0,
    'Water, almond paste, minerals, vitamins', 'vegan|vegetarian|gluten-free|dairy-free|lactose-free|low-calorie|keto', 'nuts');
  p('Soy Milk, Unsweetened', 'Sofit', 'Dairy & Eggs', '1 L', 155, '🥛', 200, 5,
    [39, 3.3, 1.8, 0.6, 0.4, 1.9, 0.3, 48], 3, 71, 4.1,
    'Water, soybean, minerals, vitamins', 'vegan|vegetarian|gluten-free|dairy-free|lactose-free|protein|heart-healthy', 'soy');
  p('Greek Yogurt, Plain', 'Epigamia', 'Dairy & Eggs', '400 g', 175, '🥛', 100, 4,
    [97, 9.0, 4.0, 0.0, 4.0, 5.0, 3.2, 36], 2, 65, 4.4,
    'Milk solids, live cultures', 'vegetarian|gluten-free|high-protein|probiotic|muscle-gain|low-sugar', 'milk');
  p('Fresh Curd (Dahi)', 'Amul', 'Dairy & Eggs', '400 g', 42, '🥛', 100, 4,
    [61, 3.5, 4.7, 0.0, 4.7, 3.3, 2.1, 46], 1, 76, 4.4,
    'Pasteurised milk, live cultures', 'vegetarian|gluten-free|probiotic|calcium-rich|budget-hero|gut-health', 'milk');
  p('Paneer (Malai)', 'Amul', 'Dairy & Eggs', '200 g', 95, '🧀', 100, 2,
    [296, 18.3, 6.1, 0.0, 2.1, 22.0, 14.0, 22], 2, 62, 4.5,
    'Cow milk, citric acid', 'vegetarian|gluten-free|high-protein|muscle-gain|keto|calcium-rich', 'milk');
  p('Organic Tofu (Firm)', 'Urban Platter', 'Dairy & Eggs', '200 g', 120, '🧊', 100, 2,
    [144, 15.8, 2.8, 2.3, 0.6, 8.7, 1.3, 14], 2, 79, 4.2,
    'Soybean, water, calcium sulphate', 'vegan|vegetarian|gluten-free|dairy-free|high-protein|meat-alternative|keto', 'soy');
  p('Cheese Slices', 'Amul', 'Dairy & Eggs', '200 g (10 slices)', 135, '🧀', 20, 10,
    [318, 20.0, 5.0, 0.0, 3.0, 24.0, 15.5, 1250], 4, 52, 4.1,
    'Cheese, water, emulsifying salts, milk solids, salt, preservative (INS 200)', 'vegetarian|high-sodium|ultra-processed|calcium-rich', 'milk');
  p('Butter (Salted)', 'Amul', 'Dairy & Eggs', '500 g', 285, '🧈', 10, 50,
    [717, 0.5, 0.6, 0.0, 0.6, 81.0, 51.0, 640], 2, 48, 4.5,
    'Cream, salt', 'vegetarian|gluten-free|keto|high-satfat', 'milk');
  p('Cow Ghee', 'Amul', 'Dairy & Eggs', '500 ml', 395, '🧈', 10, 50,
    [900, 0.0, 0.0, 0.0, 0.0, 100.0, 62.0, 2], 2, 55, 4.6,
    'Clarified butter from cow milk', 'vegetarian|gluten-free|keto|high-satfat|traditional', 'milk');
  p('Farm Eggs', 'Eggoz', 'Dairy & Eggs', '12 pcs', 96, '🥚', 50, 12,
    [143, 12.6, 0.7, 0.0, 0.4, 9.5, 3.1, 142], 1, 70, 4.5,
    'Fresh table eggs', 'vegetarian-eggetarian|gluten-free|high-protein|complete-protein|muscle-gain|keto|budget-hero', 'egg');

  /* ---------------------------------------------------- MEAT & SEAFOOD */
  p('Chicken Breast, Boneless', 'Licious', 'Meat & Seafood', '500 g', 285, '🍗', 150, 3,
    [165, 31.0, 0.0, 0.0, 0.0, 3.6, 1.0, 74], 1, 52, 4.6,
    'Fresh chicken breast', 'non-vegetarian|gluten-free|high-protein|lean-protein|muscle-gain|keto|low-fat', '');
  p('Chicken Curry Cut', 'Licious', 'Meat & Seafood', '1 kg', 289, '🍗', 150, 6,
    [215, 24.0, 0.0, 0.0, 0.0, 13.0, 3.8, 82], 1, 54, 4.4,
    'Fresh chicken with bone', 'non-vegetarian|gluten-free|high-protein|budget-hero', '');
  p('Mutton Curry Cut', 'Licious', 'Meat & Seafood', '500 g', 450, '🥩', 150, 3,
    [258, 25.6, 0.0, 0.0, 0.0, 16.9, 7.3, 72], 1, 32, 4.3,
    'Fresh goat meat', 'non-vegetarian|gluten-free|high-protein|iron-rich|high-satfat', '');
  p('Rohu Fish (Cut)', 'Licious', 'Meat & Seafood', '500 g', 265, '🐟', 150, 3,
    [97, 16.6, 0.0, 0.0, 0.0, 3.2, 0.9, 55], 1, 60, 4.2,
    'Fresh rohu fish', 'non-vegetarian|pescatarian|gluten-free|high-protein|omega-3|lean-protein', 'fish');
  p('Norwegian Salmon Fillet', 'Licious', 'Meat & Seafood', '250 g', 749, '🐟', 125, 2,
    [208, 20.4, 0.0, 0.0, 0.0, 13.4, 3.1, 59], 1, 44, 4.7,
    'Atlantic salmon fillet', 'non-vegetarian|pescatarian|gluten-free|high-protein|omega-3|heart-healthy|brain-health|premium', 'fish');
  p('Prawns, Cleaned', 'Licious', 'Meat & Seafood', '250 g', 340, '🦐', 125, 2,
    [99, 24.0, 0.2, 0.0, 0.0, 0.3, 0.1, 111], 1, 48, 4.3,
    'Fresh cleaned prawns', 'non-vegetarian|pescatarian|gluten-free|high-protein|lean-protein|keto|low-fat', 'shellfish');
  p('Tuna in Water (Canned)', 'John West', 'Meat & Seafood', '185 g', 245, '🐟', 92, 2,
    [116, 25.5, 0.0, 0.0, 0.0, 1.0, 0.3, 320], 3, 50, 4.1,
    'Tuna, water, salt', 'non-vegetarian|pescatarian|gluten-free|high-protein|lean-protein|keto|convenient', 'fish');

  /* ------------------------------------------------------ NUTS & SEEDS */
  p('Californian Almonds', 'Happilo', 'Nuts & Seeds', '500 g', 549, '🌰', 28, 18,
    [579, 21.2, 21.6, 12.5, 4.4, 49.9, 3.8, 1], 1, 58, 4.6,
    'Raw whole almonds', 'vegan|vegetarian|gluten-free|healthy-fats|high-protein|keto|vitamin-e|brain-health', 'nuts');
  p('Walnut Kernels', 'Happilo', 'Nuts & Seeds', '250 g', 549, '🌰', 28, 9,
    [654, 15.2, 13.7, 6.7, 2.6, 65.2, 6.1, 2], 1, 56, 4.5,
    'Raw walnut kernels', 'vegan|vegetarian|gluten-free|omega-3|healthy-fats|keto|brain-health|heart-healthy', 'nuts');
  p('Cashews (W240)', 'Happilo', 'Nuts & Seeds', '250 g', 315, '🌰', 28, 9,
    [553, 18.2, 30.2, 3.3, 5.9, 43.9, 7.8, 12], 1, 54, 4.4,
    'Raw whole cashews', 'vegan|vegetarian|gluten-free|healthy-fats|magnesium', 'nuts');
  p('Roasted Pistachios', 'Happilo', 'Nuts & Seeds', '200 g', 425, '🌰', 28, 7,
    [562, 20.2, 27.2, 10.3, 7.7, 45.3, 5.9, 428], 2, 52, 4.4,
    'Pistachios, salt', 'vegan|vegetarian|gluten-free|high-protein|healthy-fats|high-sodium', 'nuts');
  p('Chia Seeds', 'Nourish Organics', 'Nuts & Seeds', '200 g', 199, '🌱', 15, 13,
    [486, 16.5, 42.1, 34.4, 0.0, 30.7, 3.3, 16], 1, 72, 4.5,
    'Raw chia seeds', 'vegan|vegetarian|gluten-free|omega-3|high-fiber|superfood|weight-loss|low-gi', '');
  p('Flax Seeds', 'Nourish Organics', 'Nuts & Seeds', '250 g', 129, '🌱', 15, 16,
    [534, 18.3, 28.9, 27.3, 1.6, 42.2, 3.7, 30], 1, 78, 4.4,
    'Raw flax seeds', 'vegan|vegetarian|gluten-free|omega-3|high-fiber|heart-healthy|budget-hero', '');
  p('Pumpkin Seeds', 'Happilo', 'Nuts & Seeds', '200 g', 249, '🌱', 20, 10,
    [559, 30.2, 10.7, 6.0, 1.4, 49.1, 8.7, 7], 1, 68, 4.3,
    'Raw pumpkin seeds', 'vegan|vegetarian|gluten-free|high-protein|magnesium|zinc|keto', '');
  p('Sunflower Seeds', 'Happilo', 'Nuts & Seeds', '200 g', 165, '🌱', 20, 10,
    [584, 20.8, 20.0, 8.6, 2.6, 51.5, 4.5, 9], 1, 70, 4.2,
    'Raw sunflower seeds', 'vegan|vegetarian|gluten-free|vitamin-e|healthy-fats', '');
  p('Peanuts, Raw', 'Local', 'Nuts & Seeds', '500 g', 118, '🥜', 30, 16,
    [567, 25.8, 16.1, 8.5, 4.7, 49.2, 6.3, 18], 1, 82, 4.3,
    'Raw groundnuts', 'vegan|vegetarian|gluten-free|high-protein|healthy-fats|budget-hero', 'peanuts');

  /* ------------------------------------------- SPREADS & BREAKFAST */
  p('Natural Peanut Butter, Unsweetened', 'Pintola', 'Breakfast & Spreads', '1 kg', 449, '🥜', 32, 31,
    [588, 30.0, 20.0, 8.0, 4.0, 48.0, 8.0, 15], 2, 76, 4.5,
    '100% roasted peanuts', 'vegan|vegetarian|gluten-free|high-protein|healthy-fats|no-added-sugar|muscle-gain|budget-hero', 'peanuts');
  p('Chocolate Hazelnut Spread', 'Sweet Co', 'Breakfast & Spreads', '350 g', 265, '🍫', 20, 17,
    [546, 6.3, 57.5, 3.4, 54.0, 31.0, 10.6, 41], 4, 40, 4.2,
    'Sugar, palm oil, hazelnut, cocoa, skimmed milk powder, emulsifier (322), vanillin', 'vegetarian|high-sugar|ultra-processed|treat', 'nuts|milk|soy');
  p('Almond Butter', 'Alpino', 'Breakfast & Spreads', '400 g', 649, '🥜', 32, 12,
    [614, 21.0, 19.0, 10.5, 4.4, 55.5, 4.2, 6], 2, 64, 4.3,
    '100% roasted almonds', 'vegan|vegetarian|gluten-free|healthy-fats|no-added-sugar|premium', 'nuts');
  p('Raw Forest Honey', 'Dabur', 'Breakfast & Spreads', '500 g', 265, '🍯', 20, 25,
    [304, 0.3, 82.4, 0.2, 82.1, 0.0, 0.0, 4], 2, 70, 4.3,
    '100% pure honey', 'vegetarian|gluten-free|natural-sweetener|high-sugar', '');
  p('Mixed Fruit Jam', 'Kissan', 'Breakfast & Spreads', '500 g', 175, '🍓', 20, 25,
    [278, 0.4, 68.5, 0.6, 65.0, 0.1, 0.0, 30], 4, 44, 3.9,
    'Sugar, fruit pulp (mango, pineapple, papaya), acidity regulator (330), preservative (211), colour (110)', 'vegetarian|high-sugar|ultra-processed', '');
  p('Tomato Ketchup', 'Kissan', 'Breakfast & Spreads', '900 g', 145, '🍅', 15, 60,
    [110, 1.0, 25.0, 0.6, 22.0, 0.1, 0.0, 900], 4, 48, 4.1,
    'Tomato paste, sugar, salt, acidity regulator (260), spices, preservative (211)', 'vegetarian|high-sugar|high-sodium|ultra-processed', '');
  p('Eggless Mayonnaise', 'Veeba', 'Breakfast & Spreads', '250 g', 99, '🥫', 15, 17,
    [680, 1.0, 5.0, 0.0, 4.0, 73.0, 8.0, 620], 4, 38, 4.0,
    'Refined soyabean oil, water, sugar, acidity regulator, stabiliser (415), preservative (211)', 'vegetarian|high-fat|ultra-processed|high-sodium', 'soy');

  /* ------------------------------------------------------------ BAKERY */
  p('White Sandwich Bread', 'Britannia', 'Bakery', '400 g', 50, '🍞', 50, 8,
    [265, 8.0, 49.0, 2.0, 5.0, 3.2, 0.8, 490], 4, 52, 3.9,
    'Refined wheat flour, water, sugar, yeast, salt, emulsifier (472e), preservative (282)', 'vegetarian|ultra-processed|high-gi|budget-hero', 'gluten|soy');
  p('100% Whole Wheat Bread', 'Britannia', 'Bakery', '400 g', 62, '🍞', 50, 8,
    [247, 10.5, 41.0, 6.8, 4.0, 3.4, 0.7, 430], 3, 62, 4.2,
    'Whole wheat flour, water, gluten, yeast, salt, emulsifier (472e)', 'vegetarian|whole-grain|high-fiber', 'gluten');
  p('Multigrain Seeded Bread', 'The Health Factory', 'Bakery', '350 g', 95, '🍞', 50, 7,
    [252, 12.0, 38.0, 8.5, 3.2, 5.0, 0.9, 400], 3, 66, 4.3,
    'Whole wheat, oats, flax, sunflower seed, gluten, yeast, salt', 'vegetarian|whole-grain|high-fiber|high-protein', 'gluten');
  p('Burger Buns', 'Britannia', 'Bakery', '6 pcs', 45, '🍔', 50, 6,
    [280, 8.5, 51.0, 2.2, 7.0, 4.0, 1.1, 470], 4, 50, 3.8,
    'Refined wheat flour, sugar, yeast, emulsifier, preservative (282)', 'vegetarian|ultra-processed|high-gi', 'gluten|milk');
  p('Whole Wheat Rusk', 'Parle', 'Bakery', '300 g', 55, '🍞', 25, 12,
    [420, 9.0, 70.0, 4.5, 16.0, 12.0, 5.5, 380], 4, 54, 3.9,
    'Wheat flour, sugar, edible vegetable oil, yeast, salt', 'vegetarian|high-sugar|ultra-processed', 'gluten|milk');

  /* ------------------------------------------------------------ SNACKS */
  p('Classic Salted Potato Chips', 'Lays', 'Snacks', '90 g', 40, '🍟', 30, 3,
    [536, 6.0, 53.0, 4.4, 0.5, 34.0, 15.0, 550], 4, 30, 4.0,
    'Potato, palmolein oil, salt, antioxidant (319)', 'vegetarian|ultra-processed|high-sodium|high-satfat|treat', '');
  p('Cheese Nachos', 'Doritos', 'Snacks', '100 g', 60, '🌽', 30, 3,
    [498, 7.2, 58.0, 3.6, 3.0, 26.0, 11.0, 690], 4, 32, 3.9,
    'Corn, vegetable oil, cheese seasoning, flavour enhancer (627,631), colour (160c)', 'vegetarian|ultra-processed|high-sodium|treat', 'milk');
  p('Multigrain Crackers', 'Britannia Nutrichoice', 'Snacks', '200 g', 85, '🍘', 25, 8,
    [440, 9.5, 66.0, 7.0, 12.0, 15.0, 6.5, 640], 4, 48, 4.0,
    'Whole wheat, oats, ragi, sugar, edible vegetable oil, salt, raising agents', 'vegetarian|high-fiber|ultra-processed', 'gluten');
  p('Digestive Biscuits', 'McVities', 'Snacks', '250 g', 90, '🍪', 25, 10,
    [478, 7.0, 62.0, 4.0, 17.5, 21.5, 10.0, 590], 4, 44, 4.1,
    'Whole wheat flour, sugar, palm oil, invert syrup, raising agents (500ii,503ii)', 'vegetarian|ultra-processed|high-sugar', 'gluten|milk');
  p('Marie Gold Biscuits', 'Britannia', 'Snacks', '250 g', 40, '🍪', 20, 12,
    [455, 7.2, 74.0, 2.0, 20.0, 14.0, 7.0, 480], 4, 46, 4.0,
    'Refined wheat flour, sugar, edible vegetable oil, invert syrup, milk solids', 'vegetarian|ultra-processed|high-sugar|budget-hero', 'gluten|milk');
  p('Aloo Bhujia', 'Haldirams', 'Snacks', '200 g', 55, '🍥', 30, 6,
    [540, 12.0, 48.0, 5.0, 2.0, 33.0, 14.0, 980], 4, 34, 4.2,
    'Gram flour, potato, edible vegetable oil, spices, salt', 'vegetarian|ultra-processed|high-sodium|treat', '');
  p('Roasted Makhana (Fox Nuts)', 'Farmley', 'Snacks', '150 g', 199, '🍿', 25, 6,
    [347, 9.7, 76.9, 14.5, 0.0, 0.1, 0.0, 60], 2, 74, 4.4,
    'Fox nuts, rock salt, sunflower oil', 'vegan|vegetarian|gluten-free|healthy-snack|high-fiber|low-fat|weight-loss', '');
  p('Popcorn, Lightly Salted', 'Act II', 'Snacks', '99 g', 45, '🍿', 30, 3,
    [387, 12.0, 78.0, 14.5, 0.5, 4.5, 1.0, 480], 3, 62, 4.0,
    'Corn kernels, salt, vegetable oil', 'vegetarian|whole-grain|high-fiber|healthy-snack|budget-hero', '');
  p('Baked Ragi Chips', 'Too Yumm', 'Snacks', '90 g', 50, '🍘', 30, 3,
    [420, 8.0, 68.0, 6.0, 4.0, 12.0, 5.0, 620], 4, 52, 3.9,
    'Ragi flour, rice flour, corn starch, palmolein oil, spices', 'vegetarian|baked-not-fried|ultra-processed', '');
  p('Protein Bar, Chocolate', 'Yogabar', 'Snacks', '60 g x 6', 599, '🍫', 60, 6,
    [383, 20.0, 42.0, 8.3, 16.7, 13.3, 4.5, 200], 4, 55, 4.2,
    'Whey protein, dates, almonds, oats, cocoa, chicory root fibre', 'vegetarian|high-protein|post-workout|convenient', 'milk|nuts');
  p('Methi Khakhra', 'Induben', 'Snacks', '200 g', 95, '🫓', 25, 8,
    [400, 11.0, 62.0, 8.0, 2.0, 11.0, 2.5, 520], 2, 70, 4.2,
    'Whole wheat flour, fenugreek, oil, spices', 'vegetarian|vegan|whole-grain|healthy-snack|baked-not-fried', 'gluten');

  /* --------------------------------------------------------- BEVERAGES */
  p('Cola Soft Drink', 'Coca-Cola', 'Beverages', '1.25 L', 70, '🥤', 250, 5,
    [42, 0.0, 10.6, 0.0, 10.6, 0.0, 0.0, 8], 4, 26, 4.0,
    'Carbonated water, sugar, acidity regulator (338), caffeine, caramel colour (150d)', 'vegetarian|high-sugar|ultra-processed|empty-calories|treat', '');
  p('Diet Cola, Zero Sugar', 'Coca-Cola', 'Beverages', '1.25 L', 75, '🥤', 250, 5,
    [0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 12], 4, 30, 3.9,
    'Carbonated water, acidity regulator (338), sweetener (951,950), caffeine, caramel colour', 'vegetarian|zero-sugar|ultra-processed|artificial-sweetener', '');
  p('Orange Juice, No Added Sugar', 'Tropicana', 'Beverages', '1 L', 145, '🧃', 200, 5,
    [45, 0.7, 10.4, 0.2, 9.9, 0.2, 0.0, 4], 3, 58, 4.1,
    'Orange juice from concentrate, vitamin C', 'vegetarian|vegan|no-added-sugar|vitamin-c', '');
  p('Mixed Fruit Juice', 'Real', 'Beverages', '1 L', 120, '🧃', 200, 5,
    [58, 0.2, 14.2, 0.1, 13.8, 0.1, 0.0, 10], 4, 44, 4.0,
    'Water, sugar, fruit pulp concentrate, acidity regulator (330), preservative (211)', 'vegetarian|high-sugar|ultra-processed', '');
  p('Green Tea Bags', 'Lipton', 'Beverages', '100 bags', 285, '🍵', 2, 100,
    [1, 0.0, 0.2, 0.0, 0.0, 0.0, 0.0, 1], 2, 76, 4.3,
    'Green tea leaves', 'vegan|vegetarian|gluten-free|zero-calorie|antioxidant|metabolism', '');
  p('Instant Coffee', 'Nescafe Classic', 'Beverages', '100 g', 375, '☕', 2, 50,
    [353, 12.2, 41.1, 0.0, 0.0, 0.5, 0.2, 37], 3, 60, 4.4,
    '100% pure coffee', 'vegan|vegetarian|gluten-free|zero-calorie|caffeine', '');
  p('Tender Coconut Water', 'Cocojal', 'Beverages', '1 L', 199, '🥥', 200, 5,
    [19, 0.7, 3.7, 1.1, 2.6, 0.2, 0.0, 105], 2, 72, 4.2,
    '100% tender coconut water', 'vegan|vegetarian|gluten-free|electrolytes|hydrating|natural|low-calorie', '');
  p('Energy Drink', 'Red Bull', 'Beverages', '250 ml', 125, '⚡', 250, 1,
    [45, 0.0, 11.0, 0.0, 11.0, 0.0, 0.0, 100], 4, 28, 3.9,
    'Water, sucrose, glucose, acidity regulator, taurine, caffeine, vitamins, colour', 'vegetarian|high-sugar|ultra-processed|caffeine', '');
  p('Buttermilk (Chaas)', 'Amul', 'Beverages', '1 L', 45, '🥛', 200, 5,
    [26, 1.6, 3.0, 0.0, 3.0, 0.8, 0.5, 210], 2, 78, 4.2,
    'Curd, water, salt, spices', 'vegetarian|gluten-free|probiotic|low-calorie|gut-health|budget-hero', 'milk');

  /* ------------------------------------------------- OILS & ESSENTIALS */
  p('Sunflower Oil', 'Fortune', 'Oils & Essentials', '1 L', 145, '🫗', 10, 100,
    [900, 0.0, 0.0, 0.0, 0.0, 100.0, 11.0, 0], 3, 50, 4.2,
    'Refined sunflower oil, antioxidant (319)', 'vegan|vegetarian|gluten-free|cooking|budget-hero', '');
  p('Extra Virgin Olive Oil', 'Borges', 'Oils & Essentials', '500 ml', 549, '🫒', 10, 50,
    [884, 0.0, 0.0, 0.0, 0.0, 100.0, 13.8, 2], 1, 64, 4.5,
    'Cold pressed extra virgin olive oil', 'vegan|vegetarian|gluten-free|heart-healthy|premium|healthy-fats', '');
  p('Kachi Ghani Mustard Oil', 'Fortune', 'Oils & Essentials', '1 L', 175, '🫗', 10, 100,
    [884, 0.0, 0.0, 0.0, 0.0, 100.0, 11.6, 0], 2, 68, 4.3,
    'Cold pressed mustard oil', 'vegan|vegetarian|gluten-free|omega-3|traditional|cooking', '');
  p('Virgin Coconut Oil', 'Max Care', 'Oils & Essentials', '500 ml', 385, '🥥', 10, 50,
    [892, 0.0, 0.0, 0.0, 0.0, 99.0, 82.0, 0], 1, 60, 4.3,
    'Cold pressed virgin coconut oil', 'vegan|vegetarian|gluten-free|keto|high-satfat', '');
  p('Iodised Salt', 'Tata', 'Oils & Essentials', '1 kg', 28, '🧂', 5, 200,
    [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 38700], 2, 80, 4.5,
    'Refined iodised salt', 'vegan|vegetarian|gluten-free|essential|budget-hero', '');
  p('Refined Sugar', 'Madhur', 'Oils & Essentials', '1 kg', 52, '🍬', 10, 100,
    [387, 0.0, 100.0, 0.0, 100.0, 0.0, 0.0, 1], 3, 56, 4.2,
    'Refined sugar', 'vegan|vegetarian|gluten-free|high-sugar|empty-calories', '');
  p('Organic Jaggery Powder', '24 Mantra', 'Oils & Essentials', '500 g', 118, '🟤', 10, 50,
    [383, 0.4, 98.0, 0.0, 95.0, 0.1, 0.0, 30], 2, 76, 4.3,
    'Organic sugarcane jaggery', 'vegan|vegetarian|gluten-free|natural-sweetener|iron-rich|high-sugar', '');
  p('Turmeric Powder', 'Tata Sampann', 'Oils & Essentials', '200 g', 78, '🟡', 3, 66,
    [354, 7.8, 64.9, 21.1, 3.2, 9.9, 3.1, 38], 2, 84, 4.5,
    '100% turmeric', 'vegan|vegetarian|gluten-free|anti-inflammatory|antioxidant|essential', '');

  /* ------------------------------------------------ FROZEN & READY EAT */
  p('Frozen Green Peas', 'Safal', 'Frozen & Ready', '500 g', 105, '🫛', 100, 5,
    [81, 5.4, 14.5, 5.1, 5.7, 0.4, 0.1, 5], 2, 74, 4.3,
    'Green peas', 'vegan|vegetarian|gluten-free|high-fiber|protein|convenient', '');
  p('Frozen Mixed Vegetables', 'Safal', 'Frozen & Ready', '500 g', 115, '🥕', 100, 5,
    [65, 3.0, 12.0, 4.0, 4.0, 0.4, 0.1, 30], 2, 72, 4.1,
    'Carrot, peas, beans, corn', 'vegan|vegetarian|gluten-free|convenient|high-fiber', '');
  p('Frozen French Fries', 'McCain', 'Frozen & Ready', '750 g', 179, '🍟', 100, 7,
    [175, 2.5, 27.0, 2.5, 0.4, 6.0, 2.8, 320], 4, 42, 4.0,
    'Potato, palm oil, dextrose, salt, stabiliser (450)', 'vegetarian|ultra-processed|convenient|treat', '');
  p('Instant Noodles Masala', 'Maggi', 'Frozen & Ready', '70 g x 4', 56, '🍜', 70, 4,
    [420, 9.0, 60.0, 3.0, 4.0, 16.0, 8.0, 1450], 4, 36, 4.3,
    'Refined wheat flour, palm oil, salt, tastemaker (spices, hydrolysed vegetable protein, flavour enhancer 635)', 'vegetarian|ultra-processed|high-sodium|high-satfat|convenient|budget-hero', 'gluten');
  p('Ready-to-Eat Rajma Chawal', 'MTR', 'Frozen & Ready', '300 g', 115, '🍛', 300, 1,
    [128, 4.6, 20.0, 3.4, 1.8, 3.3, 1.2, 380], 4, 46, 3.9,
    'Rice, kidney beans, onion, tomato, oil, spices, salt', 'vegetarian|convenient|ultra-processed', '');
  p('Frozen Whole Wheat Paratha', 'ID Fresh', 'Frozen & Ready', '5 pcs', 99, '🫓', 80, 5,
    [290, 7.0, 44.0, 4.0, 2.0, 9.5, 4.4, 420], 3, 58, 4.2,
    'Whole wheat flour, water, palm oil, salt', 'vegetarian|vegan|convenient|whole-grain', 'gluten');
  p('Veg Nuggets, Frozen', 'McCain', 'Frozen & Ready', '400 g', 199, '🍗', 100, 4,
    [230, 5.0, 28.0, 3.0, 1.5, 11.0, 5.0, 620], 4, 40, 3.8,
    'Potato, vegetables, wheat flour, palm oil, spices, stabilisers', 'vegetarian|ultra-processed|convenient', 'gluten');

  /* ------------------------------------------------ SWEETS & DESSERTS */
  p('Dark Chocolate 70% Cocoa', 'Lindt', 'Sweets & Desserts', '100 g', 325, '🍫', 20, 5,
    [566, 9.4, 34.0, 11.0, 24.0, 41.0, 25.0, 20], 3, 50, 4.6,
    'Cocoa mass, sugar, cocoa butter, vanilla', 'vegetarian|antioxidant|treat|high-satfat', 'milk|soy');
  p('Milk Chocolate Bar', 'Cadbury Dairy Milk', 'Sweets & Desserts', '150 g', 160, '🍫', 20, 7,
    [534, 7.0, 58.0, 2.1, 56.0, 30.0, 18.0, 90], 4, 38, 4.4,
    'Sugar, milk solids, cocoa butter, cocoa solids, emulsifier (442,476)', 'vegetarian|high-sugar|ultra-processed|treat', 'milk|soy');
  p('Vanilla Ice Cream Tub', 'Amul', 'Sweets & Desserts', '700 ml', 199, '🍨', 100, 7,
    [207, 3.5, 24.0, 0.5, 22.0, 11.0, 7.0, 80], 4, 40, 4.2,
    'Milk solids, sugar, liquid glucose, stabiliser (471,466), flavour', 'vegetarian|high-sugar|ultra-processed|treat', 'milk');
  p('Sugar-Free Digestive Cookies', 'Sugarfree', 'Sweets & Desserts', '150 g', 120, '🍪', 20, 7,
    [450, 8.0, 62.0, 6.0, 1.0, 19.0, 8.0, 420], 4, 46, 3.9,
    'Whole wheat flour, edible vegetable oil, maltitol, oats, raising agents', 'vegetarian|diabetic-friendly|no-added-sugar|ultra-processed', 'gluten|milk');
  p('Gulab Jamun (Ready)', 'Haldirams', 'Sweets & Desserts', '500 g', 185, '🍡', 60, 8,
    [320, 4.0, 52.0, 0.5, 45.0, 11.0, 6.5, 60], 4, 42, 4.3,
    'Sugar, milk solids, refined wheat flour, edible vegetable oil', 'vegetarian|high-sugar|ultra-processed|festive|treat', 'milk|gluten');

  /* ------------------------------------------- HEALTH & SUPPLEMENTS */
  p('Whey Protein Isolate', 'MyProtein', 'Health & Supplements', '1 kg', 2799, '💪', 30, 33,
    [373, 88.0, 2.0, 0.0, 1.5, 0.6, 0.3, 300], 4, 45, 4.5,
    'Whey protein isolate, emulsifier (soy lecithin)', 'vegetarian|gluten-free|high-protein|muscle-gain|post-workout|keto', 'milk|soy');
  p('Plant Protein (Pea + Rice)', 'Origin Nutrition', 'Health & Supplements', '500 g', 1499, '🌱', 33, 15,
    [380, 75.0, 8.0, 4.0, 2.0, 5.0, 1.0, 420], 4, 62, 4.3,
    'Pea protein, brown rice protein, cocoa, stevia', 'vegan|vegetarian|gluten-free|dairy-free|high-protein|muscle-gain|post-workout', '');
  p('Multivitamin Tablets', 'Centrum', 'Health & Supplements', '60 tablets', 799, '💊', 1, 60,
    [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0], 4, 50, 4.3,
    'Vitamins A, C, D, E, K, B-complex, minerals', 'vegetarian|supplement|micronutrients', '');
  p('Vitamin D3 60K', 'HealthKart', 'Health & Supplements', '30 capsules', 449, '💊', 1, 30,
    [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0], 4, 52, 4.2,
    'Cholecalciferol 60000 IU', 'vegetarian|supplement|bone-health', '');
  p('Omega-3 Fish Oil', 'HealthKart', 'Health & Supplements', '60 capsules', 599, '💊', 1, 60,
    [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0], 4, 48, 4.3,
    'Fish oil 1000 mg (EPA 180, DHA 120)', 'non-vegetarian|supplement|omega-3|heart-healthy|brain-health', 'fish');
  p('Psyllium Husk (Isabgol)', 'Dabur', 'Health & Supplements', '200 g', 195, '🌾', 5, 40,
    [200, 2.0, 88.0, 80.0, 0.0, 0.5, 0.1, 30], 2, 78, 4.4,
    '100% psyllium husk', 'vegan|vegetarian|gluten-free|high-fiber|gut-health|digestive', '');
  p('Electrolyte Hydration Tablets', 'Fast&Up', 'Health & Supplements', '20 tablets', 549, '⚡', 4, 20,
    [120, 0.0, 25.0, 0.0, 12.0, 0.0, 0.0, 6500], 4, 50, 4.2,
    'Sodium, potassium, magnesium, calcium, vitamin C, sweetener', 'vegetarian|supplement|electrolytes|post-workout|high-sodium', '');
  p('Apple Cider Vinegar with Mother', 'Wow', 'Health & Supplements', '750 ml', 399, '🍎', 15, 50,
    [22, 0.0, 0.9, 0.0, 0.4, 0.0, 0.0, 5], 2, 66, 4.0,
    'Raw unfiltered apple cider vinegar with mother', 'vegan|vegetarian|gluten-free|metabolism|low-calorie', '');

  /* ------------------------------------------------------------ STORES */
  var STORES = [
    { id: 'freshmart',   name: 'FreshMart',          mult: 1.00, icon: '🏬', delivery: 'Same day • ₹29 fee',       note: 'Balanced pricing, widest range' },
    { id: 'valuebazaar', name: 'Value Bazaar',       mult: 0.89, icon: '🏷️', delivery: 'Next day • Free over ₹499', note: 'Cheapest for staples and bulk buys' },
    { id: 'greenleaf',   name: 'GreenLeaf Organics', mult: 1.18, icon: '🌿', delivery: '2 days • Free over ₹999',   note: 'Organic and premium quality' },
    { id: 'quickcart',   name: 'QuickCart 10min',    mult: 1.08, icon: '⚡', delivery: '10 minutes • ₹35 fee',      note: 'Instant delivery, small premium' }
  ];

  function hashCode(str) {
    var h = 0, i;
    for (i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  CATALOG.forEach(function (prod) {
    prod.storePrices = {};
    STORES.forEach(function (st) {
      var jitter = ((hashCode(prod.id + st.id) % 11) - 5) / 100; // -5% .. +5%
      prod.storePrices[st.id] = Math.max(5, Math.round(prod.price * st.mult * (1 + jitter)));
    });
    prod.price = prod.storePrices.freshmart;
    prod.pricePerServing = +(prod.price / prod.servings).toFixed(2);
    prod.netWeightG = prod.servingG * prod.servings;
    prod.pricePer100g = +(prod.price / (prod.netWeightG / 100)).toFixed(2);
  });

  /* -------------------------------------------------------- DIET RULES */
  var DIETS = {
    'none':         { label: 'No restriction',      icon: '🍽️' },
    'vegetarian':   { label: 'Vegetarian',          icon: '🥗', excludeTags: ['non-vegetarian', 'vegetarian-eggetarian'] },
    'eggetarian':   { label: 'Eggetarian',          icon: '🥚', excludeTags: ['non-vegetarian'] },
    'vegan':        { label: 'Vegan',               icon: '🌱', requireTags: ['vegan'] },
    'pescatarian':  { label: 'Pescatarian',         icon: '🐟', excludeTags: ['non-vegetarian'], allowIfTags: ['pescatarian'] },
    'keto':         { label: 'Keto / low-carb',     icon: '🥑', maxCarb100: 15 },
    'diabetic':     { label: 'Diabetic friendly',   icon: '🩺', maxSugar100: 12 },
    'gluten-free':  { label: 'Gluten free',         icon: '🌾', excludeAllergens: ['gluten'] },
    'lactose-free': { label: 'Lactose free',        icon: '🥛', excludeAllergens: ['milk'] },
    'jain':         { label: 'Jain',                icon: '🙏', excludeTags: ['non-vegetarian', 'vegetarian-eggetarian'], excludeNames: ['Onion', 'Potato', 'Garlic', 'Beetroot', 'Carrot', 'Sweet Potato'] }
  };

  var GOALS = {
    'balanced':    { label: 'Stay balanced',      icon: '⚖️', desc: 'Well-rounded nutrition without extremes' },
    'weight-loss': { label: 'Lose weight',        icon: '📉', desc: 'Calorie deficit, high satiety and fibre' },
    'muscle-gain': { label: 'Build muscle',       icon: '💪', desc: 'High protein with a calorie surplus' },
    'heart':       { label: 'Heart health',       icon: '❤️', desc: 'Low sodium, low saturated fat, omega-3' },
    'diabetes':    { label: 'Blood sugar control',icon: '🩺', desc: 'Low sugar, low GI, high fibre' },
    'energy':      { label: 'More energy',        icon: '⚡', desc: 'Complex carbs, iron and B-vitamins' },
    'gut':         { label: 'Gut health',         icon: '🦠', desc: 'Fibre, probiotics and fermented foods' },
    'budget':      { label: 'Maximise savings',   icon: '💰', desc: 'Best possible nutrition per rupee' }
  };

  var ALLERGENS = ['milk', 'egg', 'gluten', 'soy', 'nuts', 'peanuts', 'fish', 'shellfish'];

  var CATEGORY_META = {
    'Fruits':               { icon: '🍎', color: '#f97066', essential: true,  weight: 0.11 },
    'Vegetables':           { icon: '🥦', color: '#3ccf7f', essential: true,  weight: 0.16 },
    'Grains & Cereals':     { icon: '🌾', color: '#f0b429', essential: true,  weight: 0.14 },
    'Pulses & Legumes':     { icon: '🫘', color: '#c084fc', essential: true,  weight: 0.12 },
    'Dairy & Eggs':         { icon: '🥛', color: '#60a5fa', essential: true,  weight: 0.14 },
    'Meat & Seafood':       { icon: '🍗', color: '#fb7185', essential: false, weight: 0.08 },
    'Nuts & Seeds':         { icon: '🌰', color: '#d97706', essential: false, weight: 0.06 },
    'Breakfast & Spreads':  { icon: '🍯', color: '#fbbf24', essential: false, weight: 0.04 },
    'Bakery':               { icon: '🍞', color: '#e5a663', essential: false, weight: 0.04 },
    'Snacks':               { icon: '🍪', color: '#f472b6', essential: false, weight: 0.03 },
    'Beverages':            { icon: '🥤', color: '#38bdf8', essential: false, weight: 0.03 },
    'Oils & Essentials':    { icon: '🫗', color: '#a3a3a3', essential: true,  weight: 0.05 },
    'Frozen & Ready':       { icon: '🧊', color: '#7dd3fc', essential: false, weight: 0.02 },
    'Sweets & Desserts':    { icon: '🍫', color: '#a78bfa', essential: false, weight: 0.01 },
    'Health & Supplements': { icon: '💊', color: '#34d399', essential: false, weight: 0.02 }
  };

  /* Offline additive knowledge base used by the Label Decoder */
  var ADDITIVE_DB = {
    '102':   { name: 'Tartrazine', risk: 'caution', note: 'Synthetic yellow colour linked to hyperactivity in sensitive children.' },
    '110':   { name: 'Sunset Yellow FCF', risk: 'caution', note: 'Azo dye that carries a warning label in the EU.' },
    '150d':  { name: 'Sulphite Ammonia Caramel', risk: 'caution', note: 'Caramel colour that may contain traces of 4-MEI.' },
    '160c':  { name: 'Paprika Extract', risk: 'ok', note: 'Natural colour from paprika.' },
    '200':   { name: 'Sorbic Acid', risk: 'ok', note: 'Widely used preservative, generally well tolerated.' },
    '211':   { name: 'Sodium Benzoate', risk: 'caution', note: 'Preservative; combined with vitamin C it can form traces of benzene.' },
    '223':   { name: 'Sodium Metabisulphite', risk: 'caution', note: 'Sulphite preservative that can trigger asthma in sensitive people.' },
    '260':   { name: 'Acetic Acid', risk: 'ok', note: 'Vinegar acid used as an acidity regulator.' },
    '282':   { name: 'Calcium Propionate', risk: 'caution', note: 'Mould inhibitor in bread; some reports of behavioural sensitivity.' },
    '319':   { name: 'TBHQ', risk: 'caution', note: 'Synthetic antioxidant common in fried snacks; strict intake limits apply.' },
    '320':   { name: 'BHA', risk: 'avoid', note: 'Synthetic antioxidant classified as possibly carcinogenic by IARC.' },
    '330':   { name: 'Citric Acid', risk: 'ok', note: 'Common acidity regulator, considered safe.' },
    '338':   { name: 'Phosphoric Acid', risk: 'caution', note: 'Acidifier in colas; high intake is associated with lower bone density.' },
    '407':   { name: 'Carrageenan', risk: 'caution', note: 'Thickener that may irritate the gut in some individuals.' },
    '415':   { name: 'Xanthan Gum', risk: 'ok', note: 'Common thickener, generally well tolerated.' },
    '442':   { name: 'Ammonium Phosphatides', risk: 'ok', note: 'Emulsifier used in chocolate.' },
    '450':   { name: 'Diphosphates', risk: 'ok', note: 'Raising and stabilising agent; adds to phosphate load.' },
    '466':   { name: 'Carboxymethyl Cellulose', risk: 'caution', note: 'Emulsifier with emerging research on gut microbiome effects.' },
    '471':   { name: 'Mono and Diglycerides', risk: 'ok', note: 'Fat based emulsifier; may be animal derived.' },
    '472e':  { name: 'DATEM', risk: 'ok', note: 'Dough conditioner used in bread.' },
    '476':   { name: 'PGPR', risk: 'ok', note: 'Emulsifier used to reduce cocoa butter in chocolate.' },
    '500ii': { name: 'Sodium Bicarbonate', risk: 'ok', note: 'Baking soda, a harmless raising agent.' },
    '621':   { name: 'Monosodium Glutamate (MSG)', risk: 'caution', note: 'Flavour enhancer; some people report headaches.' },
    '627':   { name: 'Disodium Guanylate', risk: 'caution', note: 'Flavour enhancer, usually paired with MSG.' },
    '631':   { name: 'Disodium Inosinate', risk: 'caution', note: 'Flavour enhancer, usually paired with MSG.' },
    '635':   { name: 'Disodium Ribonucleotides', risk: 'caution', note: 'Flavour enhancer; best avoided with gout sensitivity.' },
    '950':   { name: 'Acesulfame K', risk: 'caution', note: 'Artificial sweetener with debated long term data.' },
    '951':   { name: 'Aspartame', risk: 'caution', note: 'Artificial sweetener, unsafe for people with PKU.' },
    '955':   { name: 'Sucralose', risk: 'caution', note: 'Artificial sweetener that may affect gut flora.' },
    '960':   { name: 'Steviol Glycosides', risk: 'ok', note: 'Plant derived sweetener considered safe.' }
  };

  var SUGAR_ALIASES = ['sugar', 'invert syrup', 'liquid glucose', 'glucose syrup', 'fructose', 'maltodextrin',
    'dextrose', 'corn syrup', 'molasses', 'cane juice', 'maltose', 'sucrose', 'treacle', 'golden syrup', 'honey'];

  var FALLBACK_MEALS = {
    breakfast: ['Masala oats with vegetables', 'Vegetable poha with peanuts', 'Besan chilla with curd',
      'Ragi porridge with banana', 'Egg bhurji with whole wheat toast', 'Greek yogurt bowl with fruit and seeds',
      'Idli with sambar', 'Multigrain toast with peanut butter'],
    lunch: ['Dal, brown rice, sabzi and salad', 'Rajma chawal with cucumber raita',
      'Roti, paneer bhurji and green salad', 'Chana masala with multigrain roti',
      'Grilled chicken, quinoa and stir fried vegetables', 'Khichdi with curd', 'Fish curry with rice'],
    snack: ['Roasted makhana with green tea', 'Fruit bowl with pumpkin seeds', 'Sprouts chaat',
      'Buttermilk with roasted chana', 'Apple with peanut butter', 'Boiled eggs with black pepper'],
    dinner: ['Moong dal soup with sauteed vegetables', 'Vegetable pulao with raita',
      'Grilled paneer or tofu salad', 'Roti with mixed vegetable curry', 'Chicken stew with vegetables',
      'Tomato soup with multigrain toast', 'Palak dal with jowar roti']
  };

  global.GA_DATA = {
    CATALOG: CATALOG,
    STORES: STORES,
    DIETS: DIETS,
    GOALS: GOALS,
    ALLERGENS: ALLERGENS,
    CATEGORY_META: CATEGORY_META,
    ADDITIVE_DB: ADDITIVE_DB,
    SUGAR_ALIASES: SUGAR_ALIASES,
    FALLBACK_MEALS: FALLBACK_MEALS,
    categories: Object.keys(CATEGORY_META),
    byId: function (id) { return CATALOG.find(function (x) { return x.id === id; }); }
  };
})(window);
