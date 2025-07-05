----------------------------------------------------------------------
-- 0)  Clean up previous demo rows (or simply start fresh)
--     TRUNCATE + CASCADE handles child tables automatically
----------------------------------------------------------------------


----------------------------------------------------------------------
-- 1)  ACCOUNTS
----------------------------------------------------------------------
INSERT INTO devconnect.accounts (email, password_hash, account_type)
VALUES
  ('hr@acme.com',    'bcrypt$dummy', 'Company'),
  ('alaminfarhad27@gmail.com', 'bcrypt$dummy', 'User'),
  ('suman.sinan@gmail.com ',   'bcrypt$dummy', 'User'),
  ('ahon@sociofitechnology.com ',  'bcrypt$dummy', 'User');

----------------------------------------------------------------------
-- 2)  COMPANY
----------------------------------------------------------------------
INSERT INTO devconnect.companies (account_id, name, email, industry, website)
VALUES
  (1, 'Acme Corp', 'hr@acme.com', 'Software', 'https://acme.com');

----------------------------------------------------------------------
-- 3)  USERS  (applicants)
----------------------------------------------------------------------
INSERT INTO devconnect.users (account_id, name, preferred_roles, cv_url)
VALUES
  (2, 'Alice Ahmed', ARRAY['Backend Developer'], '/files/cv_1.pdf'),
  (3, 'Bob Biswas',  ARRAY['Full-Stack'],        '/files/cv_2.pdf'),
  (4, 'Zara Rahman', ARRAY['Front-End Designer'],'/files/cv_3.pdf');

----------------------------------------------------------------------
-- 4)  JOB
----------------------------------------------------------------------
INSERT INTO devconnect.jobs (company_id, title, description, skills, location)
VALUES
  (1, 'Backend Engineer',
      'Building REST APIs in Node.js',
      ARRAY['Node.js','PostgreSQL'],
      'Dhaka');

----------------------------------------------------------------------
-- 5)  APPLICATIONS
----------------------------------------------------------------------
INSERT INTO devconnect.applications (job_id, user_id, status)
VALUES
  (1, 1, 'UNDER_REVIEW'),
  (1, 2, 'UNDER_REVIEW'),
  (1, 3, 'UNDER_REVIEW');

----------------------------------------------------------------------
-- 6)  INTERVIEWER
----------------------------------------------------------------------
INSERT INTO devconnect.interviewers (company_id, name, email, role)
VALUES
  (1, 'Sarah Malik', 'muheetrahi@gmail.com', 'Hiring Manager');

----------------------------------------------------------------------
-- 7)  Job → Interviewer mapping
----------------------------------------------------------------------
INSERT INTO devconnect.job_interviewers (job_id, interviewer_id)
VALUES (1, 1);

-- Insert additional job records
INSERT INTO devconnect.jobs (company_id, title, description, skills, location, is_active, posted_at) VALUES
(1, 'Frontend Developer', 'Develop modern web applications using React and TypeScript.', ARRAY['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'Data Scientist', 'Analyze data and build predictive models using Python and machine learning libraries.', ARRAY['Python', 'Pandas', 'scikit-learn', 'Machine Learning', 'SQL'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'DevOps Engineer', 'Automate CI/CD pipelines and manage cloud infrastructure on AWS.', ARRAY['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'Mobile App Developer', 'Build cross-platform mobile apps using Flutter.', ARRAY['Flutter', 'Dart', 'Firebase', 'REST API'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'QA Engineer', 'Design and execute test cases for web and mobile applications.', ARRAY['Selenium', 'Test Automation', 'Manual Testing', 'JIRA'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'Full Stack Developer', 'Work on both backend and frontend using Node.js and Angular.', ARRAY['Node.js', 'Angular', 'MongoDB', 'Express', 'TypeScript'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'Machine Learning Engineer', 'Deploy ML models and optimize pipelines for production.', ARRAY['Python', 'TensorFlow', 'PyTorch', 'Docker', 'ML Ops'], 'Dhaka', true, '2025-06-22 15:31:00.242219'),

(1, 'Cloud Solutions Architect', 'Design scalable cloud solutions on Azure.', ARRAY['Azure', 'Cloud Architecture', 'DevOps', 'Networking'], 'Dhaka', true, '2025-06-22 15:31:00.242219');
