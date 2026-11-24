import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { db, list, lookup } from './database.js';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']]
]);
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415, 'Требуется JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16000) fail(413, 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { fail(400, 'Некорректный JSON.'); }
}
function fields(data) {
  const keys = ['name','birth','passport','phone','address','department','position','salary','hired'];
  const values = keys.map(key => {
    const value = data?.[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 300) fail(400, 'Проверьте заполнение полей.');
    return value.trim().replace(/\s+/g,' ');
  });
  const [, birth, passport, phone, , , , salary, hired] = values;
  for (const date of [birth,hired]) {
    const time = Date.parse(date);
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(time) ||
        new Date(time).toISOString().slice(0,10) !== date) fail(400,'Введите корректную дату.');
  }
  if (birth >= hired) fail(400,'Дата приёма должна быть позже даты рождения.');
  if (!/^\d{4} \d{6}$/.test(passport)) fail(400,'Введите серию и номер паспорта.');
  if (!/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) fail(400,'Проверьте номер телефона.');
  if (!/^\d{1,10}([.,]\d{1,2})?$/.test(salary)) fail(400,'Проверьте размер зарплаты.');
  values[7] = Math.round(Number(salary.replace(',','.')) * 100);
  return values;
}
function active(id) {
  const employee = db.prepare('SELECT dismissed FROM employees WHERE id=?').get(id);
  if (!employee) fail(404,'Сотрудник не найден.');
  if (employee.dismissed) fail(409,'Сотрудник уже уволен. Карточка закрыта для изменений.');
}
function save(data, id) {
  const values = fields(data);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (id) active(id);
    values[5] = lookup('departments', values[5]);
    values[6] = lookup('positions', values[6]);
    if (id) {
      db.prepare('UPDATE employees SET name=?,birth=?,passport=?,phone=?,address=?,department_id=?,position_id=?,salary_kopecks=?,hired=? WHERE id=?').run(...values,id);
    } else {
      db.prepare('INSERT INTO employees(name,birth,passport,phone,address,department_id,position_id,salary_kopecks,hired) VALUES(?,?,?,?,?,?,?,?,?)').run(...values);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error.message.includes('UNIQUE constraint failed: employees.passport')) fail(409,'Такой паспорт уже зарегистрирован.');
    throw error;
  }
}
const server = createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  try {
    const asset = assets.get(path);
    if (req.method === 'GET' && asset) {
      const file = await readFile(new URL('./public/' + asset[0], import.meta.url));
      res.writeHead(200,{'Content-Type':asset[1] + '; charset=utf-8'}).end(file);
      return;
    }
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if (path === '/api/employees' && req.method === 'GET') return res.end(JSON.stringify(list()));
    const match = path.match(/^\/api\/employees\/([1-9]\d*)(\/dismiss)?$/);
    if (path === '/api/employees' && req.method === 'POST') {
      save(await body(req));
      res.statusCode = 201;
    } else if (match && !match[2] && req.method === 'PUT') {
      save(await body(req), Number(match[1]));
    } else if (match?.[2] && req.method === 'POST') {
      await body(req);
      const id = Number(match[1]);
      const result = db.prepare("UPDATE employees SET dismissed=date('now','localtime') WHERE id=? AND dismissed IS NULL").run(id);
      if (!result.changes) active(id);
    } else fail(404,'Страница не найдена.');
    res.end('{}');
  } catch (error) {
    if (!error.status) console.error(error);
    res.writeHead(error.status || 500, {'Content-Type':'application/json; charset=utf-8'})
      .end(JSON.stringify({error:error.status ? error.message : 'Ошибка сервера.'}));
  }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () =>
  console.log('Кадровый учёт: http://localhost:' + server.address().port));
