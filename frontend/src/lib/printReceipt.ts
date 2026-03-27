// ─────────────────────────────────────────────
//  printReceipt — browser print, no library needed
//  Opens a hidden iframe, injects styled HTML, calls print()
// ─────────────────────────────────────────────

export interface ReceiptItem {
  menuItemName:      string;
  quantity:          number;
  unitPrice:         number;
  totalPrice:        number;
  selectedModifiers: { name: string; priceAdjustment: number }[];
  notes?:            string;
}

export interface ReceiptData {
  orderNumber:  string;
  items:        ReceiptItem[];
  subtotal:     number;
  total:        number;
  paymentMethod:'cash' | 'card' | 'split';
  cashAmount?:  number;
  cardAmount?:  number;
  cashierName?: string;
  createdAt?:   string;
  restaurantName?: string;
}

export function printReceipt(data: ReceiptData): void {
  const {
    orderNumber, items, subtotal, total,
    paymentMethod, cashAmount, cardAmount,
    cashierName, createdAt, restaurantName = 'CheezyHub',
  } = data;

  const now = createdAt
    ? new Date(createdAt).toLocaleString('en-PK', { hour12: true })
    : new Date().toLocaleString('en-PK', { hour12: true });

  const itemRows = items.map((item) => {
    const mods = item.selectedModifiers.length
      ? `<div class="mods">${item.selectedModifiers.map((m) => m.name).join(', ')}</div>`
      : '';
    const note = item.notes ? `<div class="note">Note: ${item.notes}</div>` : '';
    return `
      <tr>
        <td>
          <span class="qty">${item.quantity}x</span> ${item.menuItemName}
          ${mods}${note}
        </td>
        <td class="right">Rs.${item.totalPrice.toFixed(0)}</td>
      </tr>`;
  }).join('');

  const payRow = paymentMethod === 'split'
    ? `<tr><td>Cash</td><td class="right">Rs.${(cashAmount ?? 0).toFixed(0)}</td></tr>
       <tr><td>Card</td><td class="right">Rs.${(cardAmount ?? 0).toFixed(0)}</td></tr>`
    : `<tr><td>${paymentMethod === 'cash' ? 'Cash' : 'Card'}</td>
       <td class="right">Rs.${total.toFixed(0)}</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      padding: 8px;
      color: #000;
    }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .right  { text-align: right; }
    .name   { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .divider{ border-top: 1px dashed #000; margin: 6px 0; }
    table   { width: 100%; border-collapse: collapse; }
    td      { padding: 2px 0; vertical-align: top; }
    td:last-child { white-space: nowrap; padding-left: 8px; }
    .qty    { font-weight: bold; }
    .mods   { font-size: 10px; color: #444; padding-left: 12px; }
    .note   { font-size: 10px; color: #666; padding-left: 12px; font-style: italic; }
    .total-row td { font-weight: bold; font-size: 13px; padding-top: 4px; }
    .footer { margin-top: 10px; font-size: 10px; }
    @media print {
      body { width: auto; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="center name">${restaurantName}</div>
  <div class="center" style="font-size:10px;margin-bottom:4px;">Counter Order</div>
  <div class="divider"></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
    <span class="bold">${orderNumber}</span>
    <span style="font-size:10px;">${now}</span>
  </div>
  ${cashierName ? `<div style="font-size:10px;margin-bottom:4px;">Cashier: ${cashierName}</div>` : ''}
  <div class="divider"></div>

  <table>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="divider"></div>
  <table>
    <tr><td>Subtotal</td><td class="right">Rs.${subtotal.toFixed(0)}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">Rs.${total.toFixed(0)}</td></tr>
  </table>

  <div class="divider"></div>
  <div class="bold" style="margin-bottom:2px;">Payment</div>
  <table>
    <tbody>${payRow}</tbody>
  </table>

  <div class="divider"></div>
  <div class="center footer">Thank you! Come again 🧀</div>
</body>
</html>`;

  // Inject into hidden iframe and print
  let iframe = document.getElementById('__receipt_frame') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id    = '__receipt_frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try { iframe!.contentWindow?.print(); } catch { window.print(); }
  }, 300);
}
