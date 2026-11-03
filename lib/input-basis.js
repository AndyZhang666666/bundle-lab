// Provenance follows the data path, never keywords in user-entered source text.
export function inputBasis(kind) {
 if(!['builtin','manual'].includes(kind))throw Error('输入来源无效');
 const baseline=kind==='builtin'?'合成统计 · 非真实观测':'用户假设 · 待验证';
 return [
  {key:'adoption',label:'未买齐者采纳率',status:'行为假设 · 待验证',verify:'分层小流量试验记录未买齐人群的补齐率，保留未展示优惠的对照。'},
  {key:'fullShare',label:'原本已买齐占比',status:baseline,verify:'用同口径优惠前订单核对已买齐人数与覆盖分母，不能用领券后人群反推。'},
  {key:'costRatio',label:'商品成本率',status:'成本假设 · 待验证',verify:'核对采购与损耗口径；本模型没有扣履约、库存和运营成本。'},
  {key:'incompleteSpend',label:'未买齐者原有消费',status:baseline,verify:'只统计这组商品、只统计原本未买齐者，保持与覆盖人群一致。'},
  {key:'existingRedemption',label:'原买齐者领折扣率',status:'行为假设 · 待验证',verify:'分别记录原买齐与未买齐人群的领折扣行为，不用总转化率替代。'},
 ];
}
