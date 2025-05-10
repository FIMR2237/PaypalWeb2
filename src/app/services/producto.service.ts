import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, delay, tap } from 'rxjs/operators';
import { Producto } from '../models/producto';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private productos: Producto[] = [];
  private apiUrl = 'http://localhost:3000/api/productos';

  constructor(private http: HttpClient) {
    this.cargarProductosIniciales();
  }

  private cargarProductosIniciales(): void {
    this.obtenerProducto().subscribe({
      next: (productos) => {
        this.productos = productos;
      },
      error: (err) => {
        console.error('Error al cargar productos iniciales:', err);
        this.productos = [];
      }
    });
  }

  obtenerProducto(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl).pipe(
      delay(1000),
      map((data: any[]) => {
        return data.map((prod: any) => {
          return new Producto(
            prod.id,
            prod.nombre,
            Number(prod.precio), // Ensure precio is a number
            prod.imagen_url, // API uses imagen_url, mapped to imagen
            Number(prod.stock), // Map stock to cantidad
            prod.descripcion,
            prod.categoria || 'Sin categoría'
          );
        });
      }),
      tap(productos => {
        this.productos = productos;
      }),
      catchError((err) => {
        console.error('Error fetching products:', err);
        return of([]);
      })
    );
  }

  agregarProducto(producto: Producto): Observable<Producto> {
    if (!producto.nombre || Number(producto.precio) <= 0 || producto.cantidad < 0 || !producto.categoria) {
      return throwError(() => new Error('Datos inválidos: nombre, precio, cantidad y categoría son obligatorios.'));
    }

    const productoParaEnviar = {
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: Number(producto.precio), // Ensure precio is a number
      stock: producto.cantidad,
      imagen_url: producto.imagen || '',
      categoria: producto.categoria
    };

    console.log('Enviando solicitud POST con cuerpo:', productoParaEnviar);
    return this.http.post<Producto>(this.apiUrl, productoParaEnviar).pipe(
      tap((response: any) => {
        producto.id = response.id;
        producto.precio = Number(response.precio); // Ensure precio is a number
        this.productos.push(producto);
      }),
      catchError((err) => {
        console.error('Error al agregar producto:', err);
        throw err;
      })
    );
  }

  actualizarProducto(updatedProducto: Producto): Observable<Producto> {
    if (!updatedProducto.id || updatedProducto.id <= 0) {
      return throwError(() => new Error('ID inválido para actualizar el producto.'));
    }
    if (!updatedProducto.nombre || Number(updatedProducto.precio) <= 0 || updatedProducto.cantidad < 0 || !updatedProducto.categoria) {
      return throwError(() => new Error('Datos inválidos: nombre, precio, cantidad y categoría son obligatorios.'));
    }

    const productoParaEnviar = {
      nombre: updatedProducto.nombre,
      descripcion: updatedProducto.descripcion || '',
      precio: Number(updatedProducto.precio), // Ensure precio is a number
      stock: updatedProducto.cantidad,
      imagen_url: updatedProducto.imagen || '',
      categoria: updatedProducto.categoria
    };

    console.log('Enviando solicitud PUT con cuerpo:', productoParaEnviar);
    return this.http.put<Producto>(`${this.apiUrl}/${updatedProducto.id}`, productoParaEnviar).pipe(
      tap((response: any) => {
        updatedProducto.precio = Number(response.precio); // Ensure precio is a number
        const index = this.productos.findIndex(p => p.id === updatedProducto.id);
        if (index !== -1) {
          this.productos[index] = updatedProducto;
        }
      }),
      catchError((err) => {
        console.error('Error al actualizar producto:', err);
        throw err;
      })
    );
  }

  eliminarProducto(id: number): Observable<void> {
    if (!id || id <= 0) {
      return throwError(() => new Error('ID inválido para eliminar el producto.'));
    }

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.productos = this.productos.filter(p => p.id !== id);
      }),
      catchError((err) => {
        console.error('Error al eliminar producto:', err);
        throw err;
      })
    );
  }
disminuirCantidadEnCompra(id: number, amount: number): Observable<void> {
  const producto = this.productos.find(p => p.id === id);
  if (producto && producto.cantidad >= amount) {
    producto.cantidad -= amount;
    return this.actualizarProducto(producto).pipe(
      map(() => void 0),
      tap(() => console.log(`Cantidad disminuida en ${amount} para producto ${id}`)),
      catchError((err) => {
        console.error('Error al disminuir cantidad en compra:', err);
        return throwError(() => new Error('Error al actualizar stock'));
      })
    );
  }
  return throwError(() => new Error('Producto no encontrado o stock insuficiente'));
}
  disminuirCantidad(id: number): Observable<void> {
    const producto = this.productos.find(p => p.id === id);
    if (producto && producto.cantidad > 0) {
      producto.cantidad -= 1;
      return this.actualizarProducto(producto).pipe(
        map(() => void 0),
        tap(() => console.log('Cantidad disminuida y producto actualizado en la base de datos')),
        catchError((err) => {
          console.error('Error al disminuir cantidad:', err);
          return throwError(() => new Error('Error al actualizar stock'));
        })
      );
    }
    return throwError(() => new Error('Producto no encontrado o sin stock'));
  }

  aumentarCantidad(id: number, amount: number): Observable<void> {
    const producto = this.productos.find(p => p.id === id);
    if (producto) {
      producto.cantidad += amount;
      return this.actualizarProducto(producto).pipe(
        map(() => void 0),
        tap(() => console.log('Cantidad aumentada y producto actualizado en la base de datos')),
        catchError((err) => {
          console.error('Error al aumentar cantidad:', err);
          return throwError(() => new Error('Error al actualizar stock'));
        })
      );
    }
    return throwError(() => new Error('Producto no encontrado'));
  }
}