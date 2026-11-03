const STORAGE_KEY = 'product-inventory-v1';
const $ = (id) => document.getElementById(id);
const searchForm = $('search-form');
const searchName = $('search-name');
const status = $('status');
const result = $('result');
const notFound = $('not-found');
const productForm = $('product-form');
let selectedName = '';
let formMode = 'add';

function getInventory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function saveInventory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}
function hidePanels() {
  result.classList.add('hidden');
  notFound.classList.add('hidden');
  productForm.classList.add('hidden');
}
function findProduct(name) {
  return getInventory().find((item) => normalize(item.name) === normalize(name));
}
function showProduct(item, message = '查詢成功。') {
  hidePanels();
  selectedName = item.name;
  $('product-title').textContent = item.name;
  $('product-code').textContent = item.code;
  $('product-location').textContent = item.location;
  result.classList.remove('hidden');
  status.textContent = message;
}
function openForm(mode, item = null) {
  hidePanels();
  formMode = mode;
  $('form-title').textContent = mode === 'edit' ? '變更產品資料' : '新增產品';
  $('form-name').value = item?.name || selectedName || searchName.value.trim();
  $('form-code').value = item?.code || '';
  $('form-location').value = item?.location || '';
  productForm.classList.remove('hidden');
  $('form-name').focus();
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = searchName.value.trim();
  if (!name) return;
  const item = findProduct(name);
  if (item) {
    showProduct(item);
    return;
  }
  hidePanels();
  selectedName = name;
  notFound.classList.remove('hidden');
  status.textContent = '找不到這項產品。';
});

$('yes-add').addEventListener('click', () => openForm('add'));
$('no-add').addEventListener('click', () => {
  hidePanels();
  searchName.value = '';
  selectedName = '';
  status.textContent = '已返回首頁。';
  searchName.focus();
});
$('edit-button').addEventListener('click', () => {
  const item = findProduct(selectedName);
  if (item) openForm('edit', item);
});

productForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const item = {
    name: $('form-name').value.trim(),
    code: $('form-code').value.trim(),
    location: $('form-location').value.trim()
  };
  if (!item.name || !item.code || !item.location) {
    status.textContent = '請完整填寫產品名、代碼與庫存位置。';
    return;
  }
  const items = getInventory();
  const matchName = formMode === 'edit' ? selectedName : item.name;
  const index = items.findIndex((entry) => normalize(entry.name) === normalize(matchName));
  if (formMode === 'add' && index !== -1) {
    status.textContent = '這個產品名已存在，請查詢後使用「變更」。';
    return;
  }
  if (formMode === 'edit' && index === -1) {
    hidePanels();
    status.textContent = '找不到要變更的產品，請重新查詢。';
    return;
  }
  if (index === -1) items.push(item);
  else items[index] = item;
  saveInventory(items);
  searchName.value = item.name;
  showProduct(item, formMode === 'edit' ? '產品資料已更新並儲存。' : '產品已新增並儲存。');
});

$('cancel-form').addEventListener('click', () => {
  hidePanels();
  const item = findProduct(selectedName);
  if (item) showProduct(item, '已取消變更。');
  else {
    status.textContent = '已取消新增。';
    searchName.focus();
  }
});
