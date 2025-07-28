-- Truncate all tables in the correct order (respecting foreign key constraints)
TRUNCATE TABLE devconnect.applications CASCADE;
TRUNCATE TABLE devconnect.feedback CASCADE;
TRUNCATE TABLE devconnect.jobs CASCADE;
TRUNCATE TABLE devconnect.interviewers CASCADE;
TRUNCATE TABLE devconnect.companies CASCADE;
TRUNCATE TABLE devconnect.users CASCADE;
TRUNCATE TABLE devconnect.accounts CASCADE;

-- Insert accounts data
INSERT INTO devconnect.accounts (id, email, password_hash, account_type, is_active, created_at) VALUES
(9, 'test@user.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-04 08:25:03.942979'),
(10, 'company@test.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-04 08:25:03.942979'),
(11, 'hr@techstart.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-04 08:40:43.388545'),
(12, 'recruiter@innovate.io', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-04 08:40:43.388545'),
(13, 'jobs@datascience.ai', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-04 08:40:43.388545'),
(14, 'talent@fintech.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-04 08:40:43.388545'),
(15, 'alice@dev.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-04 08:41:10.609699'),
(16, 'bob@engineer.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-04 08:41:10.609699'),
(17, 'carol@designer.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-04 08:41:10.609699'),
(18, 'test@company.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-05 04:20:32.39817'),
(19, 'hr@acme.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'Company', true, '2025-07-05 06:31:11.807857'),
(20, 'alaminfarhad27@gmail.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 06:31:11.807857'),
(21, 'suman.sinan@gmail.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 06:31:11.807857'),
(22, 'ahon@sociofitechnology.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 06:31:11.807857'),
(23, 'john.doe@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(24, 'sarah.wilson@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(25, 'mike.johnson@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(26, 'emma.brown@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(27, 'david.lee@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(28, 'lisa.chen@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(29, 'alex.kumar@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492'),
(30, 'sophia.martinez@example.com', '$2b$10$2.7tmPk8myac/zdt3dISkeGAYx6CIzh7gW2O0hrVHNPa66E3sbinC.', 'User', true, '2025-07-05 07:22:16.426492');

-- Insert companies data
INSERT INTO devconnect.companies (id, account_id, name, email, industry, website, logo, joined_at) VALUES
(2, 10, 'Test Company', 'company@test.com', 'Technology', 'https://testcompany.com', 'https://testcompany.com/logo.png', '2025-07-04 08:29:47.749798'),
(3, 11, 'TechStart Solutions', 'hr@techstart.com', 'Software Development', 'https://techstart.com', NULL, '2025-07-04 08:40:56.360346'),
(4, 12, 'Innovate Labs', 'recruiter@innovate.io', 'Technology', 'https://innovate.io', NULL, '2025-07-04 08:40:56.360346'),
(5, 13, 'DataScience AI', 'jobs@datascience.ai', 'Artificial Intelligence', 'https://datascience.ai', NULL, '2025-07-04 08:40:56.360346'),
(6, 14, 'FinTech Pro', 'talent@fintech.com', 'Financial Technology', 'https://fintech.com', NULL, '2025-07-04 08:40:56.360346');

-- Insert users data
INSERT INTO devconnect.users (id, account_id, name, education_level, experience_level, preferred_roles, cv_url, joined_at) VALUES
(4, 9, 'Test User', 'Bachelor''s Degree', 'Mid-level', '{\"Full Stack Developer\",\"Frontend Developer\",\"Software Engineer\"}', '/app/sample-cvs/cv_1_1749995351851.pdf', '2025-07-04 08:29:36.813018'),
(5, 15, 'Alice Johnson', 'Master', 'Senior', '{\"Backend Developer\",\"DevOps Engineer\"}', '/app/sample-cvs/cv_1_1749996393002.pdf', '2025-07-04 08:41:50.803277'),
(6, 16, 'Bob Smith', 'Bachelor', 'Mid-level', '{\"Full Stack Developer\",\"Frontend Developer\"}', '/app/sample-cvs/cv_1_1750015225821.pdf', '2025-07-04 08:41:50.803277'),
(7, 17, 'Carol Davis', 'Bachelor', 'Junior', '{\"UI/UX Designer\",\"Frontend Developer\"}', '/app/sample-cvs/cv_1_1749995351851.pdf', '2025-07-04 08:41:50.803277'),
(11, 23, 'John Doe', NULL, NULL, '{\"Full Stack Developer\"}', '/app/sample-cvs/cv_1_1749995351851.pdf', '2025-07-05 07:22:16.431594'),
(12, 24, 'Sarah Wilson', NULL, NULL, '{\"Frontend Developer\"}', '/app/sample-cvs/cv_1_1749996393002.pdf', '2025-07-05 07:22:16.431594'),
(13, 25, 'Mike Johnson', NULL, NULL, '{\"Backend Developer\"}', '/app/sample-cvs/cv_1_1750015225821.pdf', '2025-07-05 07:22:16.431594'),
(14, 26, 'Emma Brown', NULL, NULL, '{\"Full Stack Developer\"}', '/app/sample-cvs/cv_1_1749995351851.pdf', '2025-07-05 07:22:16.431594'),
(15, 27, 'David Lee', NULL, NULL, '{\"DevOps Engineer\"}', '/app/sample-cvs/cv_1_1749996393002.pdf', '2025-07-05 07:22:16.431594'),
(16, 28, 'Lisa Chen', NULL, NULL, '{\"Frontend Developer\"}', '/app/sample-cvs/cv_1_1750015225821.pdf', '2025-07-05 07:22:16.431594'),
(17, 29, 'Alex Kumar', NULL, NULL, '{\"Full Stack Developer\"}', '/app/sample-cvs/cv_1_1749995351851.pdf', '2025-07-05 07:22:16.431594'),
(18, 30, 'Sophia Martinez', NULL, NULL, '{\"UI/UX Designer\"}', '/app/sample-cvs/cv_1_1749996393002.pdf', '2025-07-05 07:22:16.431594');

-- Insert jobs data
INSERT INTO devconnect.jobs (id, company_id, title, description, skills, employment_type, location, deadline, is_active, posted_at) VALUES
(10, 2, 'Senior Frontend Developer', 'Join our team to build cutting-edge web applications using React and TypeScript. You will work on user-facing features and collaborate with designers and backend developers.', '{React,TypeScript,CSS,JavaScript,Redux}', 'Full-time', 'San Francisco, CA', '2025-08-15 23:59:59', true, '2025-07-04 08:42:26.849428'),
(11, 2, 'DevOps Engineer', 'We are looking for a DevOps engineer to help us scale our infrastructure and improve deployment processes.', '{Docker,Kubernetes,AWS,CI/CD,Python}', 'Full-time', 'Remote', '2025-08-20 23:59:59', true, '2025-07-04 08:42:26.849428'),
(12, 3, 'Full Stack Developer', 'Develop both frontend and backend components of our SaaS platform. Experience with modern web technologies required.', '{Node.js,React,MongoDB,Express,JavaScript}', 'Full-time', 'Austin, TX', '2025-08-25 23:59:59', true, '2025-07-04 08:42:26.849428'),
(13, 3, 'Mobile App Developer', 'Build mobile applications for iOS and Android platforms using React Native.', '{\"React Native\",JavaScript,iOS,Android,Redux}', 'Full-time', 'Austin, TX', '2025-09-01 23:59:59', true, '2025-07-04 08:42:26.849428'),
(14, 4, 'Backend Developer', 'Design and implement scalable backend services and APIs. Work with microservices architecture.', '{Python,Django,PostgreSQL,Docker,Redis}', 'Full-time', 'Seattle, WA', '2025-08-30 23:59:59', true, '2025-07-04 08:42:26.849428'),
(15, 4, 'Product Manager', 'Lead product development from conception to launch. Work closely with engineering and design teams.', '{\"Product Management\",Agile,Analytics,\"User Research\",Strategy}', 'Full-time', 'Seattle, WA', '2025-09-05 23:59:59', true, '2025-07-04 08:42:26.849428'),
(16, 5, 'Machine Learning Engineer', 'Develop and deploy machine learning models at scale. Work with large datasets and modern ML frameworks.', '{Python,TensorFlow,PyTorch,Kubernetes,SQL}', 'Full-time', 'New York, NY', '2025-09-10 23:59:59', true, '2025-07-04 08:42:43.933033'),
(17, 5, 'Data Scientist', 'Analyze complex datasets to derive business insights. Build predictive models and data pipelines.', '{Python,R,SQL,Pandas,Scikit-learn}', 'Full-time', 'New York, NY', '2025-09-15 23:59:59', true, '2025-07-04 08:42:43.933033'),
(18, 6, 'Senior Software Engineer', 'Build secure and scalable financial applications. Experience with fintech regulations preferred.', '{Java,\"Spring Boot\",PostgreSQL,Microservices,Security}', 'Full-time', 'Chicago, IL', '2025-09-20 23:59:59', true, '2025-07-04 08:42:43.933033'),
(19, 6, 'Frontend Developer', 'Create intuitive user interfaces for financial applications. Focus on performance and security.', '{React,TypeScript,Redux,CSS,Jest}', 'Full-time', 'Chicago, IL', '2025-09-25 23:59:59', true, '2025-07-04 08:42:43.933033'),
(20, 3, 'Full Stack Developer', 'We are looking for a passionate Full Stack Developer to join our team. You will be responsible for developing and maintaining web applications using modern technologies.', '{JavaScript,React,Node.js,MongoDB,HTML,CSS}', 'Full-time', 'San Francisco, CA', '2025-08-15 00:00:00', true, '2025-07-04 17:19:40.903618'),
(21, 4, 'Frontend Developer', 'Join our innovative team as a Frontend Developer. You will create amazing user interfaces and ensure excellent user experience across all our products.', '{React,Vue.js,TypeScript,HTML,CSS,JavaScript}', 'Full-time', 'New York, NY', '2025-08-20 00:00:00', true, '2025-07-04 17:19:40.903618');

-- Insert interviewers data
INSERT INTO devconnect.interviewers (id, company_id, name, email, role) VALUES
(2, 2, 'Sarah Johnson', 'sarah.johnson@testcompany.com', 'Engineering Manager'),
(3, 2, 'Mike Chen', 'mike.chen@testcompany.com', 'Senior Developer'),
(4, 3, 'David Wilson', 'david.wilson@techstart.com', 'CTO'),
(5, 3, 'Emma Brown', 'emma.brown@techstart.com', 'Team Lead'),
(6, 4, 'James Taylor', 'james.taylor@innovate.io', 'Product Manager'),
(7, 4, 'Lisa Wang', 'lisa.wang@innovate.io', 'Senior Engineer'),
(8, 5, 'Robert Garcia', 'robert.garcia@datascience.ai', 'AI Research Lead'),
(9, 5, 'Maria Rodriguez', 'maria.rodriguez@datascience.ai', 'Data Scientist'),
(10, 6, 'John Anderson', 'john.anderson@fintech.com', 'VP Engineering'),
(11, 6, 'Jennifer Lee', 'jennifer.lee@fintech.com', 'Security Architect');

-- Insert applications data
INSERT INTO devconnect.applications (id, job_id, user_id, status, updated_at, applied_at) VALUES
(19, 15, 5, 'INTERVIEW_SCHEDULED', '2025-07-04 08:43:57.624597', '2025-07-02 16:00:00'),
(20, 17, 5, 'UNDER_REVIEW', '2025-07-04 08:43:57.624597', '2025-07-03 10:00:00'),
(21, 10, 6, 'UNDER_REVIEW', '2025-07-04 08:43:57.624597', '2025-07-01 12:00:00'),
(22, 12, 6, 'SHORTLISTED', '2025-07-05 07:11:44.076909', '2025-07-02 15:00:00'),
(23, 19, 6, 'ACCEPTED', '2025-07-04 08:43:57.624597', '2025-07-03 11:00:00'),
(24, 13, 7, 'UNDER_REVIEW', '2025-07-04 08:43:57.624597', '2025-07-01 13:00:00'),
(25, 19, 7, 'REJECTED', '2025-07-04 08:43:57.624597', '2025-07-02 17:00:00'),
(32, 12, 5, 'SHORTLISTED', '2025-07-05 07:11:44.076909', '2025-07-03 17:24:07.069016'),
(33, 20, 4, 'SHORTLISTED', '2025-07-05 07:12:54.124091', '2025-07-02 17:24:07.069016'),
(34, 20, 5, 'SHORTLISTED', '2025-07-05 07:12:54.124091', '2025-07-04 13:24:07.069016'),
(35, 20, 6, 'SHORTLISTED', '2025-07-05 07:12:54.124091', '2025-07-01 17:24:07.069016'),
(38, 13, 4, 'UNDER_REVIEW', '2025-07-04 17:24:07.069016', '2025-07-04 12:24:07.069016'),
(39, 13, 5, 'UNDER_REVIEW', '2025-07-04 17:24:07.069016', '2025-07-02 17:24:07.069016');

-- Reset sequences to proper values
SELECT setval('devconnect.accounts_id_seq', 30);
SELECT setval('devconnect.companies_id_seq', 6);
SELECT setval('devconnect.users_id_seq', 18);
SELECT setval('devconnect.jobs_id_seq', 21);
SELECT setval('devconnect.interviewers_id_seq', 11);
SELECT setval('devconnect.applications_id_seq', 53);
