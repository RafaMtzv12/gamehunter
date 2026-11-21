# Avance del proyecto: GameHunter

Última actualización: 21 de noviembre de 2026 (después de la actividad 0007, consumo de API REST).
Se actualizará en la sesión 7 (28 de noviembre) al integrar la cámara y las pestañas.

## Qué funciona

### Pantalla Ofertas
- Lista de 20 ofertas de juegos de PC obtenidas de la API de CheapShark (`/deals`).
- Cada oferta muestra imagen, nombre, tienda, precio con descuento (o "GRATIS"), precio normal tachado y porcentaje de ahorro.
- Nombre de la tienda obtenido de `/stores` (por ejemplo "Steam" en lugar del número 1).
- Indicador de carga mientras llegan los datos.
- Buscador por título del juego.
- Paginación con el botón "Cargar 20 más", sin ofertas repetidas.
- Jalar la lista hacia abajo para actualizarla.

### Pantalla Detalle
- Se abre al tocar una oferta (React Navigation, navegación en pila).
- Muestra 8 datos: tienda, precio normal, ahorro, calificación de la oferta, Metacritic, calificación de Steam, fecha de lanzamiento y último cambio de precio.
- Sección "Historial y otras tiendas" con el precio mínimo histórico y las 5 tiendas más baratas (`/games?id=`).
- Botón "Ver oferta en la tienda" que abre la oferta en el navegador.

### Manejo de errores y sin internet
- La app no se cierra sin internet y las peticiones no bloquean la interfaz (async/await con try/catch).
- Sin conexión en la primera carga o en una búsqueda: pantalla de error con botón "Reintentar".
- Si falla "Cargar 20 más" o la actualización, se muestra un aviso y la lista ya cargada se conserva.
- Límite de 10 segundos por petición y mensajes distintos para sin internet, tiempo agotado y demasiadas peticiones (429).
- Cada petición se identifica con un User-Agent propio (CheapShark lo exige) y pide datos frescos (sin caché).

## Qué falta

- [ ] Navegación con pestañas: Ofertas, Mis deseos, Comparar en tienda y Ajustes (sesión 7).
- [ ] Comparar en tienda: tomar o elegir una foto del juego en la tienda física con la cámara, pedir el permiso, explicar para qué se usa y comparar sin foto si se niega (sesión 7).
- [ ] Mis deseos: agregar y quitar juegos de la lista de deseos, guardada con AsyncStorage.
- [ ] Ajustes: tipo de cambio USD a MXN, tienda favorita y tema claro u oscuro, guardados con AsyncStorage.
- [ ] Precio aproximado en pesos usando el tipo de cambio guardado.
- [ ] Guardar la última lista de ofertas para mostrarla sin internet, indicando de cuándo es.
- [ ] Nombre e ícono propios de la app (todavía son los de la plantilla).
- [ ] README completo con capturas de cada pantalla, tecnologías y cómo ejecutarlo.
- [ ] APK de prueba en Releases y video demo de 2 a 3 minutos (entrega final, 5 de diciembre).

## Cómo probar el avance

```
git clone https://github.com/RafaMtzv12/gamehunter.git
cd gamehunter
npm install
npx expo start --tunnel
```

Escanear el código QR con Expo Go en un teléfono Android o iPhone.

## Tecnologías

- React Native con Expo SDK 58 y JavaScript.
- React Navigation 7 (native-stack).
- fetch, async/await y JSON para consumir la API REST de CheapShark (sin llave).
- @expo/vector-icons (Ionicons) y react-native-safe-area-context.
