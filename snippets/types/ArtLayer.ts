export interface ArtLayer {
  id: string;
  name: string;
  url: string;
  x: number;          // Offset X em mm
  y: number;          // Offset Y em mm
  scale: number;      // Escala 10% a 400%
  rotation: number;   // Rotação -180 a 180°
  flipH: boolean;
  opacity: number;    // Opacidade de 0.0 a 1.0
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
  fadeEdge: 'none' | 'radial' | 'vignette' | 'linear-top' | 'linear-bottom' | 'linear-left' | 'linear-right';
  fadeAmount: number; // Porcentagem do esmaecimento de borda (0-100%)
  visible: boolean;
  zIndex: number;
}
