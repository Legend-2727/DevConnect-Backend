-- -- auth service
-- CREATE SCHEMA IF NOT EXISTS auth_service;

-- CREATE TABLE IF NOT EXISTS auth_service.accounts (
--   id SERIAL PRIMARY KEY,
--   email VARCHAR(255) UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,
--   account_type VARCHAR(50) CHECK (account_type IN ('User', 'Company')) NOT NULL,
--   is_active BOOLEAN DEFAULT TRUE,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );


-- -- user service
-- CREATE SCHEMA IF NOT EXISTS user_service;

-- CREATE TABLE IF NOT EXISTS user_service.users (
--   id SERIAL PRIMARY KEY,
--   account_id INTEGER UNIQUE NOT NULL REFERENCES auth_service.accounts(id) ON DELETE CASCADE,
--   name VARCHAR(255) NOT NULL,
--   education_level VARCHAR(50),
--   experience_level VARCHAR(50),
--   preferred_roles TEXT[],
--   cv_url TEXT,
--   joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );




-- -- company service
-- CREATE SCHEMA IF NOT EXISTS company_service;

-- CREATE TABLE IF NOT EXISTS company_service.companies (
--   id SERIAL PRIMARY KEY,
--   account_id INTEGER UNIQUE NOT NULL REFERENCES auth_service.accounts(id) ON DELETE CASCADE,
--   name VARCHAR(255) NOT NULL,
--   email VARCHAR(255) UNIQUE NOT NULL,
--   industry VARCHAR(100),
--   website TEXT,
--   logo TEXT,
--   joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );



-- -- job service
-- CREATE SCHEMA IF NOT EXISTS job_service;

-- CREATE TABLE IF NOT EXISTS job_service.jobs (
--   id SERIAL PRIMARY KEY,
--   company_id INTEGER NOT NULL REFERENCES company_service.companies(id) ON DELETE CASCADE,
--   title VARCHAR(255) NOT NULL,
--   description TEXT,
--   skills TEXT[],
--   employment_type VARCHAR(50), 
--   location TEXT,
--   deadline TIMESTAMP,
--   is_active BOOLEAN DEFAULT TRUE,
--   posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );


-- -- application service

-- CREATE SCHEMA IF NOT EXISTS application_service;

-- CREATE TABLE IF NOT EXISTS application_service.applications (
--   id SERIAL PRIMARY KEY,
--   job_id INTEGER NOT NULL REFERENCES job_service.jobs(id) ON DELETE CASCADE,
--   user_id INTEGER NOT NULL REFERENCES user_service.users(id) ON DELETE CASCADE,
--   status VARCHAR(50) NOT NULL DEFAULT 'UNDER_REVIEW',
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE (job_id, user_id)
-- );

-- CREATE TABLE IF NOT EXISTS application_service.feedback (
--   id SERIAL PRIMARY KEY,
--   application_id INTEGER NOT NULL UNIQUE REFERENCES application_service.applications(id) ON DELETE CASCADE,
--   strengths TEXT[],
--   improvements TEXT[],
--   suggested_learning TEXT[]
-- );

-- CREATE TABLE IF NOT EXISTS application_service.interviews (
--   id SERIAL PRIMARY KEY,
--   job_id INTEGER NOT NULL REFERENCES job_service.jobs(id) ON DELETE CASCADE,
--   application_id INTEGER NOT NULL REFERENCES application_service.applications(id) ON DELETE CASCADE,
--   slot TIMESTAMPTZ NOT NULL,
--   status VARCHAR(50) DEFAULT 'SCHEDULED',
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );



-- -- email service
-- CREATE SCHEMA IF NOT EXISTS email_service;

-- CREATE TABLE IF NOT EXISTS email_service.sent_emails (
--   id SERIAL PRIMARY KEY,
--   to_email VARCHAR(255) NOT NULL,
--   subject TEXT NOT NULL,
--   body TEXT,
--   sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   job_id INTEGER REFERENCES job_service.jobs(id),
--   application_id INTEGER REFERENCES application_service.applications(id)
-- );

-- Create the unified schema
CREATE SCHEMA IF NOT EXISTS devconnect;

-- User Accounts Table (was auth_service.accounts)
CREATE TABLE IF NOT EXISTS devconnect.accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  account_type VARCHAR(50) CHECK (account_type IN ('User', 'Company')) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Profiles Table (was user_service.users)
CREATE TABLE IF NOT EXISTS devconnect.users (
  id SERIAL PRIMARY KEY,
  account_id INTEGER UNIQUE NOT NULL REFERENCES devconnect.accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  education_level VARCHAR(50),
  experience_level VARCHAR(50),
  preferred_roles TEXT[],
  cv_url TEXT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies Table (was company_service.companies)
CREATE TABLE IF NOT EXISTS devconnect.companies (
  id SERIAL PRIMARY KEY,
  account_id INTEGER UNIQUE NOT NULL REFERENCES devconnect.accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  industry VARCHAR(100),
  website TEXT,
  logo TEXT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table (was job_service.jobs)
CREATE TABLE IF NOT EXISTS devconnect.jobs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES devconnect.companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  skills TEXT[],
  employment_type VARCHAR(50),
  location TEXT,
  deadline TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications Table (was application_service.applications)
CREATE TABLE IF NOT EXISTS devconnect.applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES devconnect.jobs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES devconnect.users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'UNDER_REVIEW',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_id, user_id)
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS devconnect.feedback (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES devconnect.applications(id) ON DELETE CASCADE,
  strengths TEXT[],
  improvements TEXT[],
  suggested_learning TEXT[]
);

-- Interviews Table
CREATE TABLE IF NOT EXISTS devconnect.interviews (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES devconnect.jobs(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES devconnect.applications(id) ON DELETE CASCADE,
  slot TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Log Table (was email_service.sent_emails)
CREATE TABLE IF NOT EXISTS devconnect.sent_emails (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  job_id INTEGER REFERENCES devconnect.jobs(id),
  application_id INTEGER REFERENCES devconnect.applications(id)
);

-- CV Customization History Table
CREATE TABLE IF NOT EXISTS devconnect.cv_customizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES devconnect.users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES devconnect.jobs(id) ON DELETE CASCADE,
  original_cv_url TEXT NOT NULL,
  customized_cv_url TEXT NOT NULL,
  customization_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, job_id)
);
