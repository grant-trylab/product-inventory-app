const $ = (id) => document.getElementById(id);
const config = window.INVENTORY_SUPABASE_CONFIG || {};
const configReady = Boolean(config.url && config.anonKey && !config.url.includes('PASTE_') && !config.anonKey.includes('PASTE_'));
let client = null;
let selectedProduct = null;
let formMode = 'add';

const authPanel = $('auth-panel');
const inventoryPanel = $('inventory-panel');
const status = $('status');
const result = $('result');
const notFound = $('not-found');
const productForm = $('product-form');
const searchName = $('search-name');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}
function hideProductPanels() {
  result.classList.add('hidden');
  notFound.classList.add('hidden');
  productForm.classList.add('hidden');
}
function showProduct(product, message = '查詢成功。') {
  hideProductPanels();
  selectedProduct = product;
  $('product-title').textContent = product.name;
  $('product-code').textContent = product.code;
  $('product-location').textContent = product.location;
  result.classList.remove('hidden');
  setStatus(message);
}
function setSignedIn(user) {
  authPanel.classList.toggle('hidden', Boolean(user));
  inventoryPanel.classList.toggle('hidden', !user);
  if (user) {
    $('signed-in-as').textContent = user.email || '已登入';
    setStatus('登入成功，資料與授權使用者共用。');
  } else {
    hideProductPanels();
  }
}
function friendlyError(error) {
  const message = error?.message || '發生未知錯誤。';
  if (/invalid login credentials/i.test(message)) return '帳號或密碼錯誤，或該帳號尚未確認 Email。請到 Supabase Authentication → Users 檢查使用者狀態及登入 Email。';
  if (/email not confirmed/i.test(message)) return '此帳號的 Email 尚未確認。請在 Supabase Authentication → Users 確認使用者，或重新寄送確認信。';
  if (/failed to fetch|networkerror/i.test(message)) return '連線 Supabase 失敗。請確認 Project URL、網路及 Supabase 專案狀態。';
  if (/row-level security|permission denied/i.test(message)) return '資料庫權限尚未設定完成，請確認已建立 products 資料表及 RLS policies。';
  if (/duplicate key|products_name_key/i.test(message)) return '這個產品名稱已存在。';
  return message;
}
async function lookupProduct(name) {
  const { data, error } = await client.from('products').select('id,name,code,location').ilike('name', name).maybeSingle();
  if (error) throw error;
  return data;
}
function openForm(mode, product = null) {
  hideProductPanels();
  formMode = mode;
  $('form-title').textContent = mode === 'edit' ? '變更產品資料' : '新增產品';
  $('form-name').value = product?.name || searchName.value.trim();
  $('form-code').value = product?.code || '';
  $('form-location').value = product?.location || '';
  productForm.classList.remove('hidden');
  $('form-name').focus();
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!client) return;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const errorBox = $('login-error');
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
  button.disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    if (error) throw error;
    setSignedIn(data.user);
  } catch (error) {
    errorBox.textContent = friendlyError(error);
    errorBox.classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
});

$('logout-button').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error) setStatus(friendlyError(error), true);
});

$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = searchName.value.trim();
  if (!name) return;
  hideProductPanels();
  setStatus('查詢中…');
  try {
    const product = await lookupProduct(name);
    if (product) showProduct(product);
    else {
      selectedProduct = null;
      notFound.classList.remove('hidden');
      setStatus('找不到這項產品。');
    }
  } catch (error) { setStatus(friendlyError(error), true); }
});

$('yes-add').addEventListener('click', () => openForm('add'));
$('no-add').addEventListener('click', () => {
  hideProductPanels();
  searchName.value = '';
  selectedProduct = null;
  setStatus('已返回首頁。');
  searchName.focus();
});
$('edit-button').addEventListener('click', () => {
  if (selectedProduct) openForm('edit', selectedProduct);
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const product = {
    name: $('form-name').value.trim(),
    code: $('form-code').value.trim(),
    location: $('form-location').value.trim()
  };
  if (!product.name || !product.code || !product.location) {
    setStatus('請完整填寫產品名、代碼與庫存位置。', true);
    return;
  }
  const button = productForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const request = formMode === 'edit' && selectedProduct
      ? client.from('products').update(product).eq('id', selectedProduct.id).select('id,name,code,location').single()
      : client.from('products').insert(product).select('id,name,code,location').single();
    const { data, error } = await request;
    if (error) throw error;
    searchName.value = data.name;
    showProduct(data, formMode === 'edit' ? '產品資料已更新並儲存到共用資料庫。' : '產品已新增並儲存到共用資料庫。');
  } catch (error) { setStatus(friendlyError(error), true); }
  finally { button.disabled = false; }
});

$('cancel-form').addEventListener('click', () => {
  hideProductPanels();
  if (formMode === 'edit' && selectedProduct) showProduct(selectedProduct, '已取消變更。');
  else setStatus('已取消新增。');
});

async function initialize() {
  const errorBox = $('login-error');
  if (!configReady || !window.supabase) {
    errorBox.textContent = 'Supabase 尚未設定：請檢查 config.js 的 Project URL、publishable key，以及 supabase-js 載入狀況。';
    errorBox.classList.remove('hidden');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  client = window.supabase.createClient(config.url, config.anonKey);
  const { data, error } = await client.auth.getSession();
  if (error) {
    errorBox.textContent = friendlyError(error);
    errorBox.classList.remove('hidden');
    return;
  }
  setSignedIn(data.session?.user || null);
  client.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user || null));
}
initialize();
