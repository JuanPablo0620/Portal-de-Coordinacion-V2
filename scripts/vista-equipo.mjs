/** Vista local aislada: usa cuentas ficticias y nunca carga el cliente de producción. */
import { createServer, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import configuracion from '../vite.config.js';

const ruta = (nombre) => fileURLToPath(new URL(`../pruebas/equipo/${nombre}`, import.meta.url));
const servidor = await createServer(mergeConfig(configuracion, {
  configFile: false,
  resolve: { alias: [
    { find: /^(?:.*\/)?supabaseClient\.js$/, replacement: ruta('supabase.js') },
    { find: /^(?:.*\/)?sesion\.js$/, replacement: ruta('sesion.js') },
  ] },
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  plugins: [{
    name: 'vista-local-equipo', enforce: 'pre',
    transform(codigo, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/main.jsx')) {
        return `import { iniciarEscenario } from '/pruebas/equipo/escenario.js';\nawait iniciarEscenario();\n${codigo}`;
      }
    },
  }],
}));
await servidor.listen();
console.log('Vista local: http://127.0.0.1:5191/mi-seguimiento');
console.log('Datos ficticios. Recargar la página reinicia la demostración.');
