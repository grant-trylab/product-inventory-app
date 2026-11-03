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
const errorBox = $('login-error');

function showLoginError(message) {
  if (!errorBox) { window.alert(message); return; }
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}
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
  if (/invalid login credentials/i.test(message)) return '帳號或密碼錯誤。請確認使用者是在此 Supabase 專案建立，且輸入正確。';
  if (/email not confirmed/i.test(message)) return '此帳號的 Email 尚未確認。';
  if (/failed to fetch|networkerror/i.test(message)) return '連線 Supabase 失敗。請確認 Project URL、網路及 Supabase 專案狀態。';
  if (/row-level security|permission denied/i.test(message)) return '資料庫權限尚未設定完成，請確認 products 資料表及 RLS policies。';
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
  if (!client) {
    showLoginError('登入功能尚未啟動。請重新整理頁面；若仍出現此訊息，請回報給管理者檢查設定。');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (errorBox) { errorBox.textContent = ''; errorBox.classList.add('hidden'); }
  button.disabled = true;
  button.textContent = '登入中…';
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) throw error;
    setSignedIn(data.user);
  } catch (error) { showLoginError(friendlyError(error)); }
  finally { button.disabled = false; button.textContent = '登入'; }
});
$('logout-button').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error) setStatus(friendlyError(error), true);
});
$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = searchName.value.trim();
  if (!name) return;
  hideProductPanels(); setStatus('查詢中…');
  try {
    const product = await lookupProduct(name);
    if (product) showProduct(product);
    else { selectedProduct = null; notFound.classList.remove('hidden'); setStatus('找不到這項產品。'); }
  } catch (error) { setStatus(friendlyError(error), true); }
});
$('yes-add').addEventListener('click', () => openForm('add'));
$('no-add').addEventListener('click', () => { hideProductPanels(); searchName.value = ''; selectedProduct = null; setStatus('已返回首頁。'); searchName.focus(); });
$('edit-button').addEventListener('click', () => { if (selectedProduct) openForm('edit', selectedProduct); });
productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const product = { name: $('form-name').value.trim(), code: $('form-code').value.trim(), location: $('form-location').value.trim() };
  if (!product.name || !product.code || !product.location) { setStatus('請完整填寫產品名、代碼與庫存位置。', true); return; }
  const button = productForm.querySelector('button[type="submit"]'); button.disabled = true;
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
$('cancel-form').addEventListener('click', () => { hideProductPanels(); if (formMode === 'edit' && selectedProduct) showProduct(selectedProduct, '已取消變更。'); else setStatus('已取消新增。'); });

async function initialize() {
  if (!configReady) {
    showLoginError('Supabase 設定尚未填入 Project URL 或 publishable key。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  if (!window.supabase?.createClient) {
    showLoginError('Supabase JavaScript SDK 沒有載入，請確認網路可連線到 CDN，並重新整理。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  try {
    client = window.supabase.createClient(config.url, config.anonKey);
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    setSignedIn(data.session?.user || null);
    client.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user || null));
  } catch (error) { showLoginError(friendlyError(error)); }
}
initialize();
