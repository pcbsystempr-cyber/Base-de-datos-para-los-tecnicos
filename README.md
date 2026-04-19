# COMPUTEC — Sistema de Gestión de Soluciones Técnicas
## Escuela Superior Vocacional Pablo Colón Berdecia · Departamento de Tecnología

---

## 📁 Archivos del Sistema

```
computec/
├── index.html    → Página principal (toda la estructura)
├── style.css     → Diseño visual completo
├── app.js        → Lógica del sistema
└── README.md     → Este archivo
```

---

## 🚀 Cómo usar

1. Abre `index.html` en tu navegador (Chrome o Edge recomendado)
2. Inicia sesión con las credenciales:
   - **Usuario:** `Tecnico`
   - **Contraseña:** `Tecnico2026`
3. ¡Listo! Ya puedes usar el sistema completo.

> No necesitas servidor ni instalación. Funciona directamente en el navegador.

---

## 🔐 Cambiar usuario y contraseña

Abre `app.js` y busca la línea:

```javascript
const CREDENTIALS = { user: 'Tecnico', pass: 'Tecnico2026' };
```

Cambia los valores de `user` y `pass` por los que desees.

---

## 🤖 Conectar la Inteligencia Artificial

La sección de IA usa la API de Claude (Anthropic).

### Para que funcione:
1. Ve a https://console.anthropic.com y crea una cuenta
2. Obtén tu API Key
3. Abre `app.js` y busca el fetch a la API:
   ```javascript
   const response = await fetch('https://api.anthropic.com/v1/messages', {
   ```
4. Agrega tu API key en los headers:
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'x-api-key': 'TU-API-KEY-AQUI',
     'anthropic-version': '2023-06-01'
   },
   ```

> **Nota:** Cuando se usa en Claude.ai (donde fue creado), la API key es manejada automáticamente. Si lo despliegas en tu propio servidor, necesitarás configurar un backend para no exponer la key.

---

## 💾 Almacenamiento de datos

Los datos se guardan en **localStorage** del navegador. Esto significa:
- Los datos persisten aunque cierres el navegador
- Son solo visibles en ese mismo computador y navegador
- Para compartir entre varios equipos, necesitarías agregar Supabase o Firebase

### Estructura de datos de cada registro:
```json
{
  "id": "r_1234567890",
  "techName": "Juan García",
  "grade": "11mo",
  "group": "B",
  "category": "Hardware",
  "priority": "normal",
  "status": "resuelto",
  "problem": "El monitor no enciende...",
  "solution": "Se verificó el cable de alimentación...",
  "notes": "Recomendado revisar periódicamente",
  "date": "2026-04-19",
  "time": "2:30 PM",
  "images": ["data:image/jpeg;base64,..."]
}
```

---

## 🗄️ Para agregar base de datos real (Supabase)

Si quieres que los datos sean compartidos entre todos los técnicos:

1. Crea cuenta en https://supabase.com
2. Crea proyecto nuevo
3. Ejecuta este SQL en el Editor de Supabase:

```sql
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  tech_name TEXT NOT NULL,
  grade TEXT,
  "group" TEXT,
  category TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'resuelto',
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  notes TEXT,
  date DATE,
  time TEXT,
  images TEXT[], -- array de base64
  created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar acceso público (para pruebas)
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON records FOR ALL USING (true);
```

4. Obtén tu `SUPABASE_URL` y `SUPABASE_ANON_KEY` del panel
5. Reemplaza las funciones `getData()` y `saveData()` en `app.js` con llamadas a Supabase

---

## 🎨 Características incluidas

- ✅ Login con protección de acceso
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Registro de problemas y soluciones
- ✅ Búsqueda y filtros avanzados
- ✅ Subida de múltiples imágenes
- ✅ Edición y eliminación de registros
- ✅ Confirmación antes de eliminar
- ✅ Gráficas estadísticas interactivas
- ✅ Asistente de IA técnico
- ✅ Modo oscuro
- ✅ Diseño responsive (móvil y computadora)
- ✅ Exportar a CSV
- ✅ Imprimir registros
- ✅ Copiar solución al portapapeles
- ✅ Alertas tipo toast elegantes
- ✅ Sistema de prioridades y estados
- ✅ Categorías de problemas

---

## 📞 Soporte

Sistema desarrollado para uso interno del Departamento de Tecnología COMPUTEC.
Escuela Superior Vocacional Pablo Colón Berdecia.
