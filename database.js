import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';

mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
export const db = new DatabaseSync(process.env.STAFF_DB || new URL('./data/staff.sqlite', import.meta.url));
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
try {
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  if (!db.prepare('PRAGMA user_version').get().user_version) {
    const seed = [
      ['Антонова Мария Игоревна', 'Бухгалтерия', 'Бухгалтер', 72000],
      ['Власов Павел Сергеевич', 'Разработка', 'Разработчик', 125000],
      ['Громова Анна Олеговна', 'Персонал', 'HR-специалист', 85000],
      ['Егоров Максим Петрович', 'Продажи', 'Менеджер', 68000],
      ['Лебедева Ольга Андреевна', 'Разработка', 'Аналитик', 98000],
      ['Соколов Иван Романович', 'Продажи', 'Менеджер', 74000]
    ];
    seed.forEach(([name, department, position, salary], i) => {
      const n = i + 1;
      const values = [name, '199' + i + '-04-12', '0000 00000' + n, '+7 (000) 000-00-0' + n,
        'г. Примерск, ул. Учебная, д. ' + n, lookup('departments', department),
        lookup('positions', position), salary * 100, '2023-05-0' + n, i === 5 ? '2025-02-18' : null];
      db.prepare('INSERT INTO employees VALUES(NULL,?,?,?,?,?,?,?,?,?,?)').run(...values);
    });
    db.exec('PRAGMA user_version = 1');
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

// Имена таблиц передаются только из кода приложения.
export function lookup(table, name) {
  const rows = db.prepare('SELECT id, name FROM ' + table).all();
  const match = rows.find(row => row.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  return db.prepare('INSERT INTO ' + table + '(name) VALUES (?)').run(name).lastInsertRowid;
}
export function list() {
  return db.prepare(`SELECT e.id, e.name, birth, passport, phone, address,
    d.name AS department, p.name AS position, salary_kopecks / 100.0 AS salary, hired, dismissed
    FROM employees e JOIN departments d ON d.id=e.department_id
    JOIN positions p ON p.id=e.position_id`).all().sort((a,b) => a.name.localeCompare(b.name, 'ru'));
}
