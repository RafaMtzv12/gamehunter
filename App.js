import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API = 'https://www.cheapshark.com/api/1.0';
const POR_PAGINA = 20;
const TIEMPO_LIMITE = 10000;
const AGENTE = 'GameHunter/1.0 (https://github.com/RafaMtzv12/gamehunter)';

const COLORES = {
  morado: '#6C63FF',
  coral: '#FF6584',
  fondo: '#F4F3FF',
  tarjeta: '#FFFFFF',
  texto: '#222222',
  gris: '#777777',
  borde: '#E2E0F5',
  verde: '#2E9E5B',
};

const tema = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORES.morado,
    background: COLORES.fondo,
    card: COLORES.morado,
    text: '#FFFFFF',
  },
};

async function pedirJSON(url) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE);
  try {
    const respuesta = await fetch(url, {
      signal: controlador.signal,
      headers: {
        'User-Agent': AGENTE,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    if (!respuesta.ok) {
      const error = new Error('HTTP ' + respuesta.status);
      error.codigo = respuesta.status;
      throw error;
    }
    const datos = await respuesta.json();
    return datos;
  } finally {
    clearTimeout(temporizador);
  }
}

function mensajeDeError(error) {
  if (error && error.codigo === 429) {
    return 'La API recibio demasiadas peticiones. Espera un minuto y vuelve a intentar.';
  }
  if (error && error.codigo) {
    return 'El servidor respondio con un error (' + error.codigo + '). Intenta de nuevo.';
  }
  if (error && error.name === 'AbortError') {
    return 'La conexion tardo demasiado. Revisa tu internet y vuelve a intentar.';
  }
  return 'No hay conexion a internet. Revisa tu wifi o tus datos y vuelve a intentar.';
}

function dinero(valor) {
  return 'US$ ' + Number(valor).toFixed(2);
}

function precioOferta(valor) {
  return Number(valor) === 0 ? 'GRATIS' : dinero(valor);
}

function porcentaje(valor) {
  return Math.round(Number(valor)) + '%';
}

function fechaDeUnix(segundos) {
  const numero = Number(segundos);
  if (!numero) {
    return 'Sin dato';
  }
  const f = new Date(numero * 1000);
  const dia = String(f.getDate()).padStart(2, '0');
  const mes = String(f.getMonth() + 1).padStart(2, '0');
  return dia + '/' + mes + '/' + f.getFullYear();
}

function Boton({ titulo, icono, onPress, secundario }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        secundario && estilos.botonSecundario,
        pressed && { opacity: 0.7 },
      ]}
    >
      {icono ? (
        <Ionicons
          name={icono}
          size={18}
          color={secundario ? COLORES.morado : '#FFFFFF'}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[estilos.botonTexto, secundario && estilos.botonTextoSecundario]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

function TarjetaOferta({ oferta, tienda, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.7 }]}
    >
      <Image source={{ uri: oferta.thumb }} style={estilos.miniatura} resizeMode="contain" />
      <View style={estilos.tarjetaInfo}>
        <Text style={estilos.tarjetaTitulo} numberOfLines={2}>
          {oferta.title}
        </Text>
        <Text style={estilos.tarjetaTienda} numberOfLines={1}>
          {tienda}
        </Text>
        <View style={estilos.filaPrecios}>
          <Text style={estilos.precioOferta}>{precioOferta(oferta.salePrice)}</Text>
          <Text style={estilos.precioNormal}>{dinero(oferta.normalPrice)}</Text>
          <View style={estilos.insignia}>
            <Text style={estilos.insigniaTexto}>-{porcentaje(oferta.savings)}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORES.gris} />
    </Pressable>
  );
}

function PantallaOfertas({ navigation }) {
  const insets = useSafeAreaInsets();
  const [ofertas, setOfertas] = useState([]);
  const [tiendas, setTiendas] = useState({});
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const peticionActual = useRef(0);
  const tiendasCargadas = useRef(false);
  const cantidadOfertas = useRef(0);
  cantidadOfertas.current = ofertas.length;

  const cargarTiendas = useCallback(async () => {
    try {
      const lista = await pedirJSON(API + '/stores');
      const mapa = {};
      lista.forEach((t) => {
        mapa[t.storeID] = t.storeName;
      });
      setTiendas(mapa);
      tiendasCargadas.current = true;
    } catch (e) {
      tiendasCargadas.current = false;
    }
  }, []);

  const cargarPagina = useCallback(
    async (numero, titulo, modo) => {
      peticionActual.current = peticionActual.current + 1;
      const id = peticionActual.current;

      if (modo === 'inicio') {
        setEstado('cargando');
        setError('');
        setAviso('');
        setErrorMas('');
        setCargandoMas(false);
      }
      if (modo === 'refrescar') {
        setRefrescando(true);
        setAviso('');
        setErrorMas('');
      }
      if (modo === 'mas') {
        setCargandoMas(true);
        setErrorMas('');
      }

      if (!tiendasCargadas.current) {
        cargarTiendas();
      }

      let url = API + '/deals?pageSize=' + POR_PAGINA + '&pageNumber=' + numero;
      if (titulo) {
        url = url + '&title=' + encodeURIComponent(titulo);
      }

      try {
        const datos = await pedirJSON(url);
        if (id !== peticionActual.current) {
          return;
        }
        setOfertas((prev) => {
          if (modo !== 'mas') {
            return datos;
          }
          const vistos = new Set(prev.map((o) => o.dealID));
          return prev.concat(datos.filter((o) => !vistos.has(o.dealID)));
        });
        setPagina(numero);
        setHayMas(datos.length === POR_PAGINA);
        setEstado('listo');
      } catch (e) {
        if (id !== peticionActual.current) {
          return;
        }
        const mensaje = mensajeDeError(e);
        if (modo === 'mas') {
          setErrorMas(mensaje);
        } else if (modo === 'refrescar') {
          setAviso(mensaje);
        } else {
          setError(mensaje);
          setEstado('error');
        }
      } finally {
        if (id === peticionActual.current) {
          setCargandoMas(false);
          setRefrescando(false);
        }
      }
    },
    [cargarTiendas]
  );

  useEffect(() => {
    cargarPagina(0, '', 'inicio');
  }, [cargarPagina]);

  const buscar = () => {
    Keyboard.dismiss();
    const limpio = texto.trim();
    setBusqueda(limpio);
    cargarPagina(0, limpio, 'inicio');
  };

  const limpiarBusqueda = () => {
    Keyboard.dismiss();
    setTexto('');
    setBusqueda('');
    cargarPagina(0, '', 'inicio');
  };

  const reintentar = () => {
    cargarPagina(0, busqueda, 'inicio');
  };

  const refrescar = () => {
    cargarPagina(0, busqueda, 'refrescar');
  };

  const cargarMas = () => {
    if (cargandoMas || !hayMas) {
      return;
    }
    cargarPagina(pagina + 1, busqueda, 'mas');
  };

  const nombreTienda = (storeID) => tiendas[storeID] || 'Tienda #' + storeID;

  const abrirDetalle = (oferta) => {
    navigation.navigate('Detalle', {
      oferta,
      tienda: nombreTienda(oferta.storeID),
      tiendas,
    });
  };

  const barraBusqueda = (
    <View style={estilos.barraBusqueda}>
      <Ionicons name="search" size={18} color={COLORES.gris} />
      <TextInput
        style={estilos.campoBusqueda}
        placeholder="Buscar juego (ej. batman)"
        placeholderTextColor={COLORES.gris}
        value={texto}
        onChangeText={setTexto}
        onSubmitEditing={buscar}
        returnKeyType="search"
        autoCorrect={false}
      />
      {texto.length > 0 ? (
        <Pressable onPress={limpiarBusqueda} hitSlop={10}>
          <Ionicons name="close-circle" size={20} color={COLORES.gris} />
        </Pressable>
      ) : null}
      <Pressable onPress={buscar} style={estilos.botonBuscar}>
        <Text style={estilos.botonBuscarTexto}>Buscar</Text>
      </Pressable>
    </View>
  );

  if (estado === 'cargando') {
    return (
      <View style={estilos.pantalla}>
        {barraBusqueda}
        <View style={estilos.centro}>
          <ActivityIndicator size="large" color={COLORES.morado} />
          <Text style={estilos.textoCentro}>Cargando ofertas...</Text>
        </View>
      </View>
    );
  }

  if (estado === 'error') {
    return (
      <View style={estilos.pantalla}>
        {barraBusqueda}
        <View style={estilos.centro}>
          <Ionicons name="cloud-offline-outline" size={64} color={COLORES.coral} />
          <Text style={estilos.tituloError}>No se pudieron cargar las ofertas</Text>
          <Text style={estilos.textoCentro}>{error}</Text>
          <Boton titulo="Reintentar" icono="refresh" onPress={reintentar} />
        </View>
      </View>
    );
  }

  const encabezado = (
    <View>
      {aviso ? (
        <View style={estilos.aviso}>
          <Ionicons name="warning-outline" size={18} color="#8A5A00" />
          <Text style={estilos.avisoTexto}>{aviso}</Text>
        </View>
      ) : null}
      <Text style={estilos.contador}>
        {busqueda
          ? 'Resultados para "' + busqueda + '": ' + ofertas.length
          : 'Mostrando ' + ofertas.length + ' ofertas (precios en dolares)'}
      </Text>
    </View>
  );

  const vacio = (
    <View style={estilos.centro}>
      <Ionicons name="game-controller-outline" size={56} color={COLORES.gris} />
      <Text style={estilos.textoCentro}>No hay ofertas para "{busqueda}".</Text>
      <Boton titulo="Ver todas las ofertas" secundario onPress={limpiarBusqueda} />
    </View>
  );

  let pie = null;
  if (ofertas.length > 0) {
    if (cargandoMas) {
      pie = (
        <View style={estilos.pie}>
          <ActivityIndicator color={COLORES.morado} />
          <Text style={estilos.textoPie}>Cargando mas ofertas...</Text>
        </View>
      );
    } else if (errorMas) {
      pie = (
        <View style={estilos.pie}>
          <Text style={estilos.textoErrorPie}>{errorMas}</Text>
          <Boton titulo="Reintentar" icono="refresh" onPress={cargarMas} />
        </View>
      );
    } else if (hayMas) {
      pie = (
        <View style={estilos.pie}>
          <Boton titulo={'Cargar ' + POR_PAGINA + ' mas'} icono="add" secundario onPress={cargarMas} />
        </View>
      );
    } else {
      pie = (
        <View style={estilos.pie}>
          <Text style={estilos.textoPie}>No hay mas ofertas.</Text>
        </View>
      );
    }
  }

  return (
    <View style={estilos.pantalla}>
      {barraBusqueda}
      <FlatList
        data={ofertas}
        keyExtractor={(item) => item.dealID}
        renderItem={({ item }) => (
          <TarjetaOferta
            oferta={item}
            tienda={nombreTienda(item.storeID)}
            onPress={() => abrirDetalle(item)}
          />
        )}
        ListHeaderComponent={encabezado}
        ListEmptyComponent={vacio}
        ListFooterComponent={pie}
        refreshing={refrescando}
        onRefresh={refrescar}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

function Fila({ icono, etiqueta, valor }) {
  return (
    <View style={estilos.fila}>
      <Ionicons name={icono} size={18} color={COLORES.morado} style={{ width: 26 }} />
      <Text style={estilos.filaEtiqueta}>{etiqueta}</Text>
      <Text style={estilos.filaValor}>{valor}</Text>
    </View>
  );
}

function PantallaDetalle({ route }) {
  const insets = useSafeAreaInsets();
  const { oferta, tienda, tiendas } = route.params;
  const [juego, setJuego] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');

  const cargarJuego = useCallback(async () => {
    setEstado('cargando');
    setError('');
    try {
      const datos = await pedirJSON(API + '/games?id=' + oferta.gameID);
      setJuego(datos);
      setEstado('listo');
    } catch (e) {
      setError(mensajeDeError(e));
      setEstado('error');
    }
  }, [oferta.gameID]);

  useEffect(() => {
    cargarJuego();
  }, [cargarJuego]);

  const steam = oferta.steamRatingText
    ? oferta.steamRatingText + ' (' + oferta.steamRatingPercent + '%, ' + oferta.steamRatingCount + ' resenas)'
    : 'Sin dato';
  const metacritic = Number(oferta.metacriticScore) > 0 ? oferta.metacriticScore + ' / 100' : 'Sin dato';

  const abrirTienda = () => {
    Linking.openURL('https://www.cheapshark.com/redirect?dealID=' + oferta.dealID);
  };

  let historial = null;
  if (estado === 'cargando') {
    historial = (
      <View style={estilos.pie}>
        <ActivityIndicator color={COLORES.morado} />
        <Text style={estilos.textoPie}>Consultando otras tiendas...</Text>
      </View>
    );
  } else if (estado === 'error') {
    historial = (
      <View style={estilos.pie}>
        <Text style={estilos.textoErrorPie}>{error}</Text>
        <Boton titulo="Reintentar" icono="refresh" onPress={cargarJuego} />
      </View>
    );
  } else if (juego) {
    const otras = (juego.deals || [])
      .slice()
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 5);
    historial = (
      <View>
        {juego.cheapestPriceEver ? (
          <Fila
            icono="trophy-outline"
            etiqueta="Minimo historico"
            valor={dinero(juego.cheapestPriceEver.price) + ' (' + fechaDeUnix(juego.cheapestPriceEver.date) + ')'}
          />
        ) : null}
        {otras.map((d) => (
          <Fila
            key={d.dealID}
            icono="pricetag-outline"
            etiqueta={(tiendas && tiendas[d.storeID]) || 'Tienda #' + d.storeID}
            valor={dinero(d.price) + '  -' + porcentaje(d.savings)}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <View style={estilos.portada}>
        <Image source={{ uri: oferta.thumb }} style={estilos.imagenGrande} resizeMode="contain" />
      </View>
      <Text style={estilos.tituloDetalle}>{oferta.title}</Text>

      <View style={estilos.cajaPrecio}>
        <Text style={estilos.precioGrande}>{precioOferta(oferta.salePrice)}</Text>
        <Text style={estilos.precioNormal}>{dinero(oferta.normalPrice)}</Text>
        <View style={estilos.insignia}>
          <Text style={estilos.insigniaTexto}>-{porcentaje(oferta.savings)}</Text>
        </View>
      </View>

      <View style={estilos.seccion}>
        <Text style={estilos.tituloSeccion}>Datos de la oferta</Text>
        <Fila icono="storefront-outline" etiqueta="Tienda" valor={tienda} />
        <Fila icono="cash-outline" etiqueta="Precio normal" valor={dinero(oferta.normalPrice)} />
        <Fila icono="trending-down-outline" etiqueta="Ahorro" valor={porcentaje(oferta.savings)} />
        <Fila icono="star-outline" etiqueta="Calificacion oferta" valor={oferta.dealRating + ' / 10'} />
        <Fila icono="ribbon-outline" etiqueta="Metacritic" valor={metacritic} />
        <Fila icono="thumbs-up-outline" etiqueta="Steam" valor={steam} />
        <Fila icono="calendar-outline" etiqueta="Lanzamiento" valor={fechaDeUnix(oferta.releaseDate)} />
        <Fila icono="time-outline" etiqueta="Ultimo cambio" valor={fechaDeUnix(oferta.lastChange)} />
      </View>

      <View style={estilos.seccion}>
        <Text style={estilos.tituloSeccion}>Historial y otras tiendas</Text>
        {historial}
      </View>

      <Boton titulo="Ver oferta en la tienda" icono="open-outline" onPress={abrirTienda} />
      <Text style={estilos.nota}>Datos de CheapShark. Precios en dolares (USD).</Text>
    </ScrollView>
  );
}

const Pila = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={tema}>
        <StatusBar style="light" />
        <Pila.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: COLORES.morado },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: COLORES.fondo },
          }}
        >
          <Pila.Screen
            name="Ofertas"
            component={PantallaOfertas}
            options={{ title: 'GameHunter - Ofertas' }}
          />
          <Pila.Screen
            name="Detalle"
            component={PantallaDetalle}
            options={{ title: 'Detalle de la oferta' }}
          />
        </Pila.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 300,
  },
  textoCentro: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 15,
    color: COLORES.gris,
    textAlign: 'center',
  },
  tituloError: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORES.texto,
    textAlign: 'center',
  },
  barraBusqueda: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.tarjeta,
    margin: 12,
    paddingLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  campoBusqueda: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    color: COLORES.texto,
  },
  botonBuscar: {
    backgroundColor: COLORES.morado,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
    marginLeft: 8,
  },
  botonBuscarTexto: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contador: {
    fontSize: 13,
    color: COLORES.gris,
    marginBottom: 8,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4D6',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  avisoTexto: {
    flex: 1,
    marginLeft: 8,
    color: '#8A5A00',
    fontSize: 13,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORES.tarjeta,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  miniatura: {
    width: 100,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#ECEAF8',
  },
  tarjetaInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  tarjetaTitulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORES.texto,
  },
  tarjetaTienda: {
    fontSize: 12,
    color: COLORES.gris,
    marginTop: 2,
  },
  filaPrecios: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  precioOferta: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORES.verde,
    marginRight: 8,
  },
  precioNormal: {
    fontSize: 13,
    color: COLORES.gris,
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  insignia: {
    backgroundColor: COLORES.coral,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  insigniaTexto: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pie: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  textoPie: {
    marginTop: 8,
    color: COLORES.gris,
    fontSize: 13,
  },
  textoErrorPie: {
    color: COLORES.coral,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.morado,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  botonSecundario: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORES.morado,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  botonTextoSecundario: {
    color: COLORES.morado,
  },
  portada: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  imagenGrande: {
    width: '100%',
    height: 150,
  },
  tituloDetalle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORES.texto,
    marginTop: 12,
  },
  cajaPrecio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  precioGrande: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORES.verde,
    marginRight: 10,
  },
  seccion: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  tituloSeccion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORES.morado,
    marginBottom: 6,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFF8',
  },
  filaEtiqueta: {
    width: 130,
    fontSize: 14,
    color: COLORES.gris,
  },
  filaValor: {
    flex: 1,
    fontSize: 14,
    color: COLORES.texto,
    fontWeight: '600',
    textAlign: 'right',
  },
  nota: {
    marginTop: 10,
    fontSize: 12,
    color: COLORES.gris,
    textAlign: 'center',
  },
});
