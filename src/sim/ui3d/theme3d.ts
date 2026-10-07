// 3D scene palette (Brief 3 §3). Colours mirror the app tokens (light primary; dark dims the
// ground and fog) and the reference's soft toy look: periwinkle ground, accent-blue
// warehouses, white/kraft goods, muted teal accents. No bloom, no neon.

export interface Palette3D {
  ground: string
  road: string
  marking: string
  page: string
  warehouse: string
  warehouseSide: string
  warehouseRoof: string
  warehouseRoofRib: string
  door: string
  doorLine: string
  office: string
  officeRoof: string
  truckBox: string
  truckCab: string
  wheel: string
  van: string
  forklift: string
  forkliftDark: string
  pallet: string
  carton: string
  cartonAlt: string
  container: string
  tree: string
  treeDark: string
  trunk: string
  beam: string
  rackFrame: string
  isdFloor: string
  pin: string
  sun: string
  hemiSky: string
  hemiGround: string
  fog: string
}

export const LIGHT: Palette3D = {
  ground: '#dbe3f4',
  road: '#eceff9',
  marking: '#ffffff',
  page: '#f1f4f9',
  warehouse: '#5d74e6',
  warehouseSide: '#3e55d8',
  warehouseRoof: '#8c9cf0',
  warehouseRoofRib: '#7187ea',
  door: '#dfe6fa',
  doorLine: '#b9c6ef',
  office: '#ffffff',
  officeRoof: '#5d74e6',
  truckBox: '#ffffff',
  truckCab: '#3e55d8',
  wheel: '#2b3548',
  van: '#f2f5fc',
  forklift: '#f5b73d',
  forkliftDark: '#c98d18',
  pallet: '#c99a62',
  carton: '#d2a86f',
  cartonAlt: '#c39a5e',
  container: '#2cc4a8',
  tree: '#7cc9a4',
  treeDark: '#5aa887',
  trunk: '#a8794f',
  beam: '#f0a35a',
  rackFrame: '#5d74e6',
  isdFloor: '#fce9d8',
  pin: '#3e55d8',
  sun: '#ffffff',
  hemiSky: '#eaf0ff',
  hemiGround: '#c6d2ea',
  fog: '#f1f4f9',
}

export const DARK: Palette3D = {
  ...LIGHT,
  ground: '#1c2440',
  road: '#26304f',
  marking: '#8fa0c6',
  page: '#0d1222',
  warehouse: '#4c62cf',
  warehouseSide: '#37479f',
  warehouseRoof: '#6a7cd8',
  office: '#8f9bc0',
  officeRoof: '#4c62cf',
  van: '#39445f',
  pallet: '#8a6a44',
  carton: '#93744a',
  tree: '#3f7a61',
  treeDark: '#2f5c49',
  isdFloor: '#3a2c1c',
  pin: '#7086f2',
  hemiSky: '#2a3454',
  hemiGround: '#141b30',
  fog: '#0d1222',
}
