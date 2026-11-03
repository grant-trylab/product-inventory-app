const $ = (id) => document.getElementById(id);
const config = window.INVENTORY_SUPABASE_CONFIG || {};
let supabase = null;
let selectedProduct = null;
let formMode = 'add';
let suggestionRequest = 0;
let suggestionTimer = null;
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
function hidePanels() {
  result.classList.add('hidden');
  notFound.classList.add('hidden');
  productForm.classList.add('hidden');
}
function clearSuggestions() {
  suggestionRequest += 1;
  suggestionList.replaceChildren();
  suggestionList.classList.add('hidden');
}
function showProduct(product, message = '查詢成功。') {
  hidePanels();
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
    hidePanels();
    clearSuggestions();
    selectedProduct = null;
  }
}
function errorMessage(error) {
  const message = error?.message || '發生未知錯誤。';
  if (/invalid login credentials/i.test(message)) return '帳號或密碼錯誤，請確認帳號是在此 Supabase 專案建立。';
  if (/email not confirmed/i.test(message)) return '此帳號的 Email 尚未確認。';
  if (/failed to fetch|networkerror/i.test(message)) return '連線 Supabase 失敗，請確認網路及專案設定。';
  if (/row-level security|permission denied/i.test(message)) return '資料庫權限尚未設定完成，請確認 products 表及 RLS policies。';
  if (/duplicate key|products_name_key/i.test(message)) return '這個產品名稱已存在。';
  return message;
}
function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}
async function searchProducts(term, limit = 8) {
  const pattern = `%${escapeLike(term.trim())}%`;
  const { data, error } = await supabase
    .from('products')
    .select('id,name,code,location')
    .ilike('name', pattern)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data || [];
}
function showSuggestions(products) {
  suggestionList.replaceChildren();
  products.forEach((product) => {
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
  });
  suggestionList.classList.toggle('hidden', products.length === 0);
}
async function updateSuggestions() {
  const term = searchName.value.trim();
  clearTimeout(suggestionTimer);
  clearSuggestions();
  if (term.length < 1 || !supabase) return;
  const requestId = suggestionRequest;
  suggestionTimer = setTimeout(async () => {
    try {
      const products = await searchProducts(term);
      if (requestId !== suggestionRequest || term !== searchName.value.trim()) return;
      showSuggestions(products);
    } catch (error) {
      if (requestId === suggestionRequest) setStatus(errorMessage(error), true);
    }
  }, 200);
}
function openForm(mode, product = null) {
  hidePanels();
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
  const button = event.currentTarget.querySelector('button[type="submit"]');
  loginError.textContent = '';
  loginError.classList.add('hidden');
  button.disabled = true;
  button.textContent = '登入中…';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    if (error) throw error;
    setSignedIn(data.user);
  } catch (error) {
    showLoginError(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = '登入';
  }
});

$('logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) setStatus(errorMessage(error), true);
});
searchName.addEventListener('input', updateSuggestions);
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
  hidePanels();
  setStatus('查詢中…');
  try {
    const products = await searchProducts(term, 20);
    if (products.length === 1 && products[0].name.toLocaleLowerCase() === term.toLocaleLowerCase()) {
      showProduct(products[0]);
    } else if (products.length === 1) {
      showProduct(products[0], '找到相符產品。');
    } else if (products.length > 1) {
      showSuggestions(products);
      setStatus('找到多筆相符產品，請從輸入框下方選擇。');
    } else {
      selectedProduct = null;
      notFound.classList.remove('hidden');
      setStatus('找不到相符產品。');
    }
  } catch (error) {
    setStatus(errorMessage(error), true);
  }
});
$('yes-add').addEventListener('click', () => openForm('add'));
$('no-add').addEventListener('click', () => {
  hidePanels();
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
    const query = formMode === 'edit' && selectedProduct
      ? supabase.from('products').update(product).eq('id', selectedProduct.id).select('id,name,code,location').single()
      : supabase.from('products').insert(product).select('id,name,code,location').single();
    const { data, error } = await query;
    if (error) throw error;
    searchName.value = data.name;
    showProduct(data, formMode === 'edit' ? '產品資料已更新並儲存到共用資料庫。' : '產品已新增並儲存到共用資料庫。');
  } catch (error) {
    setStatus(errorMessage(error), true);
  } finally {
    button.disabled = false;
  }
});
$('cancel-form').addEventListener('click', () => {
  hidePanels();
  if (formMode === 'edit' && selectedProduct) showProduct(selectedProduct, '已取消變更。');
  else setStatus('已取消新增。');
});

async function initialize() {
  if (!config.url || !config.anonKey || config.anonKey.includes('貼上')) {
    showLoginError('Supabase 設定尚未填入 Project URL 或 publishable key。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  if (!window.supabase?.createClient) {
    showLoginError('Supabase SDK 載入失敗，請確認網路連線並重新整理。');
    $('login-form').querySelector('button[type="submit"]').disabled = true;
    return;
  }
  try {
    supabase = window.supabase.createClient(config.url, config.anonKey);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSignedIn(data.session?.user || null);
    supabase.auth.onAuthStateChange((_event, session) => setSignedIn(session?.user || null));
  } catch (error) {
    showLoginError(errorMessage(error));
  }
}
initialize();
