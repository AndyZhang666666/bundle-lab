// CSV 解析 + 订单画像统计。浏览器和 Node 脚本共用这一份。

export const CSV_HEADER = 'order_id,ts,daypart,party_size,sku,category,qty,unit_price';

/** 极简 CSV 解析：本项目的字段里不含逗号和引号，不引第三方库。 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], error: 'CSV 至少要有表头和一行数据' };
  const header = lines[0].split(',').map((h) => h.trim());
  const required = ['order_id', 'sku', 'qty', 'unit_price'];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) return { rows: [], error: `缺少必需列：${missing.join('、')}` };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = lines[i].split(',');
    const row = {};
    header.forEach((h, idx) => (row[h] = (cells[idx] ?? '').trim()));
    rows.push(row);
  }
  return { rows, error: null };
}

/** 明细行按订单号聚合成订单对象。 */
export function groupOrders(rows) {
  const map = new Map();
  for (const r of rows) {
    const id = r.order_id;
    if (!map.has(id)) {
      map.set(id, {
        orderId: id,
        ts: r.ts || '',
        daypart: r.daypart || inferDaypart(r.ts),
        partySize: Number(r.party_size || 1) || 1,
        lines: [],
        total: 0,
      });
    }
    const o = map.get(id);
    const qty = Number(r.qty || 1) || 1;
    const price = Number(r.unit_price || 0) || 0;
    o.lines.push({ sku: r.sku, category: r.category || '未分类', qty, unitPrice: price });
    o.total += qty * price;
  }
  return [...map.values()];
}

function inferDaypart(ts) {
  if (!ts) return 'unknown';
  const h = Number(String(ts).slice(11, 13));
  if (Number.isNaN(h)) return 'unknown';
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'tea';
  return 'dinner';
}

export function priceTable(rows) {
  const acc = {};
  for (const r of rows) {
    const p = Number(r.unit_price || 0) || 0;
    if (!acc[r.sku]) acc[r.sku] = p;
  }
  return acc;
}

export function categoryTable(rows) {
  const acc = {};
  for (const r of rows) if (!acc[r.sku]) acc[r.sku] = r.category || '未分类';
  return acc;
}

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 客单价分布做等宽分桶，桶宽按数据范围自适应。 */
export function histogram(values, bucketCount = 12) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return [{ label: String(min), count: values.length, from: min, to: max }];
  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx].count++;
  }
  return buckets.map((b) => ({ ...b, label: `${Math.round(b.from)}-${Math.round(b.to)}` }));
}

/**
 * 订单画像。核心是最后那个 mismatch 判断：
 * 多人订单占比高、但商品数只比单人多一点点 —— 说明用户想多买却没凑成套。
 * 这就是美团沙特那次分析里真正的信号，也是这个工具存在的理由。
 */
export function profile(orders) {
  const totals = orders.map((o) => o.total);
  const itemCounts = orders.map((o) => o.lines.reduce((s, l) => s + l.qty, 0));
  const group = orders.filter((o) => o.partySize >= 3);
  const single = orders.filter((o) => o.partySize < 3);

  const groupItems = mean(group.map((o) => o.lines.reduce((s, l) => s + l.qty, 0)));
  const singleItems = mean(single.map((o) => o.lines.reduce((s, l) => s + l.qty, 0)));
  const groupAOV = mean(group.map((o) => o.total));
  const singleAOV = mean(single.map((o) => o.total));
  const groupShare = orders.length ? group.length / orders.length : 0;

  const daypartCounts = {};
  for (const o of orders) daypartCounts[o.daypart] = (daypartCounts[o.daypart] || 0) + 1;

  const avgPartySizeGroup = mean(group.map((o) => o.partySize));
  // 人均商品数：多人订单是不是「按人头点够了」
  const itemsPerHeadGroup = avgPartySizeGroup ? groupItems / avgPartySizeGroup : 0;
  const itemsPerHeadSingle = singleItems;

  const itemsRatio = singleItems ? groupItems / singleItems : 0;
  const headRatio = itemsPerHeadSingle ? itemsPerHeadGroup / itemsPerHeadSingle : 0;

  let mismatch = null;
  if (groupShare >= 0.25 && headRatio < 0.8) {
    mismatch = {
      level: 'high',
      text: `多人订单占 ${(groupShare * 100).toFixed(1)}%，但人均商品数只有单人订单的 ${(headRatio * 100).toFixed(0)}% —— 这批人是按多人来的，却没按多人的量点。商品结构和点单结构错位，凑单环节大概率在流失。`,
    };
  } else if (groupShare >= 0.25 && itemsRatio < 1.6) {
    mismatch = {
      level: 'medium',
      text: `多人订单占 ${(groupShare * 100).toFixed(1)}%，商品数只比单人订单多 ${((itemsRatio - 1) * 100).toFixed(0)}% —— 多人点单没有换来成比例的商品数，值得看看是不是缺组合选项。`,
    };
  } else {
    mismatch = {
      level: 'low',
      text: `多人订单占 ${(groupShare * 100).toFixed(1)}%，人均商品数与单人订单接近（${(headRatio * 100).toFixed(0)}%），没有明显的凑单错位信号。套餐机会更可能在提客单而不是补结构。`,
    };
  }

  return {
    orderCount: orders.length,
    aov: mean(totals),
    aovMedian: median(totals),
    avgItems: mean(itemCounts),
    groupCount: group.length,
    singleCount: single.length,
    groupShare,
    groupAOV,
    singleAOV,
    groupItems,
    singleItems,
    itemsRatio,
    itemsPerHeadGroup,
    itemsPerHeadSingle,
    headRatio,
    aovHistogram: histogram(totals),
    itemHistogram: (() => {
      const acc = {};
      for (const c of itemCounts) acc[c] = (acc[c] || 0) + 1;
      return Object.entries(acc)
        .map(([k, v]) => ({ items: Number(k), count: v }))
        .sort((a, b) => a.items - b.items);
    })(),
    daypartCounts,
    mismatch,
  };
}
