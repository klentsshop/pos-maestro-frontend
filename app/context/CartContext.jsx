'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { cleanPrice } from '@/lib/utils'; // ✅ Usamos tu utilidad global

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [propina, setPropina] = useState(0); // 👈 Estado para el % de propina
  const [montoManual, setMontoManual] = useState(0); // 👈 Campo "Otro" (Monto manual)

  // 💾 1. Al iniciar, recuperar del navegador si existe algo (Ahora localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('talanquera_cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) setItems(parsed);
    }

    // 🔥 SINCRONIZACIÓN ENTRE PESTAÑAS:
    const syncTabs = (e) => {
      if (e.key === 'talanquera_cart') {
        const newValue = e.newValue ? JSON.parse(e.newValue) : [];
        setItems(newValue);
      }
    };
    window.addEventListener('storage', syncTabs);
    return () => window.removeEventListener('storage', syncTabs);
  }, []);

  // 💾 2. Cada vez que cambien los items, guardarlos en el navegador
  useEffect(() => {
    localStorage.setItem('talanquera_cart', JSON.stringify(items));
  }, [items]);

  const addProduct = (product) => {
    const precioNum = cleanPrice(product.precio);
    
    // 1. Obtenemos el ID real (sea _id o id)
    const pId = product._id || product.id;

    setItems(prev => {
      // 2. Buscamos el producto comparando ambos posibles campos de ID
      const existingIdx = prev.findIndex(it => {
        const itId = it._id || it.id;
        return itId === pId && (!it.comentario || it.comentario.trim() === '');
      });

      if (existingIdx !== -1) {
        const copy = [...prev];
        const nuevaCantidad = copy[existingIdx].cantidad + 1;
        
        copy[existingIdx] = { 
          ...copy[existingIdx], 
          cantidad: nuevaCantidad,
          subtotalNum: nuevaCantidad * precioNum
        };
        return copy;
      }

      // 3. Si es nuevo, lo agregamos asegurando que lleve un ID válido
      return [...prev, {
        ...product,
        _id: pId, // Guardamos el ID unificado para la próxima comparación
        lineId: crypto.randomUUID(),
        cantidad: 1,
        precioNum,
        subtotalNum: precioNum,
        comentario: ''
      }];
    });
  };
  const setCartFromOrden = (platosOrdenados = []) => {
    localStorage.removeItem('talanquera_cart');
    
    const reconstruido = platosOrdenados.map(p => ({
      lineId: p._key || crypto.randomUUID(),
      _id: p._id || p.nombrePlato,
      nombre: p.nombrePlato,
      precio: cleanPrice(p.precioUnitario),
      cantidad: Number(p.cantidad) || 1,
      precioNum: cleanPrice(p.precioUnitario),
      subtotalNum: cleanPrice(p.precioUnitario) * (Number(p.cantidad) || 1),
      comentario: p.comentario || ""
    }));

    console.log('✅ [CartContext] MESA CARGADA:', reconstruido);
    setItems(reconstruido);
  };

  const actualizarComentario = (lineId, comentario) => {
    setItems(prev =>
      prev.map(it =>
        it.lineId === lineId ? { ...it, comentario } : it
      )
    );
  };

  const decrease = (lineId) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.lineId === lineId);
      if (idx === -1) return prev;
      const copy = [...prev];
      if (copy[idx].cantidad <= 1) {
        copy.splice(idx, 1);
      } else {
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
      }
      return copy;
    });
  };

  const clear = () => {
    setItems([]);
    setPropina(0);
    setMontoManual(0);
    localStorage.removeItem('talanquera_cart');
    localStorage.removeItem('talanquera_mesa');
  };

  // 🧮 CÁLCULO DEL TOTAL BLINDADO
  const total = useMemo(() => {
    const subtotalProductos = items.reduce((s, it) => s + (it.precioNum * it.cantidad), 0);
    
    // Si la propina es manual (-1), ignoramos porcentajes y sumamos el monto puro
    if (propina === -1) {
      return subtotalProductos + Number(montoManual);
    }
    
    const valorPropinaPorcentaje = subtotalProductos * (propina / 100);
    return subtotalProductos + valorPropinaPorcentaje;
  }, [items, propina, montoManual]);

  return (
    <CartContext.Provider value={{
      items,
      addProduct,
      setCartFromOrden,
      decrease,
      clear,
      total,
      metodoPago,
      setMetodoPago,
      propina,
      setPropina,
      montoManual,
      setMontoManual,
      actualizarComentario,
      cleanPrice: cleanPrice
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);