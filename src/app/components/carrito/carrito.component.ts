import { Component, OnInit, AfterViewInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarritoService } from '../../services/carrito.service';
import { ProductoService } from '../../services/producto.service';
import { Router } from '@angular/router';
import { Producto } from '../../models/producto';

declare var paypal: any; // Declare PayPal SDK

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css']
})
export class CarritoComponent implements OnInit, AfterViewInit {
  carrito: Producto[] = [];
  productosInventario: Producto[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;
  private isPayPalButtonRendered = false;

  constructor(
    private carritoService: CarritoService,
    private productoService: ProductoService,
    private router: Router,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.carrito = this.carritoService.obtenerCarrito();
    this.cargarInventario();
    this.loadPayPalScript();
  }

  ngAfterViewInit(): void {
    this.renderPayPalButton();
  }

  cargarInventario(): void {
    this.productoService.obtenerProducto().subscribe({
      next: (productos) => {
        this.productosInventario = productos;
      },
      error: (err) => {
        console.error('Error cargando inventario:', err);
        this.productosInventario = [];
        this.errorMessage = 'Error al cargar el inventario. Intenta de nuevo.';
      }
    });
  }

  private loadPayPalScript(): void {
    if (document.querySelector('script[src*="paypal.com/sdk/js"]')) {
      this.renderPayPalButton();
      return;
    }

    const script = this.renderer.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=EIQHlb9bvwdamPiUcPooiPyrzJLKoRDuv0zJEYTE7MyR8JYeDC1XLk1uGQZMrWmZqjC-a5NWPeiR6-4O&currency=MXN`;
    script.async = true;
    script.onload = () => {
      console.log('PayPal SDK loaded');
      this.renderPayPalButton();
    };
    script.onerror = () => {
      this.errorMessage = 'Error al cargar el SDK de PayPal. Intenta de nuevo más tarde.';
      console.error('PayPal SDK failed to load');
    };
    this.renderer.appendChild(document.body, script);
  }

  private renderPayPalButton(): void {
    if (this.isPayPalButtonRendered || this.carrito.length === 0 || !paypal) {
      console.warn('PayPal SDK not available, cart is empty, or button already rendered');
      return;
    }

    this.isPayPalButtonRendered = true;

    // Type assertion to avoid ts(7015)
    const paypalSDK = paypal as {
      Buttons: (config: {
        style?: {
          layout?: 'vertical' | 'horizontal';
          color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
          shape?: 'rect' | 'pill';
          label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
        };
        createOrder?: (data: any, actions: any) => Promise<string>;
        onApprove?: (data: any, actions: any) => Promise<void>;
        onError?: (err: any) => void;
        onCancel?: () => void;
      }) => { render: (container: string) => Promise<void> };
    };

    paypalSDK.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal'
      },
      createOrder: (data: any, actions: any) => {
        const updates: { id: number, cantidad: number }[] = [];
        for (const item of this.carrito) {
          const inventarioProducto = this.productosInventario.find(p => p.id === item.id);
          if (!inventarioProducto || inventarioProducto.cantidad < item.cantidad) {
            this.errorMessage = `No hay suficiente stock para ${item.nombre}. Disponible: ${inventarioProducto?.cantidad || 0}`;
            return Promise.reject(new Error('Stock insuficiente'));
          }
          updates.push({ id: item.id, cantidad: item.cantidad });
        }

        let itemTotal = 0;
        const items = this.carrito.map(item => {
          const precio = Number(item.precio);
          if (isNaN(precio) || precio <= 0) {
            this.errorMessage = `El precio de ${item.nombre} no es válido.`;
            return Promise.reject(new Error('Precio inválido'));
          }
          const subtotal = precio * item.cantidad;
          itemTotal += subtotal;
          return {
            name: item.nombre,
            unit_amount: { currency_code: 'MXN', value: precio.toFixed(2) },
            quantity: item.cantidad.toString()
          };
        });

        const iva = itemTotal * 0.16;
        const total = itemTotal + iva;

        return actions.order.create({
          purchase_units: [{
            amount: {
              currency_code: 'MXN',
              value: total.toFixed(2),
              breakdown: {
                item_total: { currency_code: 'MXN', value: itemTotal.toFixed(2) },
                tax_total: { currency_code: 'MXN', value: iva.toFixed(2) }
              }
            },
            items: items
          }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        this.isLoading = true;
        this.errorMessage = null;
        try {
          const order = await actions.order.capture();

          const updates: { id: number, cantidad: number }[] = [];
          for (const item of this.carrito) {
            const inventarioProducto = this.productosInventario.find(p => p.id === item.id);
            if (!inventarioProducto || inventarioProducto.cantidad < item.cantidad) {
              this.errorMessage = `No hay suficiente stock para ${item.nombre}. Disponible: ${inventarioProducto?.cantidad || 0}`;
              this.isLoading = false;
              return;
            }
            updates.push({ id: item.id, cantidad: item.cantidad });
          }

          for (const update of updates) {
            await this.productoService.disminuirCantidadEnCompra(update.id, update.cantidad).toPromise();
          }

          this.carritoService.limpiarCarrito();
          this.carrito = this.carritoService.obtenerCarrito();
          this.cargarInventario();

          alert('Compra realizada exitosamente. ID de transacción: ' + order.id);
        } catch (err) {
          console.error('Error al procesar el pago:', err);
          this.errorMessage = 'Error al procesar el pago. Intenta de nuevo.';
        } finally {
          this.isLoading = false;
        }
      },
      onError: (err: any) => {
        console.error('Error en el flujo de PayPal:', err);
        this.errorMessage = 'Error en el proceso de pago. Intenta de nuevo.';
        this.isLoading = false;
      },
      onCancel: () => {
        this.errorMessage = 'Pago cancelado por el usuario.';
        this.isLoading = false;
      }
    }).render('#paypal-button-container').catch((err: any) => {
      console.error('Error al renderizar el botón de PayPal:', err);
      this.errorMessage = 'Error al cargar el botón de PayPal. Intenta de nuevo.';
      this.isPayPalButtonRendered = false;
    });
  }

  aumentarCantidad(index: number): void {
    const producto = this.carrito[index];
    const inventarioProducto = this.productosInventario.find(p => p.id === producto.id);
    if (inventarioProducto && inventarioProducto.cantidad > producto.cantidad) {
      producto.cantidad += 1;
      this.carritoService.actualizarCarrito(this.carrito);
      console.log('Cantidad aumentada en carrito:', this.carrito);
    } else {
      this.errorMessage = `No hay suficiente stock para ${producto.nombre}. Disponible: ${inventarioProducto?.cantidad || 0}`;
    }
  }

  disminuirCantidad(index: number): void {
    const producto = this.carrito[index];
    if (producto.cantidad > 1) {
      producto.cantidad -= 1;
      this.carritoService.actualizarCarrito(this.carrito);
      console.log('Cantidad disminuida en carrito:', this.carrito);
    }
  }

  eliminarProducto(id: number): void {
    this.carritoService.eliminarProducto(id);
    this.carrito = this.carritoService.obtenerCarrito();
    this.errorMessage = null;
  }

  isProductInStock(id: number): boolean {
    const producto = this.productosInventario.find(p => p.id === id);
    return producto ? producto.cantidad > 0 : false;
  }

  irAlCatalogo(): void {
    this.router.navigate(['/']);
  }
}