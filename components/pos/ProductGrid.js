import React from 'react';
import { formatPrecioDisplay, categoriasMap } from '@/lib/utils';
import { urlFor } from '@/lib/sanity';
// ✅ Importamos la configuración maestra para la moneda y lógica
import { SITE_CONFIG } from '@/lib/config';

export default function ProductGrid({
    platos, platosFiltrados, busqueda, setBusqueda, categoriaActiva, setCategoriaActiva,
    mostrarCategoriasMobile, setMostrarCategoriasMobile, agregarAlCarrito, 
    styles, mostrarCarritoMobile, setMostrarCarritoMobile, cart, total, mensajeExito, ordenesActivas, cargarOrden, ordenActivaId
}) {
    const listaCategorias = ['todos', ...new Set(platos.map(p => p.categoria))];

    return (
        <div className={styles.menuPanel}>
            {/* BOTONES DE NAVEGACIÓN SUPERIOR (MÓVIL) */}
            {!mostrarCarritoMobile && (
                <div className={styles.mobileSearchHeader}>
                    {/* CARRITO A LA IZQUIERDA */}
                    <button 
                        className={styles.mobileOrderBtn} 
                        onClick={(e) => {
                            e.stopPropagation();
                            setMostrarCarritoMobile(true);
                        }}
                    >
                        🛒
                    </button>
                    
                    {/* 🔍 BUSCADOR ESTILO GOOGLE (CENTRO) */}
                    <div className={styles.searchContainer}>
                        <input 
                            type="text" 
                            placeholder="Buscar plato..." 
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className={styles.searchInput}
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className={styles.clearBtn}>✕</button>
                        )}
                    </div>

                    {/* HAMBURGUESA / X A LA DERECHA */}
                    <button 
                        className={styles.mobileCatBtn} 
                        onClick={(e) => {
                            e.stopPropagation();
                            setMostrarCategoriasMobile(!mostrarCategoriasMobile);
                        }}
                    >
                        {mostrarCategoriasMobile ? '✕' : '☰'}
                    </button>
                </div>
            )}

            {/* Menú lateral de categorías */}
            <div className={`${styles.categoriesBar} ${mostrarCategoriasMobile ? styles.categoriesBarShowMobile : ''}`}>
                <h3 className={styles.mobileOnlyTitle}>Categorías</h3>
                {listaCategorias.map(cat => (
                    <button 
                        key={cat} 
                        className={`${styles.catBtn} ${categoriaActiva === cat ? styles.catBtnActive : ''}`} 
                        onClick={() => {
                            setCategoriaActiva(cat);
                            setMostrarCategoriasMobile(false);
                        }}>
                        {categoriasMap[cat] || cat}
                    </button>
                ))}
            </div>

            {/* Cuadrícula de Platos con Diseño Split */}
            <div className={styles.productsGrid}>
                {platosFiltrados.map(plato => (
                    <div key={plato._id} className={styles.productCard} onClick={() => agregarAlCarrito(plato)}>
                        {/* 1. Área de Imagen */}
                        <div 
                            className={styles.cardImage} 
                            style={{ 
                                backgroundImage: plato.imagen 
                                    ? `url(${urlFor(plato.imagen).width(300).url()})` 
                                    : 'none',
                                backgroundColor: '#f3f4f6'
                            }}
                        />
                        
                        {/* 2. Área de Información */}
                        <div className={styles.cardInfo}>
                            <div className={styles.cardTitle}>{plato.nombre}</div>
                            <div className={styles.cardPrice}>
                                {SITE_CONFIG.brand.symbol}{formatPrecioDisplay(plato.precio).toLocaleString(SITE_CONFIG.brand.currency)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* BARRA INFERIOR DINÁMICA: ÉXITO > CARRITO > NAVEGACIÓN DE MESAS */}
            {(mensajeExito || (cart && cart.length > 0) || (ordenesActivas && ordenesActivas.length > 0)) && !mostrarCarritoMobile && (
                <div 
                    className={mensajeExito || cart.length > 0 ? styles.rappiCartBtn : styles.barraMesasActivas} 
                    style={{ 
                        backgroundColor: mensajeExito ? '#059669' : (cart.length > 0 ? '#10B981' : '#f8f9fa'),
                        borderTop: cart.length === 0 ? '1px solid #dee2e6' : 'none'
                    }}
                    onClick={() => {
                        if (!mensajeExito && cart.length > 0) setMostrarCarritoMobile(true);
                    }}
                >
                    {mensajeExito ? (
                        /* MODO 1: CONFIRMACIÓN DE ÉXITO */
                        <>
                            <div className={styles.rappiCount}>✓</div>
                            <div className={styles.rappiText}>¡ORDEN GUARDADA EXITOSAMENTE!</div>
                        </>
                    ) : cart.length > 0 ? (
                        /* MODO 2: CARRITO ACTIVO */
                        <>
                            <div className={styles.rappiCount}>
                                {cart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0)} 
                                {' '}
                                {cart.length === 1 && cart[0].quantity === 1 ? 'Producto' : 'Productos'}
                            </div>
                            <div className={styles.rappiText}>Ver pedido</div>
                            {!mensajeExito && (
                                <div className={styles.rappiTotal}>
                                    {SITE_CONFIG.brand.symbol}{Number(total || 0).toLocaleString()}
                                </div>
                            )}
                        </>
                    ) : (
                        /* MODO 3: NAVEGACIÓN RÁPIDA DE MESAS */
                        <div className={styles.contenedorMesasRapidas}>
                       <span className={styles.etiquetaMesas}>MESAS ACTIVAS:</span>
                       <div className={styles.scrollMesas}>
                        {ordenesActivas && ordenesActivas.map((o) => (
                        <button 
                        key={o._id} 
                        className={`${styles.botonMesaRapida} ${ordenActivaId === o._id ? styles.tableBtnActive : ''}`} 
                         onClick={() => cargarOrden(o._id)} // 👈 Lógica idéntica a la de escritorio
                        >
                        {o.mesa}
                        </button>
                      ))}
                        </div>
                        </div>
                   )}
                </div>
            )}
        </div>
    );
}
