/**
 * Configuración de la compilación de la prueba de humo.
 *
 * Lo único que cambia respecto de la app es la sustitución del store por su
 * doble (ver `tienda-doble.js` para el porqué). Se hace con un plugin y no con
 * `resolve.alias` porque los módulos se importan con rutas relativas distintas
 * según el archivo, y el alias compara contra el especificador escrito, no
 * contra la ruta ya resuelta.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const DOBLE = fileURLToPath(new URL('./tienda-doble.js', import.meta.url));

function sustituirTienda() {
  return {
    name: 'humo-sustituir-tienda',
    enforce: 'pre',
    async resolveId(fuente, importador, opciones) {
      if (!fuente.includes('estado/tienda')) return null;
      const resuelto = await this.resolve(fuente, importador, { ...opciones, skipSelf: true });
      if (!resuelto) return null;
      return resuelto.id.replaceAll('\\', '/').endsWith('src/estado/tienda.js') ? DOBLE : null;
    },
  };
}

export default defineConfig({
  plugins: [sustituirTienda(), react()],
  css: { postcss: { plugins: [] } },
});
