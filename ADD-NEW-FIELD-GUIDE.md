# Adding New Fields to Profile Signup and Database

This guide explains how to add a new field to the profile signup process and persist it in the database using DevConnect's architecture.

## Overview

The process involves:
1. Adding the new column to the database
2. Updating the backend controller to handle the new field
3. Updating the frontend form to include the new field

---

## 1. Adding a New Column to the Database

### Step 1: Access the Database Container

First, connect to the PostgreSQL database running in Docker:

```bash
# From the DevConnect-Backend directory
docker-compose exec db psql -U root -d main
```

### Step 2: Run SQL Commands to Add Column

Once connected to the database, you can run SQL commands:

#### For User Profile (users table):
```sql
-- Add a new column to users table
ALTER TABLE devconnect.users 
ADD COLUMN phone_number VARCHAR(20);

-- Add a column with constraints
ALTER TABLE devconnect.users 
ADD COLUMN linkedin_url TEXT;

-- Add a column with default value
ALTER TABLE devconnect.users 
ADD COLUMN skills_rating INTEGER DEFAULT 0 CHECK (skills_rating >= 0 AND skills_rating <= 10);

-- Verify the column was added
\d devconnect.users
```

#### For Company Profile (companies table):
```sql
-- Add a new column to companies table
ALTER TABLE devconnect.companies 
ADD COLUMN employee_count INTEGER DEFAULT 0;

-- Add a column with constraints
ALTER TABLE devconnect.companies 
ADD COLUMN founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM CURRENT_DATE));

-- Add a text array column
ALTER TABLE devconnect.companies 
ADD COLUMN company_benefits TEXT[];

-- Verify the column was added
\d devconnect.companies
```

### Step 3: Exit Database Connection
```sql
\q
```

---

## 2. Alternative: Running SQL Commands from Command Line

You can also run SQL commands directly without entering the interactive shell:

```bash
# Single command
docker-compose exec db psql -U root -d main -c "ALTER TABLE devconnect.users ADD COLUMN phone_number VARCHAR(20);"

# Multiple commands from a file
echo "ALTER TABLE devconnect.users ADD COLUMN phone_number VARCHAR(20);" > migration.sql
docker-compose exec -T db psql -U root -d main < migration.sql
```

---

## 3. Updating Backend Controller

### For User Profile (user-service)

Edit `DevConnect-Backend/services/user-service/controllers/user.controller.js`:

```javascript
// In createUserProfile or updateUserProfile function
export const createUserProfile = async (req, res) => {
  try {
    const token = req.cookies?.token;
    // ... token validation code ...

    // Extract the new field from request body
    const { 
      name, 
      education_level, 
      experience_level, 
      preferred_roles, 
      bio, 
      website, 
      description,
      phone_number,        // NEW FIELD
      linkedin_url,        // NEW FIELD
      skills_rating        // NEW FIELD
    } = req.body;

    // Update the SQL query to include new fields
    const query = `
      INSERT INTO devconnect.users 
      (account_id, name, education_level, experience_level, preferred_roles, bio, website, description, phone_number, linkedin_url, skills_rating)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (account_id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        education_level = EXCLUDED.education_level,
        experience_level = EXCLUDED.experience_level,
        preferred_roles = EXCLUDED.preferred_roles,
        bio = EXCLUDED.bio,
        website = EXCLUDED.website,
        description = EXCLUDED.description,
        phone_number = EXCLUDED.phone_number,
        linkedin_url = EXCLUDED.linkedin_url,
        skills_rating = EXCLUDED.skills_rating
      RETURNING *
    `;

    const values = [
      userId, name, education_level, experience_level, 
      preferred_roles, bio, website, description, 
      phone_number, linkedin_url, skills_rating
    ];

    const result = await db.query(query, values);
    
    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Create user profile error:', error);
    res.status(500).json({ error: 'Failed to create user profile' });
  }
};
```

### For Company Profile (company-service)

Edit `DevConnect-Backend/services/company-service/src/controllers/company.controller.js`:

```javascript
// In createCompanyProfile function
export const createCompanyProfile = async (req, res) => {
  try {
    // ... existing code ...

    // Extract new fields from request body
    const { 
      name, 
      industry, 
      website, 
      employee_count,      // NEW FIELD
      founded_year,        // NEW FIELD
      company_benefits     // NEW FIELD (array)
    } = req.body;

    // Update the SQL query
    const query = `
      INSERT INTO devconnect.companies 
      (account_id, name, email, industry, website, logo, employee_count, founded_year, company_benefits)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (account_id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        industry = EXCLUDED.industry,
        website = EXCLUDED.website,
        employee_count = EXCLUDED.employee_count,
        founded_year = EXCLUDED.founded_year,
        company_benefits = EXCLUDED.company_benefits
      RETURNING *
    `;

    const values = [
      userId, name, accountEmail, industry, website, 
      logoUrl, employee_count, founded_year, company_benefits
    ];

    const result = await db.query(query, values);
    
    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Create company profile error:', error);
    res.status(500).json({ error: 'Failed to create company profile' });
  }
};
```

---

## 4. Updating Frontend Form

### For User Profile Form

Edit the user profile form component (e.g., `devconnect-frontend/components/UserProfileForm.tsx`):

```typescript
// Add new fields to the form state
const [formData, setFormData] = useState({
  name: '',
  education_level: '',
  experience_level: '',
  preferred_roles: [],
  bio: '',
  website: '',
  description: '',
  phone_number: '',      // NEW FIELD
  linkedin_url: '',      // NEW FIELD
  skills_rating: 0       // NEW FIELD
});

// Add new form inputs
<div className="form-group">
  <label htmlFor="phone_number">Phone Number</label>
  <input
    type="tel"
    id="phone_number"
    name="phone_number"
    value={formData.phone_number}
    onChange={handleInputChange}
    placeholder="Enter your phone number"
  />
</div>

<div className="form-group">
  <label htmlFor="linkedin_url">LinkedIn URL</label>
  <input
    type="url"
    id="linkedin_url"
    name="linkedin_url"
    value={formData.linkedin_url}
    onChange={handleInputChange}
    placeholder="https://linkedin.com/in/your-profile"
  />
</div>

<div className="form-group">
  <label htmlFor="skills_rating">Skills Rating (1-10)</label>
  <input
    type="range"
    id="skills_rating"
    name="skills_rating"
    min="0"
    max="10"
    value={formData.skills_rating}
    onChange={handleInputChange}
  />
  <span>{formData.skills_rating}</span>
</div>
```

### For Company Profile Form

Edit the company profile form component:

```typescript
// Add new fields to the form state
const [formData, setFormData] = useState({
  name: '',
  industry: '',
  website: '',
  employee_count: 0,           // NEW FIELD
  founded_year: null,          // NEW FIELD
  company_benefits: []         // NEW FIELD (array)
});

// Add new form inputs
<div className="form-group">
  <label htmlFor="employee_count">Employee Count</label>
  <input
    type="number"
    id="employee_count"
    name="employee_count"
    value={formData.employee_count}
    onChange={handleInputChange}
    min="0"
    placeholder="Number of employees"
  />
</div>

<div className="form-group">
  <label htmlFor="founded_year">Founded Year</label>
  <input
    type="number"
    id="founded_year"
    name="founded_year"
    value={formData.founded_year || ''}
    onChange={handleInputChange}
    min="1800"
    max={new Date().getFullYear()}
    placeholder="Year company was founded"
  />
</div>

<div className="form-group">
  <label htmlFor="company_benefits">Company Benefits</label>
  <textarea
    id="company_benefits"
    name="company_benefits"
    value={formData.company_benefits.join(', ')}
    onChange={(e) => setFormData({
      ...formData,
      company_benefits: e.target.value.split(', ').filter(item => item.trim())
    })}
    placeholder="Health insurance, Remote work, Flexible hours (comma-separated)"
  />
</div>
```

---

## 5. Database Query Examples

### Common Column Types

```sql
-- Text fields
ALTER TABLE devconnect.users ADD COLUMN bio TEXT;
ALTER TABLE devconnect.users ADD COLUMN phone_number VARCHAR(20);

-- Numbers
ALTER TABLE devconnect.companies ADD COLUMN employee_count INTEGER DEFAULT 0;
ALTER TABLE devconnect.users ADD COLUMN age INTEGER CHECK (age >= 18 AND age <= 100);

-- Booleans
ALTER TABLE devconnect.users ADD COLUMN is_available BOOLEAN DEFAULT TRUE;

-- Arrays (PostgreSQL specific)
ALTER TABLE devconnect.users ADD COLUMN skills TEXT[];
ALTER TABLE devconnect.companies ADD COLUMN office_locations TEXT[];

-- Dates and Times
ALTER TABLE devconnect.companies ADD COLUMN founded_date DATE;
ALTER TABLE devconnect.users ADD COLUMN last_login TIMESTAMP;

-- JSON fields
ALTER TABLE devconnect.users ADD COLUMN preferences JSONB;
```

### Useful Database Commands

```sql
-- View table structure
\d devconnect.users
\d devconnect.companies

-- View all tables in devconnect schema
\dt devconnect.*

-- Drop a column (if you make a mistake)
ALTER TABLE devconnect.users DROP COLUMN column_name;

-- Rename a column
ALTER TABLE devconnect.users RENAME COLUMN old_name TO new_name;

-- Add a constraint to existing column
ALTER TABLE devconnect.users ADD CONSTRAINT check_phone_format CHECK (phone_number ~ '^\+?[0-9\s\-\(\)]+$');

-- View all constraints on a table
SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'devconnect.users'::regclass;
```

---

## 6. Testing the Changes

1. **Start the services:**
   ```bash
   docker-compose up --build
   ```

2. **Test the database connection:**
   ```bash
   docker-compose exec db psql -U root -d main -c "SELECT * FROM devconnect.users LIMIT 1;"
   ```

3. **Test the API endpoint:**
   ```bash
   curl -X POST http://localhost:4004/api/users/profile \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "phone_number": "+1234567890"}'
   ```

4. **Check the data was saved:**
   ```bash
   docker-compose exec db psql -U root -d main -c "SELECT name, phone_number FROM devconnect.users;"
   ```

---

## 7. Important Notes

- **Always backup your database before making schema changes**
- **Test in development before applying to production**
- **Use appropriate data types and constraints**
- **Consider adding indexes for frequently queried columns**
- **Validate data on both frontend and backend**
- **Handle null values appropriately in your application logic**

---

## 8. Rollback Strategy

If you need to remove a column:

```sql
-- Remove the column
ALTER TABLE devconnect.users DROP COLUMN phone_number;

-- Remove from backend controller (reverse the code changes)
-- Remove from frontend form (reverse the code changes)
```

---

This guide provides a complete workflow for adding new fields to your DevConnect application. Always test thoroughly in development before applying changes to production.
