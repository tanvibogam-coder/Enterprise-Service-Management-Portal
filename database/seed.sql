-- Sample seed data. All demo accounts use the password: Password@123
USE service_portal;

INSERT INTO departments (id, name, description) VALUES
 (1,'IT Support','Laptops, software, network and access issues'),
 (2,'HR','Leave, payroll, policy and onboarding'),
 (3,'Administration','Facilities, stationery and travel'),
 (4,'Infrastructure','Servers, cloud, VPN and backups');

INSERT INTO users (id, name, email, password_hash, role, department_id) VALUES
 (1,'Aarav Admin','admin@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','admin',NULL),
 (2,'Isha Agent','agent.it@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','agent',1),
 (3,'Rohan Agent','agent.it2@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','agent',1),
 (4,'Neha Agent','agent.hr@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','agent',2),
 (5,'Sameer Agent','agent.admin@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','agent',3),
 (6,'Kiran Agent','agent.infra@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','agent',4),
 (7,'Tanvi Employee','employee@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','employee',NULL),
 (8,'Vikram Employee','employee2@company.com','$2a$10$kYaaN8iPwjSwG1t70GaDMud4CKLvRTtKMCn3KMUNptlgxlXCOcqI6','employee',NULL);

INSERT INTO service_requests (id, request_no, title, description, department_id, category, priority, status, created_by, assigned_to, due_date, is_overdue, resolved_at, closed_at, created_at) VALUES
 (1,'REQ-2026-00001','Laptop not booting','My laptop shows a black screen after the logo.',1,'Hardware','high','in_progress',7,2,DATE_ADD(NOW(), INTERVAL 20 HOUR),0,NULL,NULL,DATE_SUB(NOW(), INTERVAL 4 HOUR)),
 (2,'REQ-2026-00002','VPN access for remote work','Need VPN profile created for WFH.',4,'Access','medium',  'assigned',7,6,DATE_ADD(NOW(), INTERVAL 2 DAY),0,NULL,NULL,DATE_SUB(NOW(), INTERVAL 1 DAY)),
 (3,'REQ-2026-00003','Salary slip correction','October slip shows wrong HRA amount.',2,'Payroll','high','resolved',8,4,DATE_SUB(NOW(), INTERVAL 1 DAY),0,DATE_SUB(NOW(), INTERVAL 2 DAY),NULL,DATE_SUB(NOW(), INTERVAL 5 DAY)),
 (4,'REQ-2026-00004','Air conditioning not working','Conference room 2 AC is not cooling.',3,'Facilities','medium','open',8,NULL,DATE_SUB(NOW(), INTERVAL 6 HOUR),1,NULL,NULL,DATE_SUB(NOW(), INTERVAL 3 DAY)),
 (5,'REQ-2026-00005','Install Docker on workstation','Need Docker Desktop for the new project.',1,'Software','low','closed',7,3,DATE_SUB(NOW(), INTERVAL 5 DAY),0,DATE_SUB(NOW(), INTERVAL 7 DAY),DATE_SUB(NOW(), INTERVAL 6 DAY),DATE_SUB(NOW(), INTERVAL 10 DAY)),
 (6,'REQ-2026-00006','Production server disk 90% full','Disk usage alert on app-server-02.',4,'Server','critical','assigned',8,6,DATE_ADD(NOW(), INTERVAL 3 HOUR),0,NULL,NULL,DATE_SUB(NOW(), INTERVAL 1 HOUR));

INSERT INTO request_assignments (request_id, assigned_to, assigned_by, note) VALUES
 (1,2,1,'Auto-assigned (lowest workload)'),(2,6,1,'Auto-assigned (lowest workload)'),(3,4,1,'Auto-assigned (lowest workload)'),
 (5,3,1,'Auto-assigned (lowest workload)'),(6,6,1,'Auto-assigned (lowest workload)');

INSERT INTO request_comments (request_id, user_id, comment) VALUES
 (1,2,'Picked this up. Will check the SSD and RAM first.'),
 (1,7,'Thanks. The laptop is at my desk (floor 3).');

INSERT INTO audit_logs (request_id, user_id, action, old_value, new_value, details) VALUES
 (1,7,'created',NULL,'open','Request created'),
 (1,1,'assigned',NULL,'Isha Agent','Auto-assigned (lowest workload)'),
 (1,2,'status_changed','assigned','in_progress',NULL),
 (3,4,'status_changed','in_progress','resolved',NULL),
 (5,7,'status_changed','resolved','closed',NULL);

INSERT INTO notifications (user_id, request_id, type, message, is_read) VALUES
 (2,1,'assigned','Request REQ-2026-00001 was assigned to you',1),
 (6,6,'assigned','Request REQ-2026-00006 was assigned to you',0),
 (8,3,'status','Request REQ-2026-00003 is now Resolved',0);
