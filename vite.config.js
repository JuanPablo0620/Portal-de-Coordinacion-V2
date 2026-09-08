import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /**
     * Proxy al geoportal municipal.
     *
     * No es una comodidad de desarrollo: sin él el módulo de Mapa no funciona
     * en ningún lado. El geoportal manda DOS veces el header
     * `access-control-allow-origin: *` —lo agregan GeoServer y el nginx que
     * tiene delante— y el navegador rechaza la respuesta por eso mismo
     * («contains multiple values '*, *', but only one is allowed»). Con curl no
     * se nota: es una regla del navegador, no del servidor.
     *
     * Pidiéndolo al mismo origen no hay CORS que chequear. En producción lo
     * resuelve el rewrite de `vercel.json`, con la misma ruta `/geo`.
     */
    proxy: {
      '/geo': {
        target: 'https://geoportal.tresdefebrero.gob.ar',
        changeOrigin: true,
        rewrite: (ruta) => ruta.replace(/^\/geo/, ''),
      },
    },
  },
});
