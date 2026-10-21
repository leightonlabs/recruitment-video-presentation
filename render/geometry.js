// 占位主图与点云共用的几何参数，保证二者构图一致、粒子转场能对上。
export const HERO_CAMERA = { fov: 32, position: [0, 0.35, 7], target: [0, 0.2, 0] };

export const HERO_GEOMETRY = {
  pipeR: 0.5,
  flangeR: 0.85,
  flangeT: 0.12,
  flangeX: [-0.09, 0.09],
  boltR: 0.72,
  stain: [0.02, -0.62, 0.62],   // 锈迹与渗漏水痕中心（法兰下沿正面）
  steam: [0.2, -0.78, 0.78],    // 蒸汽中心，挡住锈迹右下边缘
  gauge: [-2, 1.3, 0.05],       // 压力表中心
  gaugeR: 0.36,
  wheel: [2, 1.75, -0.3],       // 阀门手轮中心
};
