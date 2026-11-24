CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  birth TEXT NOT NULL,
  passport TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  position_id INTEGER NOT NULL REFERENCES positions(id),
  salary_kopecks INTEGER NOT NULL CHECK (salary_kopecks >= 0),
  hired TEXT NOT NULL CHECK (hired > birth),
  dismissed TEXT
) STRICT;
CREATE TRIGGER IF NOT EXISTS lock_dismissed BEFORE UPDATE ON employees
WHEN OLD.dismissed IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'employee dismissed');
END;
