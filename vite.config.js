import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuration Vite pour construire l'interface.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",       // dossier de sortie de la compilation
  },
});
