-- 快递公司表
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('resident', 'courier', 'admin')),
  company_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 包裹表
CREATE TABLE packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_no VARCHAR(100) NOT NULL,
  pickup_code VARCHAR(6) NOT NULL UNIQUE,
  phone_suffix VARCHAR(4) NOT NULL,
  company_id INTEGER NOT NULL,
  locker_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'returned', 'expired')),
  courier_id INTEGER NOT NULL,
  resident_id INTEGER,
  stored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  picked_at DATETIME,
  last_reminder_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (courier_id) REFERENCES users(id),
  FOREIGN KEY (resident_id) REFERENCES users(id)
);

-- 格口表
CREATE TABLE lockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE,
  zone VARCHAR(50) NOT NULL,
  size VARCHAR(20) NOT NULL CHECK (size IN ('small', 'medium', 'large')),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  current_package_id INTEGER,
  FOREIGN KEY (current_package_id) REFERENCES packages(id)
);

-- 预约表
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER NOT NULL,
  item_description TEXT,
  item_size VARCHAR(20) NOT NULL CHECK (item_size IN ('medium', 'large', 'xlarge')),
  expected_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  locker_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES users(id),
  FOREIGN KEY (locker_id) REFERENCES lockers(id)
);

-- 操作日志表
CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('store', 'pickup', 'reminder', 'return', 'expire')),
  operator_id INTEGER,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- 通知表
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pickup', 'reminder', 'return', 'reservation', 'system')),
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  package_id INTEGER,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (package_id) REFERENCES packages(id)
);

-- 索引
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_pickup_code ON packages(pickup_code);
CREATE INDEX idx_packages_stored_at ON packages(stored_at);
CREATE INDEX idx_packages_courier_id ON packages(courier_id);
CREATE INDEX idx_packages_phone_suffix ON packages(phone_suffix);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, read);
CREATE INDEX idx_operation_logs_package_id ON operation_logs(package_id);
CREATE INDEX idx_reservations_resident_id ON reservations(resident_id);

-- 初始化数据
INSERT INTO companies (name, code) VALUES 
('顺丰速运', 'SF'),
('京东物流', 'JD'),
('中通快递', 'ZT'),
('圆通速递', 'YT'),
('申通快递', 'ST'),
('韵达快递', 'YD'),
('邮政EMS', 'EMS');

INSERT INTO users (phone, name, role, company_id, status) VALUES 
('13800000000', '系统管理员', 'admin', NULL, 'active'),
('13800000001', '张三', 'resident', NULL, 'active'),
('13800000002', '李四', 'resident', NULL, 'active'),
('13800000003', '王快递', 'courier', 1, 'active');

INSERT INTO lockers (code, zone, size, status) VALUES 
('A01', 'A区', 'small', 'available'),
('A02', 'A区', 'small', 'available'),
('A03', 'A区', 'small', 'available'),
('A04', 'A区', 'medium', 'available'),
('A05', 'A区', 'medium', 'available'),
('A06', 'A区', 'large', 'available'),
('B01', 'B区', 'small', 'available'),
('B02', 'B区', 'small', 'available'),
('B03', 'B区', 'medium', 'available'),
('B04', 'B区', 'medium', 'available'),
('B05', 'B区', 'large', 'available'),
('B06', 'B区', 'large', 'available'),
('C01', 'C区', 'large', 'available'),
('C02', 'C区', 'large', 'available');
