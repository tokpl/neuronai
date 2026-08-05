const list = document.getElementById('list');
const refresh = document.getElementById('refresh');

async function loadOrders() {
  list.innerHTML = '<li>Loading…</li>';
  try {
    const res = await fetch('http://127.0.0.1:4080/orders');
    const data = await res.json();
    list.innerHTML = '';
    for (const order of data.data ?? []) {
      const li = document.createElement('li');
      li.textContent = `${order.id} — ${order.status} — $${order.total}`;
      list.appendChild(li);
    }
  } catch {
    list.innerHTML = '<li>API offline (start apps/api)</li>';
  }
}

refresh.addEventListener('click', loadOrders);
loadOrders();
