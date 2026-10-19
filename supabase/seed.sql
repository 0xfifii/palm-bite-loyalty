-- Development sample drinks.
-- These are clearly marked samples (is_sample = true, shown with a "Sample"
-- label in the app). They are NOT Palm Bite's real menu. Replace them from the
-- admin Drinks screen once the real menu and photography are available.

insert into public.drinks (name, description, category, image_url, accent_color, is_sample, sort_order, customization)
values
  ('Sample Iced Matcha Latte', 'Placeholder description. Replace with Palm Bite menu copy.', 'Matcha', null, '#9DB27C', true, 10,
   '[{"name":"Milk","options":["Whole","Skim","Oat"],"multi":false},{"name":"Sweetener","options":["Honey","Agave","None"],"multi":false}]'),
  ('Sample Iced Coffee', 'Placeholder description. Replace with Palm Bite menu copy.', 'Coffee', null, '#B08A6B', true, 20,
   '[{"name":"Milk","options":["Whole","Oat","None"],"multi":false},{"name":"Extras","options":["Extra shot","Vanilla"],"multi":true}]'),
  ('Sample Peach Iced Tea', 'Placeholder description. Replace with Palm Bite menu copy.', 'Tea', null, '#E9B08F', true, 30,
   '[{"name":"Sweetness","options":["Regular","Less sweet","Unsweetened"],"multi":false}]'),
  ('Sample Berry Smoothie', 'Placeholder description. Replace with Palm Bite menu copy.', 'Smoothies', null, '#B5677D', true, 40,
   '[]'),
  ('Sample Tropical Juice', 'Placeholder description. Replace with Palm Bite menu copy.', 'Juice', null, '#E8B54D', true, 50,
   '[]'),
  ('Sample Hot Chocolate', 'Placeholder description. Not reward eligible in this sample data.', 'Hot drinks', null, '#7A5240', true, 60,
   '[]');

update public.drinks set is_reward_eligible = false where name = 'Sample Hot Chocolate';
