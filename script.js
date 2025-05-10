const dbName = "shortcutsDB";
const storeName = "shortcuts";

// IndexedDB 初期化
let db;
const request = indexedDB.open(dbName, 1);
request.onerror = () => alert("DBエラー");
request.onsuccess = (event) => {
  db = event.target.result;
  renderShortcuts();
};
request.onupgradeneeded = (event) => {
  db = event.target.result;
  db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
};

// タイトル取得用iframe
const iframe = document.getElementById("title-fetcher");

function addShortcut() {
  const url = document.getElementById("new-url").value;
  if (!url) return;

  const hostname = new URL(url).hostname;

  // ① favicon取得（キャッシュ確認）
  let favicon = localStorage.getItem(`favicon:${hostname}`);
  if (!favicon) {
    favicon = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    fetch(favicon)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem(`favicon:${hostname}`, reader.result);
        };
        reader.readAsDataURL(blob);
      });
  }

  // ② iframeでタイトル取得
  iframe.src = url;
  iframe.onload = () => {
    try {
      const title = iframe.contentDocument.title || url;
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      store.add({ url, title, favicon });
      transaction.oncomplete = () => renderShortcuts();
    } catch (e) {
      alert("タイトル取得に失敗しました（CORS）");
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      store.add({ url, title: url, favicon });
      transaction.oncomplete = () => renderShortcuts();
    }
  };
}

function renderShortcuts() {
  const transaction = db.transaction([storeName], "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.getAll();

  request.onsuccess = () => {
    const list = document.getElementById("shortcuts");
    list.innerHTML = "";
    request.result.forEach(item => {
      const div = document.createElement("div");
      div.className = "shortcut";
      div.innerHTML = `
        <img class="favicon" src="${item.favicon}" alt="favicon">
        <a href="${item.url}" target="_blank" style="color:#90caf9">${item.title}</a>
        <button onclick="deleteShortcut(${item.id})">❌</button>
      `;
      list.appendChild(div);
    });
  };
}

function deleteShortcut(id) {
  const transaction = db.transaction([storeName], "readwrite");
  const store = transaction.objectStore(storeName);
  store.delete(id);
  transaction.oncomplete = () => renderShortcuts();
}

function exportShortcuts() {
  const transaction = db.transaction([storeName], "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.getAll();
  request.onsuccess = () => {
    const blob = new Blob([JSON.stringify(request.result)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shortcuts_backup.json";
    a.click();
  };
}

function importShortcuts(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const shortcuts = JSON.parse(reader.result);
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    shortcuts.forEach(item => store.add(item));
    transaction.oncomplete = () => renderShortcuts();
  };
  reader.readAsText(file);
}

function searchGoogle() {
  const q = document.getElementById("search").value;
  if (q) window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
function clearShortcuts() {
  if (confirm("本当に全てのショートカットを削除しますか？")) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    transaction.oncomplete = () => renderShortcuts();
  }
}