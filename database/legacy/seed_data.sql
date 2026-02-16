-- Default System Settings
INSERT INTO settings (key_name, value, description) VALUES 
('currency_symbol', 'SAR', 'The currency symbol used across the system (e.g., SAR, LE, $).'),
('points_ratio', '10', 'How much currency spend equals 1 point (e.g., 10 means 10 SAR = 1 point).'),
('company_name', 'NFC Discount System', 'The name of the company displayed in the UI.');

-- Default Tiers (Loyalty Levels)
INSERT INTO tiers (name, min_points, multiplier) VALUES 
('Bronze', 0, 1.00),
('Silver', 500, 1.10),
('Gold', 1500, 1.25);

-- Sample Discounts (Rewards)
INSERT INTO discounts (name, type, value, points_required, description) VALUES 
('Welcome Discount', 'percentage', 10.00, 0, '10% off for first-time scans.'),
('Silver Reward', 'fixed_amount', 50.00, 200, '50 SAR off for 200 points.'),
('Gold Gift', 'gift', 0.00, 500, 'Free gift for 500 points.');

-- Seed Branches
INSERT INTO branches (name, location) VALUES 
('الفرع الرئيسي', 'الرياض'),
('فرع جدة', 'جدة');

-- Seed Terminals
INSERT INTO terminals (branch_id, name, connection_url) VALUES 
(1, 'كاشير 1 (محلي)', '127.0.0.1'),
(1, 'كاشير 2 (عن بعد)', 'wss://nfc-br1.trycloudflare.com'),
(2, 'كاشير جدة 1', 'wss://nfc-br2.trycloudflare.com');
