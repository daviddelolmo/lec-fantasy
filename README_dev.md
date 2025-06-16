
# LEC Fantasy - Dev Notes

## ✅ Cambios Aplicados
- Migración total de SCSS a la sintaxis moderna de Sass Modules.
- Reemplazo de funciones globales obsoletas:
  - `map-get()` → `map.get()`
  - `map-has-key()` → `map.has-key()`
  - `nth()` → `list.nth()`
  - `type-of()` → `meta.type-of()`
- Inclusión de `@use "sass:map"`, `sass:list`, y `sass:meta` según necesidad.

## 📦 Instalación y arranque

### 1. Instalar dependencias
```bash
npm install
```

### 2. Corregir posibles vulnerabilidades (opcional)
```bash
npm audit fix --force
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. Ver en navegador
Accede a: [http://localhost:4321](http://localhost:4321)

---

## 🧠 Notas Técnicas

- Asegúrate de estar usando `Dart Sass` (no `node-sass`).
- Las funciones como `map.get()` o `list.nth()` requieren `@use` de sus respectivos módulos.
- Este proyecto está listo para futuras versiones de Sass (v3.0+).
