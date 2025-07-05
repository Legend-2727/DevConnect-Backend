-- Add more test users and applications for better AI shortlisting demonstration
INSERT INTO devconnect.accounts (email, password_hash, account_type) VALUES
  ('john.doe@example.com', 'bcrypt$dummy', 'User'),
  ('sarah.wilson@example.com', 'bcrypt$dummy', 'User'),
  ('mike.johnson@example.com', 'bcrypt$dummy', 'User'),
  ('emma.brown@example.com', 'bcrypt$dummy', 'User'),
  ('david.lee@example.com', 'bcrypt$dummy', 'User'),
  ('lisa.chen@example.com', 'bcrypt$dummy', 'User'),
  ('alex.kumar@example.com', 'bcrypt$dummy', 'User'),
  ('sophia.martinez@example.com', 'bcrypt$dummy', 'User');

-- Get the account IDs for the new users (assuming they start from ID 21)
INSERT INTO devconnect.users (account_id, name, preferred_roles, cv_url) VALUES
  ((SELECT id FROM devconnect.accounts WHERE email = 'john.doe@example.com'), 'John Doe', ARRAY['Full Stack Developer'], '/app/sample-cvs/cv_1_1749995351851.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'sarah.wilson@example.com'), 'Sarah Wilson', ARRAY['Frontend Developer'], '/app/sample-cvs/cv_1_1749996393002.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'mike.johnson@example.com'), 'Mike Johnson', ARRAY['Backend Developer'], '/app/sample-cvs/cv_1_1750015225821.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'emma.brown@example.com'), 'Emma Brown', ARRAY['Full Stack Developer'], '/app/sample-cvs/cv_1_1749995351851.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'david.lee@example.com'), 'David Lee', ARRAY['DevOps Engineer'], '/app/sample-cvs/cv_1_1749996393002.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'lisa.chen@example.com'), 'Lisa Chen', ARRAY['Frontend Developer'], '/app/sample-cvs/cv_1_1750015225821.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'alex.kumar@example.com'), 'Alex Kumar', ARRAY['Full Stack Developer'], '/app/sample-cvs/cv_1_1749995351851.pdf'),
  ((SELECT id FROM devconnect.accounts WHERE email = 'sophia.martinez@example.com'), 'Sophia Martinez', ARRAY['UI/UX Designer'], '/app/sample-cvs/cv_1_1749996393002.pdf');

-- Create a new job with more applications for company 3 (hr@techstart.com)
INSERT INTO devconnect.jobs (company_id, title, description, skills, location, is_active, posted_at) VALUES
(3, 'Senior Full Stack Developer', 'We are looking for an experienced Full Stack Developer to join our growing team. You will work on exciting projects using modern technologies.', ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'], 'Dhaka', true, NOW());

-- Get the job ID and add applications from all users
INSERT INTO devconnect.applications (job_id, user_id, status, applied_at) VALUES
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Test User'), 'UNDER_REVIEW', NOW() - INTERVAL '5 days'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Alice Johnson'), 'UNDER_REVIEW', NOW() - INTERVAL '4 days'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Bob Smith'), 'UNDER_REVIEW', NOW() - INTERVAL '3 days'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'John Doe'), 'UNDER_REVIEW', NOW() - INTERVAL '2 days'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Sarah Wilson'), 'UNDER_REVIEW', NOW() - INTERVAL '2 days'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Mike Johnson'), 'UNDER_REVIEW', NOW() - INTERVAL '1 day'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Emma Brown'), 'UNDER_REVIEW', NOW() - INTERVAL '1 day'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'David Lee'), 'UNDER_REVIEW', NOW() - INTERVAL '12 hours'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Lisa Chen'), 'UNDER_REVIEW', NOW() - INTERVAL '8 hours'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Alex Kumar'), 'UNDER_REVIEW', NOW() - INTERVAL '4 hours'),
((SELECT id FROM devconnect.jobs WHERE title = 'Senior Full Stack Developer' AND company_id = 3), 
 (SELECT id FROM devconnect.users WHERE name = 'Sophia Martinez'), 'UNDER_REVIEW', NOW() - INTERVAL '2 hours');
