# =====================================================================
#  Dockerfile de l'interface — Garderie École d'Hesloup
#
#  "Multi-étapes" : deux temps dans un seul fichier.
#    Étape 1 (build)  : Node compile le React en fichiers web statiques.
#    Étape 2 (service): nginx sert ces fichiers, très léger et rapide.
#
#  Résultat : une image finale minuscule qui ne contient QUE le site
#  compilé + nginx (pas Node, pas les sources).
# =====================================================================

# ---------- Étape 1 : construction ----------
FROM node:20-alpine AS build
WORKDIR /app

# Installer les dépendances (meilleur cache : on copie d'abord package.json)
COPY package.json package-lock.json* ./
RUN npm install

# Copier le reste du projet et compiler
COPY . .
RUN npm run build
# -> le site compilé se retrouve dans /app/dist

# ---------- Étape 2 : service ----------
FROM nginx:alpine

# Configuration nginx : sert le site et gère le routage d'une appli monopage
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Récupérer UNIQUEMENT le site compilé depuis l'étape 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
