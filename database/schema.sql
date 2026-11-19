-- Enterprise Service Management & Workflow Automation Portal
-- MySQL 8.x schema
CREATE DATABASE IF NOT EXISTS service_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE service_portal;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, notifications, request_comments, request_attachments,
  request_assignments, service_requests, users, departments;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee','agent') NOT NULL DEFAULT 'employee',
  department_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_users_role_dept (role, department_id)
) ENGINE=InnoDB;

CREATE TABLE service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_no VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  department_id INT NOT NULL,
  category VARCHAR(60) NOT NULL,
  priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status ENUM('open','assigned','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  created_by INT NOT NULL,
  assigned_to INT NULL,
  due_date DATETIME NULL,
  is_overdue TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_department FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_req_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_req_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_req_status (status),
  INDEX idx_req_priority (priority),
  INDEX idx_req_dept (department_id),
  INDEX idx_req_creator (created_by),
  INDEX idx_req_assignee (assigned_to),
  INDEX idx_req_due (due_date),
  INDEX idx_req_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE request_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  assigned_to INT NOT NULL,
  assigned_by INT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asg_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_asg_to FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT fk_asg_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_asg_request (request_id)
) ENGINE=InnoDB;

CREATE TABLE request_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NULL,
  size_bytes INT NOT NULL,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_att_request (request_id)
) ENGINE=InnoDB;

CREATE TABLE request_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_com_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_com_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_com_request (request_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  request_id INT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_not_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_not_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  INDEX idx_not_user_read (user_id, is_read)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NULL,
  user_id INT NULL,
  action VARCHAR(40) NOT NULL,
  old_value VARCHAR(255) NULL,
  new_value VARCHAR(255) NULL,
  details VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aud_request FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_aud_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_aud_request (request_id, created_at)
) ENGINE=InnoDB;
