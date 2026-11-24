const byId = id => document.getElementById(id);
const form = byId('employee');
const card = byId('card');
const confirmation = byId('confirm');
const money = new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',minimumFractionDigits:0});
let employees = [];
let selected;
function date(value) { return value.split('-').reverse().join('.'); }
function normalize(value) { return value.toLowerCase().replaceAll('ё','е').trim(); }
function options(key, filter, list, all) {
  const current = filter.value;
  const names = [...new Set(employees.map(row => row[key]))].sort((a,b) => a.localeCompare(b,'ru'));
  filter.replaceChildren(new Option(all,''));
  list.replaceChildren();
  for (const name of names) {
    filter.add(new Option(name,name));
    list.append(new Option(name,name));
  }
  if (names.includes(current)) filter.value = current;
}
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/employees' + path, {
    method, headers: {'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Ошибка запроса.');
  return result;
}
async function load() {
  employees = await api('');
  options('department',byId('dept'),byId('departments'),'Все отделы');
  options('position',byId('job'),byId('positions'),'Все должности');
  byId('total').textContent = employees.length;
  const former = employees.filter(row => row.dismissed).length;
  byId('former').textContent = former;
  byId('active').textContent = employees.length - former;
  render();
}
function render() {
  const query = normalize(byId('search').value).split(/\s+/);
  const department = byId('dept').value;
  const position = byId('job').value;
  const visible = employees.filter(row => (!department || row.department === department) &&
    (!position || row.position === position) && query.every(word => normalize(row.name).includes(word)));
  const rows = byId('rows');
  rows.replaceChildren();
  for (const person of visible) {
    const tr = rows.insertRow();
    const link = document.createElement('button');
    link.className = 'person';
    link.textContent = person.name;
    link.onclick = () => openCard(person);
    tr.insertCell().append(link);
    for (const value of [person.department, person.position, money.format(person.salary), date(person.hired)]) {
      tr.insertCell().textContent = value;
    }
    const badge = document.createElement('span');
    badge.className = person.dismissed ? 'badge off' : 'badge';
    badge.textContent = person.dismissed ? 'Уволен' : 'Работает';
    tr.insertCell().append(badge);
  }
  byId('count').textContent = visible.length ? 'Показано: ' + visible.length + ' из ' + employees.length : 'Сотрудники не найдены.';
}
function openCard(person) {
  selected = person;
  form.reset();
  for (const input of form.querySelectorAll('input')) input.value = person?.[input.name] ?? '';
  for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = Boolean(person?.dismissed);
  byId('heading').textContent = person ? 'Карточка сотрудника' : 'Новый сотрудник';
  byId('card-status').textContent = person?.dismissed ? 'Уволен · ' + date(person.dismissed) : '';
  byId('save').hidden = Boolean(person?.dismissed);
  byId('dismiss').hidden = !person || Boolean(person.dismissed);
  byId('error').textContent = '';
  card.showModal();
}
function mask(input, format) {
  input.addEventListener('input', () => {
    const old = input.value;
    const cursor = input.selectionStart;
    const tail = old.slice(cursor).replace(/\D/g,'').length;
    input.value = format(old);
    let end = input.value.length;
    let remaining = tail;
    while (remaining && end) if (/\d/.test(input.value[--end])) remaining--;
    input.setSelectionRange(end,end);
  });
}
mask(form.elements.passport, raw => raw.replace(/\D/g,'').slice(0,10).replace(/^(\d{4})(\d)/,'$1 $2'));
mask(form.elements.phone, raw => {
  let digits = raw.replace(/\D/g,'');
  if (raw.startsWith('+7') || (digits.length === 11 && /^[78]/.test(digits))) digits = digits.slice(1);
  digits = digits.slice(0,10);
  if (!digits) return '';
  let result = '+7 (' + digits.slice(0,3);
  if (digits.length > 3) result += ') ' + digits.slice(3,6);
  if (digits.length > 6) result += '-' + digits.slice(6,8);
  if (digits.length > 8) result += '-' + digits.slice(8);
  return result;
});
async function change(button, request, message) {
  button.disabled = true;
  try {
    await request();
    card.close();
    byId('notice').textContent = message;
    await load();
  } catch (error) {
    byId(card.open ? 'error' : 'notice').textContent = error.message;
  } finally { button.disabled = false; }
}
form.onsubmit = event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  change(byId('save'), () => api(selected ? '/' + selected.id : '',selected ? 'PUT' : 'POST',data),'Карточка сохранена.');
};
byId('add').onclick = () => openCard(null);
for (const button of document.querySelectorAll('.close')) button.onclick = () => card.close();
byId('dismiss').onclick = () => {
  byId('question').textContent = selected.name + '. Карточка останется в реестре и будет доступна только для просмотра.';
  confirmation.showModal();
};
byId('cancel').onclick = () => confirmation.close();
byId('yes').onclick = () => {
  confirmation.close();
  change(byId('dismiss'), () => api('/' + selected.id + '/dismiss','POST',{}),'Сотрудник уволен.');
};
for (const id of ['dept','job','search']) byId(id).addEventListener('input',render);
byId('reset').onclick = () => {
  for (const id of ['dept','job','search']) byId(id).value = '';
  render();
};
load().catch(error => { byId('notice').textContent = error.message; });
