/**
 * Configuración de la compilación de la prueba de humo.
 *
 * Lo único que cambia respecto de la app es la sustitución de dos módulos de
 * estado por sus dobles: el store (ver `tienda-doble.js`) y la sesión (ver
 * `sesion-doble.js`). Se hace con un plugin y no con `resolve.alias` porque
 * los módulos se importan con rutas relativas distintas según el archivo, y el
 * alias compara contra el especificador escrito, no contra la ruta ya resuelta.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const DOBLES = [
  {
    parcial: 'estado/tienda',
    final: 'src/estado/tienda.js',
    doble: fileURLToPath(new URL('./tienda-doble.js', import.meta.url)),
  },
  {
    parcial: 'estado/sesion',
    final: 'src/estado/sesion.js',
    doble: fileURLToPath(new URL('./sesion-doble.js', import.meta.url)),
  },
];

function sustituirEstado() {
  return {
    name: 'humo-sustituir-estado',
    enforce: 'pre',
    async resolveId(fuente, importador, opciones) {
      const caso = DOBLES.find((d) => fuente.includes(d.parcial));
      if (!caso) return null;
      const resuelto = await this.resolve(fuente, importador, { ...opciones, skipSelf: true });
      if (!resuelto) return null;
      return resuelto.id.replaceAll('\\', '/').endsWith(caso.final) ? caso.doble : null;
    },
  };
}

export default defineConfig({
  plugins: [sustituirEstado(), react()],
  css: { postcss: { plugins: [] } },
});
