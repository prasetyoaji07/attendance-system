#!/usr/bin/env bash
set -e
command -v node >/dev/null || { echo "Node.js belum terpasang (butuh LTS)."; exit 1; }
echo "Node $(node -v)"
[ -f server/.env ] || cp server/.env.example server/.env
[ -f client/.env ] || cp client/.env.example client/.env
npm install
npm install --prefix server
npm install --prefix client
[ -d .git ] || git init >/dev/null 2>&1 || true
echo "SELESAI. Isi server/.env lalu jalankan: npm run dev"
