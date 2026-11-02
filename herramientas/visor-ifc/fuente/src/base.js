// Raíz de la app calculada desde este script (src/ en desarrollo, assets/ al compilar).
// Así funciona en cualquier subcarpeta de una web, con o sin "/" al final de la URL.
export const ROOT = new URL("..", import.meta.url).href;
