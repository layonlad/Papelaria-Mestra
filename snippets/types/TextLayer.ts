export interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  rotation: number;
  bold: boolean;
  italic: boolean;
  stroke: boolean;       // Contorno branco para contraste sobre estampas
  strokeWidth: number;
  x: number;             // Coordenada mm na folha
  y: number;             // Coordenada mm na folha
  type: 'text' | 'number';
}
