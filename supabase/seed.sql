-- Palm Bite drink menu.
-- Edit drinks, photos, descriptions and options any time in Admin > Drinks menu.

insert into public.drinks (name, category, accent_color, sort_order, is_reward_eligible, is_sample) values
  ('Palms Frappuccino',      'Drinks', '#8B6A4F', 10, true, false),
  ('Mint Tea',               'Drinks', '#8FBF8A', 20, true, false),
  ('Melis',                  'Drinks', '#C9A27E', 30, true, false),
  ('Crips Love',             'Drinks', '#D98C8C', 40, true, false),
  ('Matcha',                 'Drinks', '#9DB27C', 50, true, false),
  ('Espresso',               'Drinks', '#5A3E2B', 60, true, false),
  ('Caramel Velvet Latte',   'Drinks', '#C68B59', 70, true, false),
  ('Caramel Velvet Matcha',  'Drinks', '#A8B47A', 80, true, false),
  ('Our Latte',              'Drinks', '#D2B48C', 90, true, false),
  ('Hibiscus Juice',         'Juices', '#A63A50', 110, true, false),
  ('Pineapple Juice',        'Juices', '#E8C547', 120, true, false),
  ('Apple Juice',            'Juices', '#C9D86A', 130, true, false),
  ('Watermelon Juice',       'Juices', '#E86A6A', 140, true, false);
