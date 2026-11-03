const $ = (id) => document.getElementById(id);
const config = window.INVENTORY_SUPABASE_CONFIG || {};
const configReady = Boolean(
  config.url && config.anonKey &&
  !config.url.includes('PASTE_') &&
  !config.anonKey.includes('PASTE_')
);
let client = null;
let selectedProduct = null;
let formMode = 'add';
let suggestionTimer = null;
let suggestionVersion = 0;

const authPanel = $('auth-panel');
const inventoryPanel = $('inventory-panel');
const status = $('status');
const result = $('result');
const notFound = $('not-found');
const productForm = $('product-form');
const searchName = $('search-name');
const suggestionList = $('product-suggestions');
const loginError = $('login-error');

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
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
function clearSuggestions() {
  suggestionVersion += 1;
  clearTimeout(suggestionTimer);
  suggestionList.replaceChildren();
  suggestionList.classList.add('hidden');
}
function showProduct(product, message = '查詢成功。') {
  hideProductPanels();
  clearSuggestions();
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
    clearSuggestions();
    selectedProduct = null;
  }
}
function friendlyError(error) {
  const message = error?.message || '發生未知錯誤。';
  if (/invalid login credentials/i.test(message)) return '帳號或密碼錯誤，請確認帳號是在此 Supabase 專案建立。';
  if (/email not confirmed/i.test(message)) return '此帳號的 Email 尚未確認。';
  if (/failed to fetch|networkerror/i.test(message)) return '連線 Supabase 失敗。請確認網路及專案設定。';
  if (/row-level security|permission denied/i.test(message)) return '資料庫權限尚未設定完成，請確認 products 資料表及 RLS policies。';
  if (/duplicate key|products_name_key/i.test(message)) return '這個產品名稱已存在。';
  return message;
}
function escapeLike(value) {
  return value.replace(/[\\%_*]/g, '\\$&');
}
async function searchProducts(term, limit = 10) {
  const { data, error } = await client
    .from('products')
    .select('id,name,code,location')
    .ilike('name', `%${escapeLike(term)}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data || [];
}
function renderSuggestions(products) {
  suggestionList.replaceChildren();
  for (const product of products) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'suggestion-option';
    option.setAttribute('role', 'option');
    option.textContent = product.name;
    option.addEventListener('click', () => {
      searchName.value = product.name;
      showProduct(product);
    });
    suggestionList.appendChild(option);
  }
  suggestionList.classList.toggle('hidden', products.length === 0);
}
function onSearchInput() {
  clearSuggestions();
  const term = searchName.value.trim();
  if (!client || !term) return;
  const version = suggestionVersion;
  suggestionTimer = setTimeout(async () => {
    try {
      const products = await searchProducts(term);
      if (version !== suggestionVersion || searchName.value.trim() !== term) return;
      renderSuggestions(products);
    } catch (error) {
      if (version === suggestionVersion) setStatus(friendlyError(error), true);
    }
  }, 250);
}
function openForm(mode, product = null) {
  hideProductPanels();
  clearSuggestions();
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
    showLoginError('登入服務尚未初始化，請重新整理頁面；若仍無法登入，請把這則訊息告訴我。');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  loginError.textContent = '';
  loginError.classList.add('hidden');
  button.disabled = true;
  button.textContent = '登入中…';
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    if (error) throw error;
    setSignedIn(data.user);
  } catch (error) {
    showLoginError(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = '登入';
  }
});

$('logout-button').addEventListener('click', async () => {
  const { error } = await client.auth.signOut();
  if (error) setStatus(friendlyError(error), true);
});
searchName.addEventListener('input', onSearchInput);
searchName.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearSuggestions();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-box')) clearSuggestions();
});
$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = searchName.value.trim();
  if (!term) return;
  clearSuggestions();
  hideProductPanels();
  setStatus('查詢中…');
  try {
    const products = await searchProducts(term, 20);
    if (products.length === 1) {
      showProduct(products[0]);
    } else if (products.length > 1) {
      renderSuggestions(products);
      setStatus('找到多筆相符產品，請從下拉清單選擇。');
    } else {
      selectedProduct = null;
      notFound.classList.remove('hidden');
      setStatus('找不到相符產品。');
    }
  } catch (error) {
    setStatus(friendlyError(error), true);
  }
});

$('yes-add').addEventListener('click', () => openForm('add'));
$('no-add').addEventListener('click', () => {
  hideProductPanels();
  clearSuggestions();
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
  } catch (error) {
    setStatus(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
});
$('cancel-form').addEventListener('click', () => {
  hideProductPanels();
  if (formMode === 'edit' && selectedProduct) showProduct(selectedProduct, '已取消變更。');
  else setStatus('已取消新增。');
});

async function initialize() {
  if (!configReady) {
    showLoginError('Supabase 設定尚未填入 Project URL 或 publishable key。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  if (!window.supabase?.createClient) {
    showLoginError('Supabase SDK 載入失敗，請確認網路可連線到 CDN 後重新整理。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  try {
    client = window.supabase.createClient(config.url, config.anonKey);
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    setSignedIn(data.session?.user || null);
    client.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user || null));
  } catch (error) {
    showLoginError(friendlyError(error));
  }
}
initialize();
