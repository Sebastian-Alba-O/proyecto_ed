# Proyecto ED - Zonas viables para inversión inmobiliaria (Tunja)

Demo inicial offline para la asignatura de Ecuaciones Diferenciales. Esta versión es un prototipo ligero hecho con HTML/CSS/JS y Leaflet para mostrar la interfaz principal y una forma simple de calcular un "beneficio" por barrio usando la fórmula indicada por el grupo.

Archivos principales:
- `index.html` - página principal (abrir en el navegador)
- `src/style.css` - estilos
- `src/app.js` - lógica del mapa y filtros
- `data/sample_parcelas.geojson` - datos de ejemplo (3 barrios)

Cómo abrir (con servidor local)
1. Si usas XAMPP: copia la carpeta del proyecto a `C:\xampp\htdocs\proyecto_ed` y arranca Apache desde XAMPP Control Panel. Abre:

    http://localhost/proyecto_ed/index.html

2. O con Python (rápido): abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
python -m http.server 8000;
```

y abre:

    http://localhost:8000/

Notas
- Si ves errores de "Failed to find a valid digest in the 'integrity' attribute..." es porque una versión previa del archivo incluía atributos SRI inválidos. Abre DevTools (F12) → Network / Console para verlos.
- Si abriste el archivo con doble click (file://), es probable que fetch sea bloqueado. Usa servidor local o modifica `src/app.js` para embedir los datos.

Próximos pasos sugeridos:
- Añadir carga por archivo (input type=file) para permitir pruebas offline sin servidor.
- Añadir parámetros editables (Cc, A, d, m) en la UI.
- Reemplazar `data/sample_parcelas.geojson` con datos reales del DANE y catastro.
# proyecto_ed