// Reach is a model assumption about existing full-basket buyers, never proven isolation.
// Applying it preserves the complete source draft, including CSV and provenance metadata.
export const TARGETING_PRESETS = [
  {id:'public-menu',label:'公开菜单',rate:1,description:'假设所有既有整套顾客都领折扣。'},
  {id:'manual-coupon',label:'人工发券',rate:.5,description:'估计一半既有整套顾客领折扣；需要核实发券对象和转用情况。'},
  {id:'checkout-addon',label:'结账加购',rate:.15,description:'估计15%既有整套顾客仍领折扣，仍有存量让利。'},
];
export const targetingPreset = rate => TARGETING_PRESETS.find(p=>p.rate===rate)||null;
export function applyTargetingPreset(draft,id){
  const preset=TARGETING_PRESETS.find(p=>p.id===id);
  if(!preset)throw Error('请选择有效的定向触达假设');
  return {...draft,existingRedemption:preset.rate};
}
