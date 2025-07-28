-- Fix missing pieces for existing TechStart company
-- Company already exists: TechStart Solutions (ID: 3, hr@techstart.com)

-- 1. Add the email from .env as an interviewer for TechStart
INSERT INTO devconnect.interviewers (company_id, name, email, role)
VALUES (3, 'HR Manager (Email Service)', 'muheetrahi@gmail.com', 'Hiring Manager')
ON CONFLICT (company_id, email) DO NOTHING;

-- 2. Map all existing TechStart jobs to the email service interviewer
INSERT INTO devconnect.job_interviewers (job_id, interviewer_id)
SELECT j.id, i.id
FROM devconnect.jobs j
CROSS JOIN devconnect.interviewers i
WHERE j.company_id = 3 
AND i.email = 'muheetrahi@gmail.com'
ON CONFLICT (job_id, interviewer_id) DO NOTHING;

-- 3. Also map jobs to existing interviewers (David Wilson and Emma Brown)
INSERT INTO devconnect.job_interviewers (job_id, interviewer_id)
SELECT j.id, i.id
FROM devconnect.jobs j
CROSS JOIN devconnect.interviewers i
WHERE j.company_id = 3 
AND i.company_id = 3
AND i.email != 'muheetrahi@gmail.com'
ON CONFLICT (job_id, interviewer_id) DO NOTHING;

-- Display current setup for verification
SELECT 'TechStart Jobs' as section, j.id::text as id, j.title as name, '' as email
FROM devconnect.jobs j
WHERE j.company_id = 3

UNION ALL

SELECT 'TechStart Interviewers' as section, i.id::text, i.name, i.email
FROM devconnect.interviewers i
WHERE i.company_id = 3

UNION ALL

SELECT 'Job-Interviewer Mappings' as section, 
       CONCAT('Job ', ji.job_id, ' -> Interviewer ', ji.interviewer_id) as id,
       j.title as name,
       i.email
FROM devconnect.job_interviewers ji
JOIN devconnect.jobs j ON ji.job_id = j.id
JOIN devconnect.interviewers i ON ji.interviewer_id = i.id
WHERE j.company_id = 3

UNION ALL

SELECT 'Applications to Process' as section, 
       a.id::text,
       CONCAT(u.name, ' -> Job ', j.title) as name,
       a.status as email
FROM devconnect.applications a
JOIN devconnect.jobs j ON a.job_id = j.id
JOIN devconnect.users u ON a.user_id = u.id
WHERE j.company_id = 3 AND a.status = 'UNDER_REVIEW'
ORDER BY section, id;
